# Scheduling service

Scheduling quản lý lịch trực, số chỗ còn lại và lượt giữ chỗ tạm thời trong `scheduling_db`.
Migration khởi động tạo thêm `slot_inventory` và `slot_holds` theo kiểu cộng thêm, không xóa dữ liệu cũ.
Không seed lịch trực hay lượt giữ chỗ mẫu.

| API | Quyền | Ý nghĩa |
| --- | --- | --- |
| `GET /api/v1/scheduling/doctor-schedules` | Công khai | Lọc lịch trực theo `from_date`, `to_date`, `ma_bac_si` |
| `POST /api/v1/scheduling/doctor-schedules/bulk` | Admin | Tạo tối đa 200 ca trực nguyên tử; trùng ca trả 409 |
| `GET /api/v1/scheduling/doctor-schedules/{id}/impact` | Admin | Xem số lịch hẹn xác nhận, chỗ đang giữ và khả năng hủy/chuyển ca tại thời điểm đọc |
| `POST /api/v1/scheduling/doctor-schedules/{id}/cancel` | Admin | Hủy ca chưa có lịch hẹn/chỗ đang giữ; kiểm tra lại trong giao dịch |
| `POST /api/v1/scheduling/doctor-schedules/{id}/transfer` | Admin | Chuyển ca trống sang bác sĩ khác; kiểm tra xung đột và giữ chỗ lại |
| `GET /api/v1/scheduling/availability?config_code=...&date=YYYY-MM-DD&shift=1` | Công khai | Sức chứa, số hold, số đã xác nhận và bác sĩ trực; hỗ trợ `doctor_code` |
| `POST /api/v1/scheduling/holds` | Patient | Giữ một chỗ, mặc định 600 giây |
| `GET /api/v1/scheduling/holds/{id}` | Patient sở hữu | Xem hold, gồm trạng thái hết hạn hiệu dụng |
| `DELETE /api/v1/scheduling/holds/{id}` | Patient sở hữu | Bỏ hold chưa xác nhận |
| `POST /api/v1/scheduling/internal/holds/{id}/confirm` | Appointment, `X-Service-Token` | Xác nhận hold cho `appointment_id` |
| `GET /api/v1/scheduling/internal/holds/{id}` | Appointment, `X-Service-Token` | Đọc trạng thái hold để hòa giải lịch sau timeout |
| `POST /api/v1/scheduling/internal/holds/{id}/release` | Appointment, `X-Service-Token` | Giải phóng hold khi hủy lịch hoặc bù trừ giao dịch |

OpenAPI tương tác: `http://127.0.0.1:8003/docs`; JSON: `/openapi.json`.

Ví dụ body giữ chỗ:

```json
{
  "config_code": "CH_HN_KHAM",
  "doctor_code": "BS900",
  "date": "2026-10-15",
  "shift": 1,
  "idempotency_key": "d39b8240-4894-4fc5-a31c-51485ad8d928"
}
```

`config_code` là mã cấu hình chi nhánh–dịch vụ trong Registry. Registry xác định giới hạn slot và trạng thái hoạt động; Scheduling xác định bác sĩ có ca trực cùng chi nhánh/ngày/ca. Giới hạn áp dụng cho **mỗi cấu hình–ngày–ca**, không phải cho từng bác sĩ. Không có join hoặc quyền đọc trực tiếp `registry_db`.

Mỗi tổ hợp cấu hình–ngày–ca có một hàng `slot_inventory` khóa bằng `SELECT ... FOR UPDATE`. Tạo, xác nhận, hết hạn và giải phóng hold được xử lý trong giao dịch MySQL dưới khóa này, vì vậy không thể vượt giới hạn khi nhiều người lấy chỗ cuối cùng cùng lúc. `idempotency_key` duy nhất trong phạm vi từng bệnh nhân; retry cùng nội dung trả cùng hold, còn đổi nội dung hoặc dùng lại key đã hết hiệu lực trả 409. Hold quá TTL không tính vào availability; lần ghi kế tiếp dọn trạng thái và bộ đếm. `GET availability` là thông tin tại thời điểm đọc, **không cam kết giữ chỗ**; chỉ `POST holds` mới cấp chỗ nguyên tử.

API `confirm`/`release` nội bộ được Appointment dùng để xác nhận hoặc giải phóng slot; chúng không tự tạo lịch hẹn. Màn quản trị hiện hiển thị số lịch hẹn/chỗ giữ và chỉ cho thao tác trên ca trống. `impact` chỉ là bản xem trước; khi ghi, Scheduling khóa ca và kiểm tra lại để tránh tranh chấp. Ca đã có lịch hẹn cần quy trình hoàn tiền/chuyển lịch phối hợp Appointment/Billing, hiện chưa hỗ trợ. Mã nội bộ trong `.env.example` chỉ dành cho local; cần thay bằng secret riêng trước khi triển khai chung.

Chạy local:

```powershell
docker compose up --build -d registry scheduling
Invoke-RestMethod http://127.0.0.1:8003/ready
services\.venv\Scripts\python.exe -m pytest services/tests -q
```

Kiểm thử đồng thời ở `services/tests/test_scheduling_mysql.py` cần **MySQL dùng một lần**, database tên `scheduling_test_db`, cổng được cấp qua `SCHEDULING_TEST_MYSQL_PORT`; test sẽ tự bỏ qua nếu thiếu biến này. Không trỏ test vào MySQL có dữ liệu thật. Lần kiểm thử local với MySQL dùng một lần: 20 yêu cầu tranh một slot, đúng 1 thành công; xác nhận, giải phóng và tái sử dụng slot sau TTL đều qua.

Kịch bản k6 `services/load/scheduling.js` kiểm thử GET lịch trực. `services/load/appointment.js` kiểm thử luồng đặt → xác nhận hold → hủy → giải phóng hold qua hai service trên môi trường MySQL cách ly; xem [báo cáo QoS](qos.md). Ngưỡng riêng của bài GET lịch trực là p95 < 500 ms và lỗi < 1% với 10 người dùng đồng thời/30 giây; SLO đề xuất cho Scheduling trong bài đo đủ 7 service là p95 < 800 ms. Cả hai đều chưa phải SLA production.
