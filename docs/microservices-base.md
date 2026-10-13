# Nền tảng 7 service

Đây là bộ khung cho quá trình tách backend hiện tại. Bảy service là bảy tiến trình FastAPI độc lập. **Identity đã có API đăng ký/đăng nhập; Registry đã có hồ sơ bệnh nhân/nhân viên và danh mục chi nhánh/dịch vụ lưu thật**. Các nghiệp vụ khác chưa chuyển từ `Backend/`. Giao diện dùng Identity và Registry cho tài khoản/hồ sơ/danh mục cơ bản; nhiều màn hình nghiệp vụ vẫn gọi backend cũ ở cổng 8000 hoặc còn dữ liệu mẫu. Đây chưa phải hệ thống đặt lịch hoàn chỉnh.

| Service | Cổng local | Database riêng | Dữ liệu sẽ sở hữu |
| --- | ---: | --- | --- |
| Identity | 8001 | `identity_db` | Tài khoản, mật khẩu băm, vai trò, phiên đăng nhập |
| Registry | 8002 | `registry_db` | Bệnh nhân, bác sĩ, nhân viên, chi nhánh, dịch vụ, BHYT |
| Scheduling | 8003 | `scheduling_db` | Lịch trực, slot, giữ slot |
| Appointment | 8004 | `appointment_db` | Lịch hẹn, check-in, hàng đợi, trạng thái Saga |
| Billing | 8005 | `billing_db` | Hóa đơn, thanh toán mô phỏng, hoàn tiền |
| Clinical | 8006 | `clinical_db` | Lượt khám, chẩn đoán, đơn thuốc, điều trị |
| Laboratory | 8007 | `laboratory_db` | Chỉ định xét nghiệm, kết quả |

Scheduling đã có API xem/xếp ca trực bác sĩ lưu MySQL; xem [Scheduling service](scheduling-service.md). Slot giữ chỗ, đặt lịch và phối hợp hủy/chuyển ca với Appointment/Billing chưa hoàn tất.

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

1. Hoàn thiện hồ sơ Registry và chốt OpenAPI nghiệp vụ còn thiếu cho từng service.
2. Di chuyển tài khoản cũ vào Identity, ngừng lưu mật khẩu ở các bảng nghiệp vụ và chuyển frontend sang JWT. Xem [Identity service](identity-service.md).
3. Tách Registry, Scheduling, Appointment, Billing, Clinical và Laboratory lần lượt, có kiểm thử hồi quy sau mỗi bước.
4. Thêm API Gateway và orchestration đặt lịch; frontend chỉ gọi Gateway khi các API mới đã thay thế luồng cũ.
5. Bổ sung metrics, SLA/QoS và kiểm thử tải k6.

Chỉ chuyển qua API/event giữa các service. Không truy vấn trực tiếp database của service khác. Backend cũ và file SQLite `Backend/hospital.db` không tham gia vào Compose này.
