# Medicare — chạy dự án trên máy mới

Hướng dẫn cho Windows/PowerShell. Cần **Git, Docker Desktop đang chạy và Node.js 20.19+ hoặc 22.12+**. Không cần cài Python: 7 microservice chạy trong Docker. Backend cũ trong `Backend/` không cần khởi động.

## 1. Clone code và nhận dữ liệu

```powershell
git clone --branch anhhuy080905 https://github.com/ptva2101/Clinic-Chain-Appointment-and-Medical-Service-Management-System.git
cd Clinic-Chain-Appointment-and-Medical-Service-Management-System
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Nhận riêng file `medicare-7db-2026-10-14.sql.gz` từ người quản lý nhóm và đặt tại `data/mysql/medicare-7db-2026-10-14.sql.gz`. File chứa dữ liệu cá nhân nên **không có trên GitHub và không được commit**. Không cần xin `.env` của máy cũ; hỏi thông tin đăng nhập qua kênh riêng. `.env` không đổi mật khẩu đã có trong database.

## 2. Import MySQL và chạy 7 service

**Chỉ import trên MySQL volume mới/chưa có dữ liệu cần giữ.** Import lại có thể ghi đè dữ liệu đã tạo trên máy bạn.

```powershell
$dump = 'data/mysql/medicare-7db-2026-10-14.sql.gz'
if (-not (Test-Path $dump)) { throw 'Chưa có file dump được gửi riêng.' }
if ((Get-FileHash $dump -Algorithm SHA256).Hash -ne '397239D884A733FEEAACA47FC5441D00DE9CF5014E34CA4D141470320FE924BC') { throw 'File dump không đúng bản đã kiểm tra.' }
docker compose up -d --wait mysql
docker compose cp $dump mysql:/tmp/medicare-7db-2026-10-14.sql.gz
docker compose exec -T mysql sh -c 'gzip -t /tmp/medicare-7db-2026-10-14.sql.gz && gzip -dc /tmp/medicare-7db-2026-10-14.sql.gz | MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
docker compose up -d --build --wait
docker compose exec scheduling python -m demo_import.shift_schedule_oct2026 --apply
docker compose ps
```

Lệnh `shift_schedule_oct2026 --apply` dời **248 ca trực demo** từ 01/06–01/07 sang 01/10–01/11/2026 như máy hiện tại; chạy lại sẽ không dời lần nữa. Lịch hẹn và bệnh án cũ vẫn là dữ liệu lịch sử. Nếu không có file dump, có thể chạy `docker compose up -d --build --wait` để tạo database rỗng, nhưng sẽ không có sẵn tài khoản và dữ liệu của nhóm.

## 3. Chạy giao diện

Mở PowerShell thứ hai tại thư mục repo:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Mở **http://127.0.0.1:5173/**. API của 7 service ở cổng `8001`–`8007`; ví dụ kiểm tra `http://127.0.0.1:8001/ready`.

Những lần sau chỉ cần `docker compose up -d` ở gốc repo và `npm.cmd run dev` trong `Frontend/`; **không import lại dump**. `docker compose down` giữ dữ liệu MySQL, còn `docker compose down -v` **xóa volume và dữ liệu**.

Git chỉ đồng bộ code. Dump ngày 14/10/2026 là bản chụp tĩnh; thay đổi dữ liệu sau thời điểm đó trên máy người xuất **không tự sang máy khác**. Muốn giống máy hiện tại 100%, cần người quản lý xuất **dump mới** và gửi riêng sau khi đã commit/push code. Xem [hướng dẫn import chi tiết](data/mysql/README.md) khi gặp lỗi.
