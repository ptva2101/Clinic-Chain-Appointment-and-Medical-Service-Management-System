# Lộ trình 2 người: từ repo cũ đến bản đồ án hoàn chỉnh

Cập nhật 14/10/2026. Mục tiêu là **hệ thống đặt lịch khám chạy đầu-cuối** với 7 microservice, API OpenAPI, phối hợp giữa service, dữ liệu MySQL, kiểm thử tự động và kiểm thử tải. Đây là phạm vi **đồ án/demo**, không phải hệ thống y tế production. Thanh toán dự kiến là **mô phỏng giao dịch nhưng lưu thật trong MySQL**, chưa tích hợp cổng thanh toán bên ngoài.

**Phân vai:** Người 1 = Anh Huy, chịu trách nhiệm luồng bệnh nhân/đặt lịch, điều phối dịch vụ và kiểm thử tải. Người 2 = thành viên còn lại, chịu trách nhiệm luồng nhân viên/thanh toán/xét nghiệm, hợp đồng API và kiểm thử tích hợp. Mỗi task có một người nhận chính; người kia review PR và hỗ trợ khi task phụ thuộc nhau. Các task đã có là **trạng thái của mã nguồn**, không khẳng định ai đã làm phần việc đó trong quá khứ.

Mốc `S1`–`S8` là **sprint tương đối** (gợi ý 1 tuần/sprint); đổi sang deadline thực tế của nhóm trước khi tạo task trên CoReach. Không bắt đầu task phụ thuộc nếu API/hợp đồng ở task trước chưa chốt.

| ID | Mốc | Task/tiêu đề CoReach | Phụ trách | Trạng thái hiện tại | Hoàn thành khi |
| --- | --- | --- | --- | --- | --- |
| T01 | Đã qua | Phân tích backend cũ và chốt ranh giới 7 microservice | Người 1 | Đã có nền tảng | Có sơ đồ luồng và bảng service sở hữu dữ liệu; không service nào truy vấn DB của service khác. |
| T02 | Đã qua | Dựng Docker Compose, MySQL 7 database và khung FastAPI | Người 1 | Đã có | `docker compose up -d --build` làm 7 API và MySQL healthy; mỗi service có `/ready`, `/docs`. |
| T03 | Đã qua | Hoàn thiện Identity và Registry cơ bản | Người 1 | Đã có API/test cơ bản | Đăng ký/đăng nhập, tài khoản nhân viên, liên kết hồ sơ, danh mục và phân quyền API cơ bản chạy bằng MySQL. |
| T04 | Đã qua | Làm Scheduling và Appointment API đặt/hủy lịch | Người 1 | API đã có; frontend chưa nối | Giữ/confirm/release slot, idempotency và API đặt/hủy lịch có test; không đặt trùng chỗ cuối. |
| T05 | Đã qua | Chuyển dữ liệu lịch sử, export MySQL và hướng dẫn nhóm chạy | Người 1 | Đã có | Dữ liệu lịch sử có nguồn gốc rõ; dump đã export/thử import, người quản lý gửi riêng và có hướng dẫn clone/chạy. |
| T06 | S1 | Chốt hợp đồng API và trạng thái cho luồng khám đầu-cuối | Người 1 | Chưa chốt hết | Thống nhất sequence đặt lịch → thanh toán → check-in → khám → xét nghiệm; định nghĩa trạng thái, lỗi, timeout, retry, quyền và OpenAPI cho 7 service. |
| T07 | S1–S2 | Nối frontend bệnh nhân với Appointment và hoàn thiện check-in/hàng chờ | Người 1 | Frontend còn gọi backend cũ | Bệnh nhân đặt/xem/hủy lịch; lễ tân check-in, bác sĩ xem hàng chờ qua API mới; không gọi cổng 8000 cho các màn này. |
| T08 | S1–S3 | Xây Billing: bảng, API hóa đơn, thanh toán mô phỏng, hoàn tiền, báo cáo | Người 2 | Mới có khung/history | Tạo hóa đơn từ lịch hẹn, cập nhật giao dịch idempotent, hoàn tiền khi hủy theo quy tắc; màn thanh toán/báo cáo dùng API mới. |
| T09 | S2–S4 | Xây Clinical: lượt khám, chẩn đoán, đơn thuốc, điều trị | Người 1 | Mới có khung/history | Bác sĩ chỉ mở lịch đã check-in, lưu kết quả khám/đơn thuốc; bệnh nhân xem bệnh sử của mình; có test quyền và trạng thái. |
| T10 | S2–S4 | Xây Laboratory: chỉ định, nhận mẫu, cập nhật và xem kết quả | Người 2 | Mới có khung/history | Clinical tạo chỉ định qua API; xét nghiệm viên xử lý, bác sĩ/bệnh nhân xem kết quả theo quyền; frontend dùng API mới. |
| T11 | S4–S5 | Hoàn thiện orchestration và bù trừ giữa Appointment–Scheduling–Billing–Clinical–Laboratory | Người 1 | Mới có điều phối Appointment–Scheduling | Retry/timeout không tạo trùng lịch hoặc hóa đơn; hủy lịch giải phóng slot và xử lý hoàn tiền; có test lỗi ở từng bước. |
| T12 | S5–S6 | Bỏ đường gọi backend cũ, rà soát phân quyền và bảo vệ dữ liệu | Người 2 | Frontend còn `legacyFetch` | Các màn nằm trong phạm vi đồ án không gọi `:8000`; mọi API nghiệp vụ kiểm token/vai trò; không lộ CCCD, hồ sơ hoặc secret trong log/response sai quyền. |
| T13 | S5–S6 | Chốt OpenAPI, test hợp đồng/tích hợp và CI | Người 2 | OpenAPI tự sinh, test không đều giữa service | 7 bản `/openapi.json` có schema, mã lỗi và ví dụ nhất quán; test tự động chạy trên PR, gồm đăng ký → đặt lịch → thanh toán → khám → xét nghiệm. |
| T14 | S6–S7 | Định nghĩa SLA/QoS từng service và chạy kiểm thử tải k6 | Người 1 | Có k6 Identity/Registry/Scheduling đọc, chưa có tải luồng ghi | Mỗi service có SLI/SLO **đề xuất** (p95, lỗi, throughput, timeout, khả dụng) và môi trường đo; k6 có kịch bản đặt lịch/giữ slot/thanh toán song song, báo cáo kết quả và lỗi. |
| T15 | S7–S8 | Kiểm thử nghiệm thu, backup/restore và demo cuối | Người 2 | Có hướng dẫn import cơ bản | Từ clone sạch + dump riêng chạy được toàn bộ luồng; test backend/frontend đạt, lỗi nghiêm trọng đã sửa; có video/kịch bản demo, sơ đồ, OpenAPI, báo cáo tải và hướng dẫn vận hành. |

