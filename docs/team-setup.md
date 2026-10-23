# Thành viên mới: lấy code và dữ liệu

Làm theo [README ở gốc repo](../README.md). Dùng nhánh `anhhuy080905` sau khi chủ nhánh đã push bản code mới; nhận riêng file `clinic-7db-complete-2026-10-23.sql.gz`, đặt vào `data/mysql/`, và nhận thông tin đăng nhập qua kênh riêng. File nén chứa dữ liệu cá nhân, **không commit hoặc gửi lên repo public**.

Trên máy mới, chỉ import vào MySQL Docker volume chưa có dữ liệu cần giữ. Bản export đã có đủ dữ liệu của 7 service, gồm ca trực tháng 10/2026 và dữ liệu lịch sử từ monolith; không chạy lại script nhập/dời dữ liệu. Chạy `docker compose up -d --build --wait`, rồi `npm.cmd ci` và `npm.cmd run dev` trong `Frontend/`.

Sau lần đầu, `docker compose up -d` giữ nguyên MySQL volume. `git pull` chỉ cập nhật code, không cập nhật database. Muốn đồng bộ dữ liệu phát sinh sau bản export ngày 23/10/2026 thì cần bản dump mới gửi riêng. `docker compose down -v` **xóa dữ liệu Docker**, không dùng để sửa lỗi nếu chưa sao lưu.
