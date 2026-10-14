# Medicare — hệ thống đặt lịch khám và quản lý dịch vụ phòng khám

Repo này đang **chuyển đổi từ backend nguyên khối sang kiến trúc 7 microservice**. Bản chạy local gồm một frontend React/Vite, bảy ứng dụng FastAPI độc lập và một container MySQL chứa bảy database riêng. Đây là bản phát triển/demo, **chưa phải luồng khám bệnh hoàn chỉnh hoặc môi trường production**.

## Bắt đầu nhanh trên Windows

Cần Git, Docker Desktop đang chạy và Node.js phù hợp với Vite (`20.19+` hoặc `22.12+`). Không cần cài Python nếu chỉ chạy các service qua Docker; Python 3.12 dùng cho script nhập dữ liệu và chạy test local.

Nếu cần **đúng dữ liệu trên máy xuất**, nhận file dump qua kênh riêng và làm theo [hướng dẫn import MySQL](data/mysql/README.md) **trước khi chạy toàn bộ service**. File dump không có trong repo public.

Thành viên mới có thể làm lần lượt theo [hướng dẫn clone, import dữ liệu và chạy toàn hệ thống](docs/team-setup.md).

```powershell
git clone https://github.com/ptva2101/Clinic-Chain-Appointment-and-Medical-Service-Management-System.git
cd Clinic-Chain-Appointment-and-Medical-Service-Management-System
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

Ở terminal thứ hai, trong thư mục gốc repo:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Mở `http://127.0.0.1:5173/`. Kiểm tra một service bằng `Invoke-RestMethod http://127.0.0.1:8001/ready`; đổi `8001` sang cổng khác trong bảng dưới đây. Tài liệu OpenAPI tương tác ở `http://127.0.0.1:8001/docs` và tương tự cho các service còn lại.

Sau khi import, tài khoản admin và các tài khoản khác dùng mật khẩu có tại thời điểm export; hỏi người quản lý nhóm qua kênh riêng nếu chưa biết mật khẩu. `IDENTITY_ADMIN_USERNAME` và `IDENTITY_ADMIN_PASSWORD` trong `.env` chỉ tạo admin **khi database chưa có admin**, không đổi mật khẩu của admin đã import. Đổi các secret mẫu trước khi chia sẻ môi trường. File `.env` không được commit.

## Từ repo cũ sang microservice

`Backend/` là backend FastAPI nguyên khối của repo cũ. Nghiệp vụ đang được chuyển dần sang `services/`; mỗi service sở hữu schema và database của mình, trao đổi qua API thay vì truy vấn database của service khác.

| Service | Cổng local | Database | Phần đã có |
| --- | ---: | --- | --- |
| Identity | 8001 | `identity_db` | Đăng ký/đăng nhập, quản lý tài khoản và phiên |
| Registry | 8002 | `registry_db` | Hồ sơ bệnh nhân/nhân viên, chi nhánh và danh mục dịch vụ |
| Scheduling | 8003 | `scheduling_db` | Lịch trực, khả dụng slot và giữ chỗ tạm |
| Appointment | 8004 | `appointment_db` | API đặt/hủy lịch, điều phối giữ và xác nhận slot tại Scheduling |
| Billing | 8005 | `billing_db` | Khung service và tra cứu bản ghi lịch sử; nghiệp vụ thanh toán chưa chuyển đầy đủ |
| Clinical | 8006 | `clinical_db` | Khung service và tra cứu bản ghi lịch sử; nghiệp vụ khám chưa chuyển đầy đủ |
| Laboratory | 8007 | `laboratory_db` | Khung service và tra cứu bản ghi lịch sử; nghiệp vụ xét nghiệm chưa chuyển đầy đủ |

MySQL trong Docker được mở ra máy host ở `127.0.0.1:3307`; dữ liệu lưu trong Docker volume `mysql_data`. `docker compose down` dừng container nhưng giữ dữ liệu. **Không dùng `docker compose down -v` nếu cần giữ dữ liệu**, vì lệnh đó xóa volume.

