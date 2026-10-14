# Frontend theo ranh giới dịch vụ

`Frontend/src/App.jsx` giữ phần điều hướng và phiên Identity trong bộ nhớ. Năm màn hình theo vai trò nằm ở `Frontend/src/dashboards/`; dữ liệu và widget dùng chung nằm ở `Frontend/src/shared/`. Các màn hình gọi qua `Frontend/src/api/`, không tự giữ URL backend.

| Client frontend | Nghiệp vụ | Trạng thái |
| --- | --- | --- |
| `identity.js` | Đăng ký bệnh nhân; đăng nhập mọi vai trò, quản lý tài khoản nhân viên, đổi mật khẩu và đăng xuất | Gọi Identity service ở cổng 8001 |
| `registry.js` | Chi nhánh, dịch vụ và cấu hình dịch vụ theo chi nhánh | Gọi Registry service ở cổng 8002; chưa có danh mục bệnh/thuốc/BHYT |
| `patientProfile.js` | Xem/sửa hồ sơ của bệnh nhân; Admin xem danh sách bệnh nhân có tìm kiếm, phân trang | Gọi Registry service ở cổng 8002 |
| `staffProfile.js` | Lấy hồ sơ nhân viên sau đăng nhập; Admin xem danh sách nhân viên thật | Gọi Registry service ở cổng 8002 |
| `scheduling.js` | Xem lịch trực và xếp ca hàng loạt cho bác sĩ | Gọi Scheduling service ở cổng 8003; hủy/chuyển ca tạm khóa vì chưa có orchestration với Appointment/Billing |
| `appointment.js` | Đặt lịch trên giao diện, check-in, hàng chờ, thông báo lịch | Vẫn gọi backend cũ ở cổng 8000; API Appointment mới ở cổng 8004 chưa được nối vào màn hình |
| `billing.js` | Báo cáo tháng | Tạm gọi backend cũ |
| `clinical.js` | Lượt khám, bệnh sử, điều trị | Tạm gọi backend cũ |
| `laboratory.js` | Chỉ định và kết quả xét nghiệm | Tạm gọi backend cũ |

Mọi vai trò đăng nhập qua Identity. Bệnh nhân tự đăng ký bằng CCCD, sau đó xem/sửa hồ sơ cơ bản tại Registry; bảng bệnh nhân trong Admin lấy dữ liệu từ Registry qua API chỉ cho Admin. Admin cấp tài khoản bác sĩ, lễ tân, xét nghiệm viên tại mục **Tài khoản đăng nhập**. Identity chỉ kích hoạt tài khoản nhân viên sau khi Registry tạo hồ sơ và liên kết `subject_id` với mã nhân sự. Hồ sơ mẫu cũ có thể được nhập riêng vào MySQL và đánh dấu nguồn; chúng không tự xuất hiện khi clone. Token chỉ giữ trong bộ nhớ, tự làm mới khi trang mở; tải lại trang phải đăng nhập lại.

Đăng nhập Identity chưa bảo vệ các endpoint của `Backend/` cũ. Danh mục chi nhánh/dịch vụ đọc Registry và thao tác thêm/sửa trong Admin lưu MySQL; nếu tải Registry lỗi, giao diện báo lỗi. Một số màn hình đặt lịch, khám, thanh toán và xét nghiệm vẫn gọi backend cũ ở cổng 8000 qua `legacy.js`; các lời gọi này chưa được chuyển sang service nghiệp vụ mới, nên không coi đây là phân quyền đầu-cuối. Backend cũ và database `clinic` không được Docker Compose khởi động/tạo tự động. Hướng dẫn khởi động sạch nằm ở [README](../README.md).

Chạy frontend từ `Frontend/`: `npm.cmd ci`, `npm.cmd run dev`, rồi mở `http://localhost:5173/`. Mặc định frontend gọi backend cũ tại `http://127.0.0.1:8000`, Identity tại `http://127.0.0.1:8001`, Registry tại `http://127.0.0.1:8002` và Scheduling tại `http://127.0.0.1:8003`; có thể đặt `VITE_LEGACY_BACKEND_URL`, `VITE_IDENTITY_URL`, `VITE_REGISTRY_URL` và `VITE_SCHEDULING_URL` trước khi chạy Vite.
