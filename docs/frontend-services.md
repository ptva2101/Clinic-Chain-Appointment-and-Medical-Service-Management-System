# Frontend theo ranh giới dịch vụ

`Frontend/src/App.jsx` giữ phần điều hướng và phiên Identity trong bộ nhớ. Năm màn hình theo vai trò nằm ở `Frontend/src/dashboards/`; dữ liệu và widget dùng chung nằm ở `Frontend/src/shared/`. Các màn hình gọi qua `Frontend/src/api/`, không tự giữ URL backend.

| Client frontend | Nghiệp vụ | Trạng thái |
| --- | --- | --- |
| `identity.js` | Đăng ký bệnh nhân; đăng nhập mọi vai trò, quản lý tài khoản nhân viên, đổi mật khẩu và đăng xuất | Gọi Identity service ở cổng 8001 |
| `registry.js` | Chi nhánh, dịch vụ và cấu hình dịch vụ theo chi nhánh | Gọi Registry service ở cổng 8002; danh mục bệnh/thuốc do Clinical sở hữu, BHYT chưa chuyển |
| `patientProfile.js` | Xem/sửa hồ sơ của bệnh nhân; Admin xem danh sách bệnh nhân có tìm kiếm, phân trang | Gọi Registry service ở cổng 8002 |
| `staffProfile.js` | Lấy hồ sơ nhân viên sau đăng nhập; Admin xem danh sách nhân viên thật | Gọi Registry service ở cổng 8002 |
| `scheduling.js` | Xem lịch trực, kiểm tra chỗ trống, xếp/hủy/chuyển ca | Gọi Scheduling service ở cổng 8003; hủy/chuyển chỉ được phép khi ca chưa có lịch hẹn hoặc giữ chỗ đang hoạt động |
| `appointment.js` | Đặt/xem/hủy lịch, thông báo, check-in và hàng chờ | Gọi Appointment service ở cổng 8004; lịch đã thanh toán chưa thể hủy nếu chưa có hoàn tiền |
| `billing.js` | Hóa đơn, thanh toán giả lập và báo cáo tổng tiền theo tháng | Gọi Billing service ở cổng 8005; chưa có cổng thanh toán ngân hàng |
| `clinical.js` | Lượt khám, bệnh sử, phác đồ và buổi điều trị | Gọi Clinical service ở cổng 8006 |
| `laboratory.js` | Chỉ định và kết quả xét nghiệm | Gọi Laboratory service ở cổng 8007 |

Mọi vai trò đăng nhập qua Identity. Bệnh nhân tự đăng ký bằng CCCD; khi đăng nhập, frontend lấy hồ sơ Registry rồi mở dashboard bệnh nhân. Số điện thoại chỉnh trong dashboard được lưu qua Registry; địa chỉ/BHYT chưa có trong hợp đồng Registry nên không chỉnh sửa hoặc tính quyền lợi BHYT ở luồng đặt lịch. Bảng bệnh nhân trong Admin lấy dữ liệu từ Registry qua API chỉ cho Admin. Admin cấp tài khoản bác sĩ, lễ tân, xét nghiệm viên tại mục **Tài khoản đăng nhập**. Identity chỉ kích hoạt tài khoản nhân viên sau khi Registry tạo hồ sơ và liên kết `subject_id` với mã nhân sự. Hồ sơ mẫu cũ có thể được nhập riêng vào MySQL và đánh dấu nguồn; chúng không tự xuất hiện khi clone. Token chỉ giữ trong bộ nhớ, tự làm mới khi trang mở; tải lại trang phải đăng nhập lại.

Danh mục chi nhánh/dịch vụ đọc Registry, danh mục bệnh/thuốc đọc Clinical và lưu trong MySQL riêng. Bệnh nhân đặt lịch qua Appointment, tạo hóa đơn ở Billing và có thể xác nhận thanh toán **giả lập**. Lễ tân chỉ check-in lịch đã ghi nhận thanh toán; bác sĩ lưu lượt khám ở Clinical, chỉ định qua Laboratory, kỹ thuật viên trả kết quả và bác sĩ hoàn tất. Buổi điều trị được đặt theo phác đồ Clinical qua Appointment/Billing. `Backend/` và database `clinic` cũ không được Docker Compose khởi động/tạo tự động. Các chức năng chưa chuyển an toàn gồm hoàn tiền/hủy lịch đã thanh toán, chuyển/hủy ca trực có lịch hẹn, quyền lợi BHYT và báo cáo chi tiết; xem [README](../README.md).

Chạy frontend từ `Frontend/`: `npm.cmd ci`, `npm.cmd run dev`, rồi mở `http://localhost:5173/`. Mặc định frontend gọi các service ở cổng 8001–8007; có thể đặt `VITE_IDENTITY_URL`, `VITE_REGISTRY_URL`, `VITE_SCHEDULING_URL`, `VITE_APPOINTMENT_URL`, `VITE_BILLING_URL`, `VITE_CLINICAL_URL` và `VITE_LABORATORY_URL` trước khi chạy Vite. Để đặt lịch tương lai, Admin cần xếp lịch trực cho bác sĩ; dữ liệu mẫu lịch sử không tự tạo ca trực tương lai.
