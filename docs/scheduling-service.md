# Scheduling service

Scheduling sở hữu bảng `doctor_schedules` trong `scheduling_db`; migration chạy tự động khi container khởi động và không xóa dữ liệu cũ. Không có lịch trực mẫu được seed.

| API | Quyền | Chức năng |
| --- | --- | --- |
| `GET /api/v1/scheduling/doctor-schedules?from_date=&to_date=&ma_bac_si=` | Công khai | Danh sách ca trực theo khoảng ngày và bác sĩ |
| `POST /api/v1/scheduling/doctor-schedules/bulk` | Bearer token Identity vai trò Admin | Xếp tối đa 200 ca trong một giao dịch; trùng ca của cùng bác sĩ trả 409 và không lưu dở dang |

POST kiểm tra mã bác sĩ với Registry `/staff/by-code/{code}` và mã chi nhánh với danh mục Registry trước khi ghi. Scheduling chỉ giữ mã tham chiếu, không truy cập `registry_db`. Các ca trực được đánh số `LT_000001` theo ID MySQL. OpenAPI: `http://127.0.0.1:8003/docs`.

Admin và các màn hình lịch trực đọc API này. Hủy hoặc chuyển bác sĩ tạm thời **không khả dụng**: phải kiểm tra lịch hẹn đang có và phối hợp hoàn tiền/thông báo với Appointment, Billing trước khi bật. Số lịch hẹn trong bảng Admin hiện ghi “Chưa liên kết Appointment”, không còn dùng số đếm mẫu. API chưa cung cấp giữ slot hay đặt lịch; không nên coi ca trực là bảo đảm còn chỗ đặt.

Kiểm tra local:

```powershell
docker compose up --build -d registry scheduling
Invoke-RestMethod http://127.0.0.1:8003/ready
Invoke-RestMethod http://127.0.0.1:8003/api/v1/scheduling/doctor-schedules
services\.venv\Scripts\python.exe -m pytest services/tests -q
```

Mục tiêu QoS local cho GET danh sách: HTTP lỗi dưới 1%, p95 dưới 500 ms với 10 người dùng đồng thời trong 30 giây. Đây là mục tiêu kiểm thử, chưa phải SLA production. POST là giao dịch nguyên tử; nếu Registry/Identity không khả dụng, trả 503 thay vì chấp nhận mã chưa xác minh.

Kịch bản kiểm thử tải nằm tại `services/load/scheduling.js` và không ghi database. Chạy bằng k6 trong cùng Docker network với Scheduling.

Lần chạy local 10 VU/30 giây trên danh sách rỗng: 2.843 request, lỗi 0%, p95 7,45 ms; đạt ngưỡng đề ra. Kết quả này chưa đại diện cho database lớn hoặc môi trường production.
