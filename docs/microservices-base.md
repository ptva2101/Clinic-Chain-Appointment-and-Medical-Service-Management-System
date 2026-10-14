# Nền tảng 7 service

Đây là nền tảng chuyển dần backend nguyên khối thành bảy tiến trình FastAPI độc lập. Identity có đăng ký/đăng nhập; Registry có hồ sơ và danh mục; Scheduling có lịch trực/slot/giữ chỗ; Appointment có API đặt/hủy lịch và điều phối với Scheduling. Billing, Clinical và Laboratory hiện chủ yếu là khung service và API đọc dữ liệu lịch sử. Frontend còn gọi `Backend/` cũ ở cổng 8000 cho nhiều màn hình nghiệp vụ, nên chưa có luồng khám bệnh trọn vẹn chỉ bằng Compose. Xem [hướng dẫn chạy từ đầu](../README.md).

| Service | Cổng local | Database riêng | Dữ liệu sẽ sở hữu |
| --- | ---: | --- | --- |
| Identity | 8001 | `identity_db` | Tài khoản, mật khẩu băm, vai trò, phiên đăng nhập |
| Registry | 8002 | `registry_db` | Bệnh nhân, bác sĩ, nhân viên, chi nhánh, dịch vụ, BHYT |
| Scheduling | 8003 | `scheduling_db` | Lịch trực, slot, giữ slot |
| Appointment | 8004 | `appointment_db` | Lịch hẹn, check-in, hàng đợi, trạng thái Saga |
| Billing | 8005 | `billing_db` | Hóa đơn, thanh toán mô phỏng, hoàn tiền |
| Clinical | 8006 | `clinical_db` | Lượt khám, chẩn đoán, đơn thuốc, điều trị |
| Laboratory | 8007 | `laboratory_db` | Chỉ định xét nghiệm, kết quả |

Scheduling đã có API lịch trực và giữ slot; Appointment đã có API đặt/hủy lịch phối hợp qua HTTP với Scheduling. Việc hủy/chuyển ca trực có lịch hẹn, thanh toán, khám và xét nghiệm đầu-cuối vẫn chưa hoàn tất. Xem [Scheduling](scheduling-service.md) và [Appointment](appointment-service.md).

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

## Bước tiếp theo

1. Chuyển các lời gọi frontend còn dùng `Backend/` sang API Appointment, Billing, Clinical và Laboratory mới; bảo vệ endpoint bằng Identity.
2. Hoàn thiện thanh toán, check-in, khám và xét nghiệm cùng cơ chế bù trừ khi nhiều service phối hợp.
3. Bổ sung metrics, SLA/QoS và kiểm thử tải cho luồng ghi; kịch bản k6 hiện có chỉ đo GET lịch trực Scheduling.

Chỉ chuyển qua API/event giữa các service. Không truy vấn trực tiếp database của service khác. Backend cũ và file SQLite `Backend/hospital.db` không tham gia vào Compose này; dữ liệu MySQL Docker cũng không đi theo Git.
