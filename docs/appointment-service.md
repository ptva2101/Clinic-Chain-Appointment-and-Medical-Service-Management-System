# Appointment service

Appointment sở hữu bảng `appointments` trong `appointment_db` và điều phối đặt lịch qua Scheduling. Bảng được tạo bằng migration cộng thêm lúc container khởi động. Không đọc trực tiếp database của service khác.

| API | Quyền | Chức năng |
| --- | --- | --- |
| `POST /api/v1/appointments` | Patient | Giữ slot ở Scheduling, lưu lịch hẹn, xác nhận slot |
| `GET /api/v1/appointments/me` | Patient | Danh sách lịch hẹn của hồ sơ mình |
| `GET /api/v1/appointments/doctor/me` | Doctor | Lịch hẹn của bác sĩ đang đăng nhập |
| `GET /api/v1/appointments` | Admin | Danh sách; lọc `from_date`, `to_date`, `status` |
| `GET /api/v1/appointments/{id}` | Chủ sở hữu, bác sĩ liên quan, Admin | Chi tiết lịch hẹn |
| `POST /api/v1/appointments/{id}/cancel` | Patient chủ sở hữu | Giải phóng slot và hủy lịch |
| `GET /api/v1/appointment/history` | Admin | Bản ghi mẫu cũ của Appointment, có phân trang |

Body đặt lịch giống `POST /api/v1/scheduling/holds`: `config_code`, `doctor_code`, `date`, `shift`, `idempotency_key`. Bệnh nhân phải đăng nhập Identity và đã liên kết hồ sơ Registry. Mỗi key được dùng lại chỉ cho cùng một yêu cầu; retry sau lỗi mạng không tạo lịch hẹn thứ hai. Appointment lưu `pending` trước khi gọi Scheduling xác nhận. Nếu xác nhận không chắc chắn do timeout, bản ghi giữ `pending`; khi hủy, lỗi mạng giữ `cancel_pending`.

Container `appointment-reconciler` chạy nền, mặc định mỗi 30 giây quét tối đa 20 lịch `pending`/`cancel_pending` đã đứng yên ít nhất 30 giây. Nó hỏi Scheduling qua API nội bộ: hold đã xác nhận đúng lịch thì hoàn tất `confirmed`, hold còn hiệu lực thì thử xác nhận, hold hết hạn/đã giải phóng thì chuyển `failed`. Với `cancel_pending`, nó hỏi Billing trước khi giải phóng hold; hóa đơn còn `paid` hoặc dịch vụ không phản hồi thì **không tự hủy**. Việc quét có phân trang để một lịch lỗi không chặn các lịch khác. Các biến `APPOINTMENT_RECONCILE_*` trong `.env.example` điều chỉnh chu kỳ, độ trễ và cỡ lô. Worker chỉ truy cập `appointment_db` và API của service khác, không đọc chéo database.

Lịch hẹn mẫu cũ được nhập với `source='legacy_demo'`, `status='historical'`, `legacy_status` giữ trạng thái gốc. Chúng chỉ hiển thị trong danh sách Admin, không liên kết với tài khoản bệnh nhân thật, không có hold hiện hành và không thể hủy qua API. Ngày gốc tháng 6/2026 được giữ nguyên.

OpenAPI: `http://127.0.0.1:8004/docs`. Lịch **đã thanh toán** chỉ có thể hủy sau khi admin hoàn tiền giả lập tại Billing; bệnh nhân làm mới hóa đơn rồi hủy lịch chưa check-in. Không tự động hoàn tiền khi hủy, và không tự giải phóng slot khi hóa đơn còn `paid`. Không tự động tạo lịch khám tương lai từ dữ liệu mẫu quá khứ.

Kiểm tra local:

```powershell
docker compose up --build -d appointment appointment-reconciler
Invoke-RestMethod http://127.0.0.1:8004/ready
services\.venv\Scripts\python.exe -m pytest services/tests -q
```
