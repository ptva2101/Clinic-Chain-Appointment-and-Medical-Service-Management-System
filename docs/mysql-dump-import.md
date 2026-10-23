# Nhập dữ liệu MySQL cũ vào 7 service

File `clinic-2026-10-22_15-09-09-m1km21dy.sql` chứa CCCD, số điện thoại, BHYT và mật khẩu cũ dạng rõ. File này được `.gitignore`; chỉ gửi riêng cho thành viên được phép và đặt ở gốc repo. **Không import trực tiếp bằng `mysql`** vì dump có `DROP TABLE` của hệ monolith.

Sau khi chạy `docker compose up -d --build --wait`, không cần cài Python trên máy host:

```powershell
docker compose cp clinic-2026-10-22_15-09-09-m1km21dy.sql appointment:/app/private-legacy-dump.sql
docker compose exec -T appointment python -m demo_import.import_mysql_dump --file /app/private-legacy-dump.sql
docker compose exec -T -e DEMO_MYSQL_HOST=mysql -e DEMO_MYSQL_PORT=3306 appointment python -m demo_import.import_mysql_dump --file /app/private-legacy-dump.sql --apply --allow-nonlocal
docker compose exec -T appointment python -m demo_import.merge_mysql_dump --file /app/private-legacy-dump.sql
docker compose exec -T -e DEMO_MYSQL_HOST=mysql -e DEMO_MYSQL_PORT=3306 appointment python -m demo_import.merge_mysql_dump --file /app/private-legacy-dump.sql --apply --allow-nonlocal
docker compose exec -T -e DEMO_MYSQL_HOST=mysql -e DEMO_MYSQL_PORT=3306 appointment python -m demo_import.verify_mysql_merge --file /app/private-legacy-dump.sql
```

Hai lệnh không có `--apply` chỉ kiểm tra SHA-256 và kế hoạch. `import_mysql_dump.py` lưu 2.186 dòng của 17 bảng vào `historical_records` của service tương ứng, bỏ mật khẩu/token; `merge_mysql_dump.py` chuyển các thực thể dùng được vào bảng nghiệp vụ thật, chạy lại không tạo trùng và không ghi đè hồ sơ/tài khoản đang dùng. Cờ `--allow-nonlocal` ở đây chỉ cho phép kết nối tới MySQL cùng mạng Docker.

Dữ liệu nghiệp vụ được nhập: 52 tài khoản **khóa** (không dùng lại mật khẩu cũ), 13 hồ sơ bệnh nhân (1 hồ sơ mồ côi không có CCCD), 39 hồ sơ nhân viên, 26 nhóm BHYT, 2 chi nhánh, 65 dịch vụ, 130 cấu hình, 1.728 ca trực quá khứ, 49 lịch hẹn lịch sử, 15 thông báo, 40 check-in, 20 lượt khám, 8 phác đồ, 16 buổi điều trị, 13 xét nghiệm, 49 hóa đơn và 13 khoản xét nghiệm cũ trong Billing. Các bản ghi trùng mã được giữ nguyên bản hiện có; nhân viên/chi nhánh/dịch vụ cũ không tự được kích hoạt để đặt lịch mới.

Giới hạn của dump: 4 ca trực cùng bác sĩ/ngày/ca ở hai chi nhánh được giữ trong `doctor_schedules` với `status=historical`; chúng không thể dùng đặt lịch. 12 buổi điều trị thiếu ngày/lịch hẹn vẫn nằm trong `treatment_sessions` với `status=historical_unbooked`, các trường ngày/ca là `NULL`, không bịa ngày. Một lịch hẹn tham chiếu bệnh nhân không còn trong bảng gốc nên chỉ tạo hồ sơ `legacy_orphan` không CCCD. `GiaCuoi` được giữ nguyên làm số tiền cũ; chênh lệch với giá gốc là giảm trừ tại thời điểm cũ. Mã thẻ/nhóm BHYT cũ không được coi là đã xác minh, và không có thời điểm thanh toán chính xác: hóa đơn gắn `source=legacy_mysql`, `legacy_date` là **ngày hẹn**, `paid_at` để trống. Báo cáo đánh dấu `legacy_estimated_count`; không coi đó là chứng từ thanh toán chính xác.

Bản sao MySQL trước khi nhập đầu tiên nằm trong `clinic-pre-merge-2026-10-22.sql`; bản ngay trước khi nâng cấp lịch trực/điều trị nằm trong `clinic-pre-complete-2026-10-22.sql`. Cả hai được `.gitignore`. Không đẩy dump hoặc backup lên repo public.
