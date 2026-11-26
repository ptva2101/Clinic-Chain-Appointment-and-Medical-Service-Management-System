# Medicare — chạy dự án trên máy mới

Hướng dẫn cho Windows/PowerShell. Cần **Git, Docker Desktop đang chạy và Node.js 20.19+ hoặc 22.12+**. Không cần cài Python: 7 microservice và worker hòa giải lịch của Appointment chạy trong Docker. Backend cũ trong `Backend/` không cần khởi động.

## 1. Clone code và nhận dữ liệu

```powershell
git clone --branch main https://github.com/ptva2101/Clinic-Chain-Appointment-and-Medical-Service-Management-System.git
cd Clinic-Chain-Appointment-and-Medical-Service-Management-System
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Nhận riêng file `clinic-medicare-7db-2026-11-12.sql.gz` và đặt vào thư mục `data/mysql/`. Đây là bộ 7 database sau cơ cấu: 33 bác sĩ, 2 chi nhánh, 2 lễ tân, 2 xét nghiệm viên; mật khẩu chung `123456`. File có hồ sơ và mã băm mật khẩu nên **không commit lên GitHub**. `.env` không đổi mật khẩu đã có trong database. Bản code cần có các thay đổi cơ cấu ngày 12/11; Git chỉ đồng bộ những thay đổi đã được nhóm commit/push.

## 2. Import MySQL và chạy 7 service + worker

**Chỉ import trên MySQL volume mới/chưa có dữ liệu cần giữ.** Import lại có thể ghi đè dữ liệu đã tạo trên máy bạn.

```powershell
$dump = 'data/mysql/clinic-medicare-7db-2026-11-12.sql.gz'
if (-not (Test-Path $dump)) { throw 'Chưa có file dump được gửi riêng.' }
if ((Get-FileHash $dump -Algorithm SHA256).Hash -ne 'E6F930E9CC0CBE6A4F71C203C28C1D54425347C93254D7AED6D6B3CE27ED3DDF') { throw 'File dump không đúng bản đã kiểm tra.' }
docker compose up -d --wait mysql
docker compose cp $dump mysql:/tmp/clinic-medicare-7db-2026-11-12.sql.gz
docker compose exec -T mysql sh -c 'gzip -t /tmp/clinic-medicare-7db-2026-11-12.sql.gz && gzip -dc /tmp/clinic-medicare-7db-2026-11-12.sql.gz | MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
docker compose up -d --build --wait
docker compose ps
Get-Content -Raw -Encoding utf8 data/mysql/verify.sql | docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot -N'
```

File export gồm 1.920 phân công mới từ 11/11–10/12/2026 và 1.728 dòng lịch sử, tổng 3.648 dòng lịch trực. Không chạy lại script nhập dump cũ sau khi import. Nếu chỉ tạo database rỗng thì chưa có bộ tài khoản/danh mục Medicare để chạy bộ sinh lịch.

## 3. Chạy giao diện

Mở PowerShell thứ hai tại thư mục repo:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Mở **http://127.0.0.1:5173/**. API của 7 service ở cổng `8001`–`8007`; ví dụ kiểm tra `http://127.0.0.1:8001/ready`.

Những lần sau chỉ cần `docker compose up -d` ở gốc repo và `npm.cmd run dev` trong `Frontend/`; **không import lại dump**. `docker compose down` giữ dữ liệu MySQL, còn `docker compose down -v` **xóa volume và dữ liệu**.

Git chỉ đồng bộ code. Dump ngày 12/11/2026 là bản chụp tĩnh; thay đổi dữ liệu sau đó trên máy người xuất không tự sang máy khác. Nếu có thay đổi sau này, cần xuất dump mới và gửi riêng. Xem [hướng dẫn import chi tiết](data/mysql/README.md) khi gặp lỗi.

Nếu chỉ có dump monolith `clinic-2026-10-22_15-09-09-m1km21dy.sql` thay vì bản export 7 database ở trên, xem [cách nhập dữ liệu cũ](docs/mysql-dump-import.md); không import trực tiếp dump monolith bằng MySQL.

Tài liệu nộp đề tài: [ranh giới 7 service, OpenAPI và orchestration](docs/microservices-base.md); [SLO/QoS và kết quả kiểm thử tải](docs/qos.md).

## Bộ dữ liệu trình diễn đủ 5 vai trò

Xem [tài khoản, lịch trực mới và kịch bản xuyên suốt](docs/demo-guide.md), [giải thích kiến trúc/OpenAPI](docs/demo-architecture.md) và [kết quả kiểm tra demo](docs/demo-verification.md).

Luồng Admin **Hoàn tiền & hủy lịch**, hủy ca có lịch hẹn và chuyển bác sĩ kèm thông báo: xem [quy tắc, orchestration và kiểm thử](docs/refund-shift-workflow.md). Chỉ áp dụng trước check-in; bệnh nhân chưa thanh toán vẫn tự hủy được. Thông báo/lịch hẹn tự cập nhật trên trang bệnh nhân sau tối đa 15 giây hoặc khi quay lại cửa sổ.

Database local đã cơ cấu về 33 bác sĩ gốc, 2 chi nhánh Medicare, 2 lễ tân và 2 xét nghiệm viên. Mật khẩu chung của mọi tài khoản còn lại là `123456`. Xem [kết quả cơ cấu và backup](docs/database-restructure-result.md).

Sau khi đã có bộ dữ liệu Medicare, sinh hoặc kiểm tra lại lịch qua HTTP API:

```bash
docker compose up -d --build --wait
docker compose exec -T identity python -m demo_setup --apply --start-date 2026-11-11 --days 30
```

Lịch từ 11/11 đến hết 10/12/2026 gồm 1.920 phân công. Chạy lại không tạo trùng, không thêm tài khoản/chi nhánh/dịch vụ. Không nhập lại dump cũ lên bộ dữ liệu đã cơ cấu. Công cụ tạo fixture bổ sung chỉ được dùng trong stack kiểm thử tách biệt.
