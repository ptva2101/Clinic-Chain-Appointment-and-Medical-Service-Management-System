# Medicare — chạy dự án trên máy mới

Hướng dẫn cho Windows/PowerShell. Cần **Git, Docker Desktop đang chạy và Node.js 20.19+ hoặc 22.12+**. Không cần cài Python: 7 microservice và worker hòa giải lịch của Appointment chạy trong Docker. Backend cũ trong `Backend/` không cần khởi động.

## 1. Clone code và nhận dữ liệu

```powershell
git clone --branch anhhuy080905 https://github.com/ptva2101/Clinic-Chain-Appointment-and-Medical-Service-Management-System.git
cd Clinic-Chain-Appointment-and-Medical-Service-Management-System
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Nhận riêng file `clinic-7db-complete-2026-10-23.sql.gz` từ người quản lý nhóm và đặt vào thư mục `data/mysql/`. Đây là ảnh chụp 7 database đang chạy trên máy nhóm ngày 23/10/2026. File có CCCD, số điện thoại, thông tin BHYT và mã băm mật khẩu nên **không có trên GitHub và không được commit**. Không cần xin `.env` của máy cũ; hỏi thông tin đăng nhập qua kênh riêng. `.env` không đổi mật khẩu đã có trong database.

## 2. Import MySQL và chạy 7 service + worker

**Chỉ import trên MySQL volume mới/chưa có dữ liệu cần giữ.** Import lại có thể ghi đè dữ liệu đã tạo trên máy bạn.

```powershell
$dump = 'data/mysql/clinic-7db-complete-2026-10-23.sql.gz'
if (-not (Test-Path $dump)) { throw 'Chưa có file dump được gửi riêng.' }
if ((Get-FileHash $dump -Algorithm SHA256).Hash -ne '622D5E2BF7C7B5743EB39D8EFEA7F438E6E4CCD12EF4C596C00F020D2BBB0616') { throw 'File dump không đúng bản đã kiểm tra.' }
docker compose up -d --wait mysql
docker compose cp $dump mysql:/tmp/clinic-7db-complete-2026-10-23.sql.gz
docker compose exec -T mysql sh -c 'gzip -t /tmp/clinic-7db-complete-2026-10-23.sql.gz && gzip -dc /tmp/clinic-7db-complete-2026-10-23.sql.gz | MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
docker compose up -d --build --wait
docker compose ps
Get-Content -Raw -Encoding utf8 data/mysql/verify.sql | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot -N'
```

File export mới đã gồm 1.976 ca trực và dữ liệu hiện tại của cả 7 service; **không chạy lại các script nhập dump cũ hay dời lịch** sau khi import file này. Nếu không có file dump, có thể chạy `docker compose up -d --build --wait` để tạo database rỗng, nhưng sẽ không có sẵn tài khoản và dữ liệu của nhóm.

## 3. Chạy giao diện

Mở PowerShell thứ hai tại thư mục repo:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Mở **http://127.0.0.1:5173/**. API của 7 service ở cổng `8001`–`8007`; ví dụ kiểm tra `http://127.0.0.1:8001/ready`.

Những lần sau chỉ cần `docker compose up -d` ở gốc repo và `npm.cmd run dev` trong `Frontend/`; **không import lại dump**. `docker compose down` giữ dữ liệu MySQL, còn `docker compose down -v` **xóa volume và dữ liệu**.

Git chỉ đồng bộ code. Dump ngày 23/10/2026 là bản chụp tĩnh; thay đổi dữ liệu sau thời điểm đó trên máy người xuất **không tự sang máy khác**. Nếu có thay đổi sau này, cần xuất dump mới và gửi riêng. Xem [hướng dẫn import chi tiết](data/mysql/README.md) khi gặp lỗi.

Nếu chỉ có dump monolith `clinic-2026-10-22_15-09-09-m1km21dy.sql` thay vì bản export 7 database ở trên, xem [cách nhập dữ liệu cũ](docs/mysql-dump-import.md); không import trực tiếp dump monolith bằng MySQL.

Tài liệu nộp đề tài: [ranh giới 7 service, OpenAPI và orchestration](docs/microservices-base.md); [SLO/QoS và kết quả kiểm thử tải](docs/qos.md).
