# Bản export MySQL của 7 service

Bộ sau cơ cấu là `clinic-medicare-7db-2026-11-12.sql.gz` (SHA-256: `e6f930e9cc0cbe6a4f71c203c28c1d54425347c93254d7aed6d6b3ce27ed3ddf`). File gửi riêng, được gitignore; không commit hồ sơ và mã băm mật khẩu.

Đối chiếu dữ liệu: 7 database, 56 tài khoản (33 bác sĩ, 2 lễ tân, 2 xét nghiệm viên, 2 Admin, 17 bệnh nhân), 37 hồ sơ nhân viên, 17 hồ sơ bệnh nhân, 2 chi nhánh, 65 dịch vụ, 130 cấu hình, 3.648 dòng lịch trực (1.728 lịch sử + 1.920 mới), 49 lịch hẹn, 49 hóa đơn, 20 lượt khám và 13 chỉ định xét nghiệm. Mật khẩu chung `123456`; 13 tài khoản bệnh nhân cũ vẫn giữ trạng thái khóa. Một tài khoản bệnh nhân có sẵn thiếu hồ sơ đã được cơ chế đăng nhập đồng bộ bổ sung khi xác minh, từ 16 lên 17 hồ sơ; không tạo tài khoản mới.

Xem [README gốc](../../README.md) để import vào Docker; cần code có các thay đổi cơ cấu 12/11/2026. Bản `clinic-7db-complete-2026-10-23.sql.gz` thuộc bộ dữ liệu trước cơ cấu, không dùng để ghi đè bộ Medicare mới.

Chỉ import trên volume MySQL mới hoặc volume chắc chắn không có dữ liệu cần giữ. Import lại có thể ghi đè bảng. Sau khi import, dùng [`verify.sql`](verify.sql) để in số lượng bản ghi, không in CCCD hay hồ sơ. Bản export là ảnh chụp tĩnh; Git không đồng bộ dữ liệu giữa các máy. Không dùng bộ dữ liệu này trong production.
