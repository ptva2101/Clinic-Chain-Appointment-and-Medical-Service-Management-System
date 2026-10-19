# Chuyển chức năng mới của `va2` sang microservice

Các API dưới đây thuộc các service hiện tại; không cần gọi `Backend` cũ cho các chức năng này.

| Nghiệp vụ `va2` | Service hiện tại | API chính |
| --- | --- | --- |
| Tạo tài khoản nhân viên, khóa/mở khóa, đăng nhập | Identity + Registry | `POST /api/v1/identity/accounts`, `PATCH /api/v1/identity/accounts/{id}/disable` hoặc `/enable`; Registry lưu hồ sơ nhân viên |
| Danh sách bệnh nhân/nhân viên | Registry | `GET /api/v1/registry/patients`, `GET /api/v1/registry/staff` (quyền admin) |
| Danh mục bác sĩ đang hoạt động | Registry hỏi Identity | `GET /api/v1/registry/catalog/doctors`, `GET /api/v1/registry/catalog/doctors/{code}` |
| Chi nhánh, dịch vụ, giá, slot, trạng thái | Registry | `/api/v1/registry/catalog/branches`, `/services`, `/branch-services` |
| Ngừng cung cấp chi nhánh/dịch vụ/cấu hình | Registry | `DELETE /api/v1/registry/catalog/branches/{code}`, `/services/{code}`, `/branch-services/{code}` (quyền admin) |
| Thông báo lịch hẹn và đánh dấu đã đọc | Appointment | `GET /api/v1/appointments/notifications/me`, `POST /api/v1/appointments/notifications/mark-read` (quyền bệnh nhân) |

`DELETE` ở Registry là **ngừng hoạt động**, không xóa bản ghi MySQL: cấu hình liên quan cũng bị ngừng để không nhận đặt lịch mới. Dữ liệu lịch sử vẫn còn. Admin có thể mở lại chi nhánh/dịch vụ bằng `PATCH /branches/{code}/status` hoặc `/services/{code}/status` với `{"TrangThai":"active"}`, sau đó mở lại từng cấu hình nếu muốn.

Registry chỉ trả về bác sĩ có hồ sơ liên kết và tài khoản Identity còn hoạt động. Scheduling cũng kiểm tra trạng thái đó khi tạo lịch trực và giữ chỗ, nên bác sĩ bị khóa không thể nhận lịch mới. Cơ chế này dùng `REGISTRY_INTERNAL_TOKEN` đã cấu hình trong `compose.yaml`.

Appointment tạo thông báo khi lịch hẹn của **Appointment service** được xác nhận hoặc hủy. Trạng thái đã đọc lưu trong `appointment_db`, giới hạn theo tài khoản đang đăng nhập; frontend gọi API này. Lịch hẹn và thông báo cũ trong database của `Backend` chưa được chuyển vào `appointment_db`. Các màn hình đặt lịch/thanh toán/khám còn gọi `Backend` cũ vẫn cần tiếp tục được chuyển riêng; thông báo phát sinh từ luồng đặt lịch cũ không tự xuất hiện trong Appointment service.

Khi chạy lại `docker compose up --build -d`, Registry và Appointment tự chạy migration: thêm cột trạng thái cho chi nhánh/dịch vụ hiện có và tạo bảng thông báo. Không xóa dữ liệu cũ.
