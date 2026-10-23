# Nền tảng 7 service

Hệ thống hiện chạy bảy tiến trình FastAPI độc lập bằng Docker Compose, mỗi service sở hữu một database MySQL và công bố OpenAPI riêng. Frontend gọi API của các service ở cổng 8001–8007; `Backend/` cũ và database `clinic` không tham gia runtime. Luồng E2E tổng hợp đã đi qua đăng ký, BHYT, đặt lịch, hóa đơn, check-in, khám, xét nghiệm và báo cáo. Xem [hướng dẫn chạy từ đầu](../README.md) và [kiểm thử/QoS](qos.md).

| Service | Cổng local | Database riêng | Dữ liệu sở hữu |
| --- | ---: | --- | --- |
| Identity | 8001 | `identity_db` | Tài khoản, mật khẩu băm, vai trò, phiên đăng nhập |
| Registry | 8002 | `registry_db` | Bệnh nhân, bác sĩ, nhân viên, chi nhánh, dịch vụ, BHYT |
| Scheduling | 8003 | `scheduling_db` | Lịch trực, slot, giữ slot |
| Appointment | 8004 | `appointment_db` | Lịch hẹn, check-in, hàng đợi, trạng thái Saga |
| Billing | 8005 | `billing_db` | Hóa đơn, thanh toán mô phỏng, hoàn tiền |
| Clinical | 8006 | `clinical_db` | Lượt khám, chẩn đoán, đơn thuốc, điều trị |
| Laboratory | 8007 | `laboratory_db` | Chỉ định xét nghiệm, kết quả |

## Hợp đồng API và phối hợp dịch vụ

Mỗi service có `/docs` và `/openapi.json`; đặt cổng theo bảng trên, ví dụ `http://127.0.0.1:8004/docs` cho Appointment. Các service gọi nhau qua HTTP có token nội bộ hoặc token Identity, không truy vấn database của service khác.

- **Đặt lịch (orchestration):** Appointment giữ slot ở Scheduling, ghi lịch `pending`, xác nhận hold và chuyển `confirmed`. Nếu kết quả không chắc chắn do timeout, worker `appointment-reconciler` hỏi lại Scheduling và hoàn tất hoặc bù trừ; idempotency key chống tạo trùng. Hủy lịch giải phóng slot; nếu Billing báo `paid` thì chặn hủy cho tới khi admin hoàn tiền.
- **Hóa đơn/BHYT:** Billing xác nhận lịch ở Appointment, lấy giá và BHYT đã xác minh qua API Registry, chụp giá/giảm trừ vào hóa đơn. Thanh toán và hoàn tiền trong phạm vi demo là giả lập, không có cổng ngân hàng. Xác minh thẻ BHYT do admin thực hiện thủ công.
- **Khám và xét nghiệm:** Receptionist check-in lịch đã thanh toán; bác sĩ lưu lượt khám ở Clinical và chỉ định qua Laboratory. Kỹ thuật viên trả kết quả, bác sĩ hoàn tất khám; bệnh nhân xem lịch sử qua API từng service.

Xem [Scheduling](scheduling-service.md), [Appointment](appointment-service.md) và [BHYT/Billing](insurance-billing.md) để biết ranh giới và quy tắc cụ thể. Chuyển/hủy ca trực đang có lịch hẹn không được thực hiện trực tiếp, tránh làm mất lịch của bệnh nhân.

## Chạy local

Cần Docker Desktop đang chạy. Tại thư mục gốc repo:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

Mỗi service cung cấp `GET /health`, `GET /ready`, `/docs` và `/openapi.json`. Ví dụ:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
Invoke-RestMethod http://127.0.0.1:8001/ready
```

Mở `http://127.0.0.1:8001/docs` cho Identity; thay `8001` bằng cổng trong bảng để xem service khác. `/health` kiểm tra tiến trình. `/ready` thực sự thử kết nối database của service, trả HTTP 503 nếu không kết nối được.

MySQL được ánh xạ ra `127.0.0.1:3307` để không xung đột với MySQL local cổng 3306. Script trong `infra/mysql/init/` tạo bảy database và tài khoản riêng **chỉ khi volume MySQL được khởi tạo lần đầu**. Mật khẩu trong Compose và script SQL chỉ dành cho máy phát triển; triển khai thật cần đưa chúng vào secret và không công khai cổng database.

Chạy bài kiểm tra bộ khung khi Docker hoạt động:

```powershell
docker build --target test -t medicare-services-test ./services
docker run --rm medicare-services-test
```

## Giới hạn demo

[QoS](qos.md) định nghĩa mục tiêu p95 và tỷ lệ thành công cho từng service, kèm kết quả đo local; đây chưa phải SLA production. Chưa tích hợp cơ quan BHYT, ngân hàng, xử lý chuyển/hủy ca có lịch hẹn hay giám sát đa máy. Không dùng mật khẩu/secret mẫu của Compose khi triển khai thật. Dữ liệu MySQL Docker không đi theo Git; bản dump chứa dữ liệu cá nhân phải gửi riêng.
