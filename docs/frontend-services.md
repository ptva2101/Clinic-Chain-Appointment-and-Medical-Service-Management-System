# Frontend theo ranh giới dịch vụ

`Frontend/src/App.jsx` giữ phần điều hướng và phiên Identity trong bộ nhớ. Năm màn hình theo vai trò nằm ở `Frontend/src/dashboards/`; dữ liệu và widget dùng chung nằm ở `Frontend/src/shared/`. Các màn hình gọi qua `Frontend/src/api/`, không tự giữ URL backend.

| Client frontend | Nghiệp vụ | Trạng thái |
| --- | --- | --- |
| `identity.js` | Đăng ký bệnh nhân; đăng nhập mọi vai trò, quản lý tài khoản nhân viên, đổi mật khẩu và đăng xuất | Gọi Identity service ở cổng 8001 |
| `registry.js` | Chi nhánh, dịch vụ và cấu hình dịch vụ theo chi nhánh | Gọi Registry service ở cổng 8002; chưa có danh mục bệnh/thuốc/BHYT |
| `patientProfile.js` | Xem/sửa hồ sơ của bệnh nhân; Admin xem danh sách bệnh nhân có tìm kiếm, phân trang | Gọi Registry service ở cổng 8002 |
| `staffProfile.js` | Lấy hồ sơ nhân viên sau đăng nhập; Admin xem danh sách nhân viên thật | Gọi Registry service ở cổng 8002 |
| `scheduling.js` | Xem lịch trực và xếp ca hàng loạt cho bác sĩ | Gọi Scheduling service ở cổng 8003; hủy/chuyển ca tạm khóa vì chưa có orchestration với Appointment/Billing |
| `appointment.js` | Đặt lịch, check-in, hàng chờ, thông báo lịch | Tạm gọi backend cũ |
| `billing.js` | Báo cáo tháng | Tạm gọi backend cũ |
| `clinical.js` | Lượt khám, bệnh sử, điều trị | Tạm gọi backend cũ |
| `laboratory.js` | Chỉ định và kết quả xét nghiệm | Tạm gọi backend cũ |

Mọi vai trò đăng nhập qua Identity. Bệnh nhân tự đăng ký bằng CCCD, sau đó xem/sửa hồ sơ cơ bản tại Registry; bảng bệnh nhân trong Admin lấy dữ liệu thật từ Registry qua API chỉ cho Admin. Admin cấp tài khoản bác sĩ, lễ tân, xét nghiệm viên tại mục **Tài khoản đăng nhập Identity** trong dashboard admin. Identity chỉ kích hoạt tài khoản nhân viên sau khi Registry tạo hồ sơ và liên kết `subject_id` với mã nhân sự. Bảng nhân sự mẫu đã được bỏ; Admin xem hồ sơ nhân viên thật từ Registry. Token chỉ giữ trong bộ nhớ, tự làm mới khi trang mở; tải lại trang phải đăng nhập lại. Phiên cũ trong `localStorage` bị bỏ.

Đăng nhập Identity mới chỉ bảo vệ đường vào frontend. Danh mục chi nhánh/dịch vụ đã đọc Registry và các thao tác thêm/sửa trong Admin lưu thật; kết quả danh mục rỗng không còn được thay bằng chi nhánh/dịch vụ mẫu ở các dashboard. Nếu tải Registry lỗi, giao diện báo lỗi thay vì âm thầm hiển thị dữ liệu cũ. Danh mục bệnh/thuốc/BHYT và các API nghiệp vụ vẫn chưa chuyển đầy đủ, một số màn hình còn dữ liệu mẫu hoặc gọi backend cũ ở cổng 8000 (**chưa kiểm tra token Identity**). Không coi đây là phân quyền đầu-cuối cho hệ thống. Bệnh nhân mới chưa vào dashboard đặt lịch cũ. Khi các service có API và hồ sơ thật, thay `legacy.js` và bảo vệ mọi endpoint nghiệp vụ bằng token/quyền tương ứng.

Chạy frontend từ `Frontend/`: `npm.cmd install`, `npm.cmd run dev`, rồi mở `http://localhost:5173/`. Mặc định frontend gọi backend cũ tại `http://127.0.0.1:8000`, Identity tại `http://127.0.0.1:8001`, Registry tại `http://127.0.0.1:8002` và Scheduling tại `http://127.0.0.1:8003`; có thể đặt `VITE_LEGACY_BACKEND_URL`, `VITE_IDENTITY_URL`, `VITE_REGISTRY_URL` và `VITE_SCHEDULING_URL` trước khi chạy Vite.
