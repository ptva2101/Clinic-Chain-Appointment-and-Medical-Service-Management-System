# Giải thích kiến trúc khi bảo vệ

## 1. Ranh giới và dữ liệu sở hữu

Hệ thống có 7 ứng dụng FastAPI chạy độc lập, được Docker Compose quản lý. Trong triển khai local, 7 database nằm trên cùng một máy chủ MySQL nhưng mỗi service có tài khoản và quyền trên database riêng. Đây là tách quyền sở hữu dữ liệu theo service, không phải 7 máy chủ MySQL độc lập.

| Service | Cổng | Database | Trách nhiệm | Swagger/OpenAPI |
| --- | --- | --- | --- | --- |
| Identity | 8001 | `identity_db` | Tài khoản, vai trò, mật khẩu băm, access/refresh token, thu hồi phiên | <http://127.0.0.1:8001/docs> |
| Registry | 8002 | `registry_db` | Hồ sơ bệnh nhân/nhân viên, chi nhánh, dịch vụ, nhóm và xác minh BHYT | <http://127.0.0.1:8002/docs> |
| Scheduling | 8003 | `scheduling_db` | Ca trực, số chỗ, giữ/xác nhận/giải phóng chỗ | <http://127.0.0.1:8003/docs> |
| Appointment | 8004 | `appointment_db` | Lịch hẹn, thông báo, tiếp đón, hàng chờ, trạng thái điều phối | <http://127.0.0.1:8004/docs> |
| Billing | 8005 | `billing_db` | Snapshot giá/BHYT, hóa đơn, thanh toán/hoàn tiền giả lập, báo cáo thu | <http://127.0.0.1:8005/docs> |
| Clinical | 8006 | `clinical_db` | Danh mục bệnh/thuốc, lượt khám, đơn thuốc, phác đồ và buổi điều trị | <http://127.0.0.1:8006/docs> |
| Laboratory | 8007 | `laboratory_db` | Chỉ định xét nghiệm, người nhận, kết quả | <http://127.0.0.1:8007/docs> |

Tại mỗi cổng, `/openapi.json` trả hợp đồng API máy đọc được; `/health` kiểm tra tiến trình và `/ready` thử kết nối database. Ví dụ <http://127.0.0.1:8004/openapi.json>. Swagger `/docs` dùng để trình diễn endpoint, schema đầu vào/đầu ra, mã lỗi và yêu cầu Bearer token.

Frontend là React/Vite ở cổng 5173, gọi HTTP API của các service. Docker không chạy `Backend/` cũ; database monolith `clinic` ở cổng 3306 không tham gia luồng này. MySQL Docker local mở ở cổng 3307.

## 2. Luồng đặt lịch: orchestration

Appointment là nơi điều phối, sử dụng API của Scheduling:

1. Bệnh nhân gửi cấu hình dịch vụ, bác sĩ, ngày/ca và `idempotency_key`.
2. Scheduling kiểm tra Registry và sức chứa, giữ chỗ trong giao dịch.
3. Appointment ghi lịch trạng thái `pending` vào database của mình.
4. Appointment yêu cầu Scheduling xác nhận hold cho mã lịch vừa tạo.
5. Khi xác nhận chắc chắn, Appointment chuyển lịch sang `confirmed`.

Nếu timeout làm kết quả chưa chắc chắn, lịch có thể ở `pending`. Worker `appointment-reconciler` hỏi lại Scheduling qua API để hoàn tất hoặc đánh dấu thất bại theo trạng thái hold. Khi hủy lịch, Appointment kiểm tra thanh toán qua Billing rồi giải phóng chỗ. `idempotency_key` và ràng buộc dữ liệu giúp lời gọi lặp không tạo lịch trùng.

Đây là phối hợp kiểu **orchestration**, không dùng message broker/choreography. Worker không phải service nghiệp vụ thứ 8; nó là tiến trình nền của Appointment, dùng `appointment_db` và API của các service liên quan.

## 3. Hóa đơn/BHYT và hoàn tiền

1. Billing hỏi Appointment để xác nhận lịch thuộc bệnh nhân và đã confirmed.
2. Billing hỏi Registry để lấy giá dịch vụ và hồ sơ BHYT đã xác minh.
3. Billing lưu `list_price`, `insurance_discount`, `amount_due`, mức hưởng, thẻ, chi nhánh và bác sĩ **ngay lúc tạo hóa đơn**.
4. Thay giá hoặc xác minh lại thẻ về sau không tính lại hóa đơn cũ.
5. Bệnh nhân ghi nhận thanh toán giả lập; Admin có quyền hoàn tiền giả lập. Gọi lặp không tạo thêm giao dịch.
6. Appointment chặn bệnh nhân hủy lịch đã thanh toán; sau hoàn tiền có thể hủy lịch chưa check-in và trả chỗ.

Ví dụ demo: giá 150.000 đ, chính sách mô phỏng 80% đã xác minh → giảm 120.000 đ, phải trả 30.000 đ. Nếu chưa xác minh, hóa đơn không tự giảm. Báo cáo đọc ledger của Billing theo chi nhánh, bác sĩ và dịch vụ; không JOIN database Registry/Appointment.

## 4. Tiếp đón, khám, xét nghiệm và điều trị

- Lễ tân gọi Appointment; Appointment xác minh hồ sơ nhân viên qua Registry và thanh toán qua Billing, cấp số thứ tự trong giao dịch của mình.
- Bác sĩ bắt đầu khám qua Appointment, lưu lượt khám ở Clinical.
- Clinical gửi chỉ định qua API Laboratory, kèm mã lượt khám và các dịch vụ liên quan.
- Xét nghiệm viên thuộc đúng chi nhánh nhận chỉ định và trả kết quả; Clinical chặn kết luận khi kết quả chưa đủ.
- Clinical hoàn tất lượt khám và cập nhật hàng chờ qua Appointment. Bệnh nhân đọc bệnh sử từ Clinical và kết quả từ Laboratory.
- Đặt buổi điều trị bắt đầu ở Clinical, phối hợp Appointment để đặt chỗ và Billing để tạo hóa đơn. Không đặt vượt phác đồ; cùng request key không tạo buổi trùng.

Các lời gọi nội bộ có token service; người dùng có Bearer token Identity. Service nghiệp vụ kiểm tra token qua Identity, không mở database Identity.

## 5. Bằng chứng nên mở trong buổi bảo vệ

| Nội dung yêu cầu môn học | Bằng chứng |
| --- | --- |
| Phân rã nghiệp vụ | Bảng trách nhiệm/database ở trên; `compose.yaml`; quyền trong `infra/mysql/init/` |
| Thiết kế API | Swagger và `/openapi.json` của từng service |
| Kết hợp dịch vụ | Luồng giữ chỗ/xác nhận; BHYT/hóa đơn; khám/xét nghiệm; worker hòa giải |
| Kiểm tra chức năng | `demo-verification.md` và báo cáo JSON; bộ test `services/tests/` |
| SLA/QoS | Mục tiêu SLO, chỉ số và kết quả đo trong `qos.md`; script k6 ở `services/load/` |

Nói rõ giới hạn: kết quả local không chứng minh SLA khả dụng 30 ngày; kiểm tra chức năng/tranh chấp không thay thế kiểm thử tải. Không cam kết kết nối cơ quan BHYT, ngân hàng hoặc hệ thống phân tán nhiều máy khi chưa triển khai.
