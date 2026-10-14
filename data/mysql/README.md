# Bản sao MySQL của nhóm

`medicare-7db-2026-10-14.sql.gz` là bản export **đầy đủ dữ liệu hiện có** trên máy xuất vào ngày 14/10/2026. File chứa cả bảng, bản ghi và lịch sử của bảy database: `identity_db`, `registry_db`, `scheduling_db`, `appointment_db`, `billing_db`, `clinical_db`, `laboratory_db`. Đây là bản chụp tại một thời điểm; dữ liệu mới phát sinh sau đó trên từng máy sẽ không tự đồng bộ qua Git. **File dump không có trong repo public**; nhận file qua kênh riêng từ người quản lý nhóm.

**Lưu ý bảo mật:** bản sao có thể chứa CCCD, số điện thoại, hồ sơ khám, mã băm mật khẩu và thông tin phiên đăng nhập. Chỉ gửi file cho thành viên được phép sử dụng dữ liệu này; không phát hành bản dump ra công khai. Tài khoản có trong dump sẽ dùng mật khẩu đã đặt lúc export; `.env` không thể tự đổi mật khẩu của tài khoản đã tồn tại. Không dùng bộ dữ liệu này trong môi trường production.

## Import trên máy mới clone

Chỉ thực hiện khi MySQL volume của dự án trên máy đó **chưa có dữ liệu cần giữ**. Import dump vào database đã có dữ liệu sẽ có thể ghi đè bảng và bản ghi. Không dùng `docker compose down -v` để chuẩn bị import nếu volume đang chứa dữ liệu cần giữ.

Đặt file được gửi vào `data/mysql/medicare-7db-2026-10-14.sql.gz` trong repo đã clone. Kiểm tra SHA-256: `397239D884A733FEEAACA47FC5441D00DE9CF5014E34CA4D141470320FE924BC` (PowerShell: `Get-FileHash data/mysql/medicare-7db-2026-10-14.sql.gz -Algorithm SHA256`). Nếu không khớp, không import. Sau đó tại thư mục gốc repo, trong PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d mysql
docker compose cp data/mysql/medicare-7db-2026-10-14.sql.gz mysql:/tmp/medicare-7db-2026-10-14.sql.gz
docker compose exec -T mysql sh -c 'gzip -t /tmp/medicare-7db-2026-10-14.sql.gz && gzip -dc /tmp/medicare-7db-2026-10-14.sql.gz | MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot'
docker compose up -d --build
docker compose ps
```

Có thể kiểm tra số bản ghi sau khi import bằng `docker compose cp data/mysql/verify.sql mysql:/tmp/verify.sql` và `docker compose exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot < /tmp/verify.sql'`. Lệnh này chỉ in số lượng, không in dữ liệu cá nhân.

Sau đó chạy frontend theo README gốc. Nếu đã chạy `docker compose up -d --build` trước khi import và trong database có tài khoản/dữ liệu mới, hãy sao lưu dữ liệu đó rồi trao đổi trong nhóm trước khi khôi phục. Import này chỉ phục hồi bảy database microservice; file SQLite cũ `Backend/hospital.db` không phải nguồn dữ liệu cho các service và không nằm trong dump. Người dùng cần đăng nhập lại trên máy mới.

## Tạo bản chụp mới

Bản dump này không cập nhật tự động. Nếu muốn các thành viên nhận dữ liệu mới, export lại có kiểm soát, cập nhật ngày/tên file và checksum trong hướng dẫn rồi gửi file mới qua kênh riêng. **Không commit file dump vào repo public.**
