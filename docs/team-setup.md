# Hướng dẫn thành viên mới: import dữ liệu Docker và chạy hệ thống

Làm theo hướng dẫn này trên **máy mới clone repo**, bằng PowerShell. Hệ thống gồm frontend React/Vite, 7 microservice FastAPI và MySQL trong Docker. Bản dữ liệu được chia sẻ là ảnh chụp tại ngày **14/10/2026**, không tự đồng bộ khi có thay đổi trên máy người khác.

## 1. Chuẩn bị

- Cài Git, Docker Desktop và Node.js tương thích với `Frontend/package.json` (Node 20.19+ hoặc 22.12+). Mở Docker Desktop trước khi chạy lệnh. Không cần cài Python nếu chỉ chạy bằng Docker.
- Nhận riêng file `medicare-7db-2026-10-14.sql.gz` từ người quản lý nhóm. **File này không nằm trong GitHub** vì repo public và dump có thể chứa CCCD, số điện thoại, hồ sơ, mã băm mật khẩu. Không đăng file lên repo, issue hoặc nhóm chat công khai.
- Xin thông tin đăng nhập thử qua kênh riêng. Mật khẩu tài khoản trong dump là mật khẩu tại thời điểm export; `.env.example` không đổi mật khẩu đã lưu trong MySQL.

## 2. Clone code và đặt file dump

```powershell
git clone https://github.com/ptva2101/Clinic-Chain-Appointment-and-Medical-Service-Management-System.git
cd Clinic-Chain-Appointment-and-Medical-Service-Management-System
git branch --show-current
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Mặc định bạn đang ở nhánh `main`; nhánh `anhhuy080905` tại thời điểm viết hướng dẫn có cùng code. Chép file đã nhận vào `data/mysql/medicare-7db-2026-10-14.sql.gz`, rồi kiểm tra file:

```powershell
$dumpPath = 'data/mysql/medicare-7db-2026-10-14.sql.gz'
if (-not (Test-Path $dumpPath)) { throw 'Chưa có file dump; hãy chép file đã nhận vào data/mysql.' }
$actualHash = (Get-FileHash $dumpPath -Algorithm SHA256).Hash
if ($actualHash -ne '397239D884A733FEEAACA47FC5441D00DE9CF5014E34CA4D141470320FE924BC') { throw 'SHA-256 không khớp; không import file này.' }
```

Nếu `Get-FileHash` trả về đúng hash trên thì tiếp tục. File `.env` được tạo từ mẫu để chạy local; **không cần xin `.env` của máy cũ** và không commit `.env` lên Git.

## 3. Import vào MySQL Docker

Chỉ làm bước này khi Docker volume MySQL của dự án trên máy bạn **chưa chứa dữ liệu cần giữ**. Nếu đã từng chạy dự án và tạo tài khoản/lịch hẹn trên máy này, dừng lại, sao lưu và trao đổi trong nhóm trước khi import: dump có thể ghi đè bảng hiện có. **Không chạy `docker compose down -v` để “làm sạch”**, vì lệnh đó xóa volume và dữ liệu không thể khôi phục nếu chưa sao lưu.

Từ thư mục gốc repo:

```powershell
docker compose up -d --wait mysql
docker compose cp data/mysql/medicare-7db-2026-10-14.sql.gz mysql:/tmp/medicare-7db-2026-10-14.sql.gz
docker compose exec -T mysql sh -c 'gzip -t /tmp/medicare-7db-2026-10-14.sql.gz && gzip -dc /tmp/medicare-7db-2026-10-14.sql.gz | MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
```

Lệnh import chạy một lần trên volume mới; không lặp lại sau khi bắt đầu sử dụng hệ thống. Kiểm tra số bản ghi mà không in dữ liệu cá nhân:

```powershell
docker compose cp data/mysql/verify.sql mysql:/tmp/verify.sql
docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot < /tmp/verify.sql'
```

Bản chụp này có **30 tài khoản**, **27 hồ sơ nhân viên** và **1 hồ sơ bệnh nhân**; các bảng lịch sử khác cũng phải có số bản ghi. Nếu lệnh import báo lỗi, không chạy ứng dụng tiếp hoặc import lại nhiều lần; kiểm tra file/hash, trạng thái MySQL và nhờ nhóm hỗ trợ.

## 4. Chạy 7 service và frontend

Trong terminal đang ở thư mục gốc repo:

```powershell
docker compose up -d --build --wait
docker compose ps
Invoke-RestMethod http://127.0.0.1:8001/ready
Invoke-RestMethod http://127.0.0.1:8004/ready
```

MySQL dùng cổng `3307` trên máy; Identity–Laboratory lần lượt dùng `8001`–`8007`. Mở **terminal PowerShell thứ hai** tại thư mục gốc repo:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Mở `http://127.0.0.1:5173/` và đăng nhập bằng tài khoản đã được nhóm cung cấp. API OpenAPI của từng service ở `http://127.0.0.1:8001/docs` đến `http://127.0.0.1:8007/docs`.

## 5. Khi chạy lại hoặc gặp lỗi

- Lần sau chỉ cần mở Docker Desktop, chạy `docker compose up -d` ở gốc repo, rồi `npm.cmd run dev` trong `Frontend/`. Không import lại dump.
- `docker compose down` dừng container nhưng **giữ** MySQL volume. Không dùng `docker compose down -v` nếu cần giữ dữ liệu.
- Nếu một service không healthy, chạy `docker compose ps` và `docker compose logs --tail=100 <ten-service>` (ví dụ `identity`, `registry`, `mysql`). Che dữ liệu cá nhân trước khi gửi log cho nhóm.
- Nếu cổng `3307`, `8001`–`8007` hoặc `5173` đã bị chương trình khác dùng, đóng chương trình đó hoặc thống nhất cách đổi cổng; không sửa mỗi máy một kiểu mà không báo nhóm.
- Frontend hiện gọi 7 microservice ở cổng `8001`–`8007`; `Backend/` cũ không nằm trong Docker Compose. Các luồng chưa chuyển đầy đủ (hoàn tiền, BHYT, báo cáo chi tiết) vẫn có giới hạn như bảng trong [README](../README.md#trạng-thái-chức-năng).
- Git chỉ đồng bộ **code**. Dữ liệu sau khi import nằm trong Docker volume riêng của mỗi máy; `git pull` không cập nhật MySQL. Muốn chia sẻ dữ liệu mới, cần một bản dump mới gửi riêng.
- Bản dump ngày 14/10 còn 248 ca trực tháng 6–7/2026. Nếu cần dời riêng các ca demo sang 01/10–01/11/2026 để thử đặt lịch, xem lệnh một lần trong [README](../README.md#dữ-liệu-khi-clone); thao tác này không dời lịch hẹn/bệnh án lịch sử.

Chi tiết kỹ thuật của bản dump và checksum: [data/mysql/README.md](../data/mysql/README.md).
