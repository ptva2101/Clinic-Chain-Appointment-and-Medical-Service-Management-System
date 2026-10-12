# Frontend theo ranh giới dịch vụ

`Frontend/src/App.jsx` giữ phần điều hướng, đăng nhập của giao diện cũ và trạng thái phiên. Năm màn hình theo vai trò nằm ở `Frontend/src/dashboards/`; dữ liệu và widget dùng chung nằm ở `Frontend/src/shared/`. Các màn hình gọi qua `Frontend/src/api/`, không tự giữ URL backend.

| Client frontend | Nghiệp vụ | Trạng thái |
| --- | --- | --- |
| `identity.js` | Đăng ký, đăng nhập bệnh nhân, xem tài khoản, đăng xuất tại `/` | Gọi Identity service ở cổng 8001 |
| `registry.js` | Danh mục chi nhánh, dịch vụ, bệnh và thuốc | Tạm gọi backend cũ |
| `scheduling.js` | Danh mục lịch và quản lý lịch bác sĩ | Tạm gọi backend cũ |
| `appointment.js` | Đặt lịch, check-in, hàng chờ, thông báo lịch | Tạm gọi backend cũ |
| `billing.js` | Báo cáo tháng | Tạm gọi backend cũ |
| `clinical.js` | Lượt khám, bệnh sử, điều trị | Tạm gọi backend cũ |
| `laboratory.js` | Chỉ định và kết quả xét nghiệm | Tạm gọi backend cũ |

`legacyAuth.js` giữ đăng nhập và khôi phục phiên nhân viên của giao diện nghiệp vụ cũ. Bệnh nhân đăng ký/đăng nhập qua Identity trên trang chính; Identity tạo hồ sơ tối thiểu ở Registry và trả mã qua `subject_id`. Registry chưa có đầy đủ dữ liệu khám bệnh và các API đặt lịch vẫn là backend cũ, nên token Identity chưa dùng cho các API đó; tài khoản mới chưa vào được dashboard cũ. Khi từng service có hợp đồng OpenAPI và dữ liệu thật, thay URL, payload và xử lý phản hồi trong client tương ứng; sau cùng bỏ `legacyAuth.js` và `legacy.js`.

Chạy frontend từ `Frontend/`: `npm.cmd install`, `npm.cmd run dev`, rồi mở `http://localhost:5173/`. Mặc định frontend gọi backend cũ tại `http://127.0.0.1:8000` và Identity tại `http://127.0.0.1:8001`; có thể đặt `VITE_LEGACY_BACKEND_URL` và `VITE_IDENTITY_URL` trước khi chạy Vite.