## Thứ tự phối hợp mỗi sprint

1. Đầu sprint: Người 1 và Người 2 chốt API của phần giao nhau, rồi chia nhánh/task; mỗi task ghi rõ endpoint, dữ liệu sở hữu và điều kiện nghiệm thu.
2. Trong sprint: hai người làm song song các task không phụ thuộc; người còn lại review PR trước khi gộp `main`. Không đẩy dump MySQL, `.env` hay thông tin bệnh nhân lên repo public.
3. Cuối sprint: chạy `pytest`, `npm.cmd run build`, smoke test Docker và một kịch bản nghiệp vụ; ghi lại bug thành task. Chỉ đánh dấu Done khi mã, test và tài liệu cùng đạt.

## Định nghĩa “kết thúc”

Một người mới clone repo, nhận dump qua kênh riêng và làm theo README phải chạy được hệ thống. Luồng tối thiểu không dùng backend cũ: **đăng nhập → chọn dịch vụ/bác sĩ/ca → đặt lịch → thanh toán mô phỏng → check-in → khám → chỉ định/trả kết quả xét nghiệm → xem lịch sử**. Không đặt trùng slot khi nhiều người dùng đồng thời. Bảy service có OpenAPI, test và chỉ tiêu QoS đo được; báo cáo k6 ghi cấu hình máy, mức tải, p95/tỷ lệ lỗi và giới hạn của phép đo. Không gọi chỉ tiêu test local là SLA production khi chưa có triển khai và giám sát tương ứng.

Tham khảo: [FastAPI tạo OpenAPI và `/docs`](https://fastapi.tiangolo.com/tutorial/first-steps/), [k6 dùng thresholds làm điều kiện pass/fail](https://grafana.com/docs/k6/latest/using-k6/thresholds/), [Google SRE về SLI/SLO](https://sre.google/workbook/implementing-slos/).