Frontend dùng các API trong `Frontend/src/api/`. Đăng nhập/hồ sơ/danh mục/lịch trực đã gọi service mới. Tuy nhiên, đặt lịch trên giao diện, check-in, báo cáo, khám và xét nghiệm vẫn còn gọi backend cũ tại `http://127.0.0.1:8000` qua `Frontend/src/api/legacy.js`. `Backend/` **không nằm trong `compose.yaml`**; database `clinic` mà backend cũ yêu cầu cũng không được Compose tạo. Vì vậy quickstart ở trên chạy được phần microservice và giao diện, nhưng một số màn hình nghiệp vụ sẽ báo lỗi nếu không có môi trường backend cũ riêng. API Appointment mới có tại cổng 8004, song frontend chưa chuyển toàn bộ luồng đặt lịch sang API này.

## Dữ liệu khi clone

Repo cũ có dữ liệu **mẫu/mô phỏng** trong `Backend/hospital.db`, `Backend/init_db.py`, các file SQL và một số mảng frontend. `hospital.db` là SQLite cũ; bảy service mới **không đọc file này khi chạy**. Bản dump MySQL của cả 7 service **không nằm trong repo public** vì có dữ liệu cá nhân; người quản lý nhóm gửi riêng file `medicare-7db-2026-10-14.sql.gz`. Sau khi clone, làm theo [hướng dẫn import](data/mysql/README.md) trên **MySQL volume mới** để có cùng dữ liệu ở thời điểm export. Đây là bản chụp tĩnh, không đồng bộ thay đổi sau này.

Nếu cần bộ dữ liệu demo cũ, làm theo [hướng dẫn nhập dữ liệu lịch sử](docs/demo-history-import.md). Công cụ kiểm kê trước khi ghi, nhập bản ghi vào đúng service và đánh dấu dữ liệu cũ là lịch sử/mẫu; công cụ kích hoạt tài khoản nhân viên mẫu là bước riêng, chỉ dành cho local. Không dùng dữ liệu hoặc mật khẩu mẫu cho bệnh nhân thật. Cần clone đầy đủ lịch sử Git để khôi phục cả dữ liệu mẫu đã bị xóa khỏi mã nguồn hiện tại.

## Kiểm tra và tài liệu

```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:8001/ready
Invoke-RestMethod http://127.0.0.1:8004/ready
```

Chạy test Python trong image, không cần cài Python trên máy:

```powershell
docker build --target test -t medicare-services-test ./services
docker run --rm medicare-services-test
```

Kiểm tra frontend: trong `Frontend/`, chạy `npm.cmd run build`. Bài kiểm thử tải k6 hiện có tại `services/load/scheduling.js` chỉ đo API **GET lịch trực** của Scheduling; chưa chứng minh SLA cho toàn bộ luồng đặt lịch.

Tài liệu chi tiết: [nền tảng microservice](docs/microservices-base.md), [Identity](docs/identity-service.md), [Registry](docs/registry-service.md), [Scheduling](docs/scheduling-service.md), [Appointment](docs/appointment-service.md) và [ranh giới frontend](docs/frontend-services.md). Một số tài liệu cũ mô tả trạng thái của thời điểm triển khai trước đó; khi có khác biệt, kiểm tra mã nguồn và OpenAPI đang chạy.

## Nguồn gốc dự án

Dự án Medicare ban đầu là bài tập lớn môn Phân tích và Thiết kế Hệ thống Thông tin, Đại học Công nghệ — Đại học Quốc gia Hà Nội. Thành viên được ghi trong README gốc: Trần Phương Phương, Nguyễn Hoàng Hà Anh, Phạm Ngọc Huyền và Phạm Thúc Việt Anh. Phần chuyển đổi microservice trong nhánh này tiếp tục phát triển từ repo đó.
