# QoS local cho 7 microservice

Các mục tiêu dưới đây là **mục tiêu phát triển**, chưa phải SLA vận hành được chứng minh. Cần đo dưới tải nghiệp vụ có dữ liệu đại diện trước khi cam kết.

| Service | API quan trọng | Mục tiêu p95 local | Tỷ lệ thành công mục tiêu |
| --- | --- | ---: | ---: |
| Identity | đăng nhập, xác thực token | < 500 ms | ≥ 99,5% |
| Registry | hồ sơ, danh mục | < 500 ms | ≥ 99,5% |
| Scheduling | khả dụng slot, giữ chỗ | < 800 ms | ≥ 99,5% |
| Appointment | đặt lịch, check-in | < 1.500 ms | ≥ 99% |
| Billing | tạo hóa đơn, ghi nhận thanh toán giả lập | < 800 ms | ≥ 99,5% |
| Clinical | lưu lượt khám, đặt buổi điều trị | < 1.500 ms | ≥ 99% |
| Laboratory | nhận chỉ định, trả kết quả | < 800 ms | ≥ 99,5% |

Đo smoke test không ghi dữ liệu, từ thư mục gốc repo khi Docker Compose đã chạy:

```powershell
services\.venv\Scripts\python.exe services/load/read_smoke.py --requests 30 --concurrency 5
```

Script đo `/ready` của cả 7 service, báo p50/p95 và lỗi HTTP/kết nối. Đây chỉ chứng minh đường mạng + kết nối MySQL chịu tải đọc nhẹ, **không** đo luồng đặt lịch/khám hay SLA trong bảng. Bài k6 `services/load/scheduling.js` đo GET lịch trực. Kiểm thử tải nghiệp vụ cần tài khoản/ca trực thử, môi trường dữ liệu cách ly và kịch bản ghi/rollback; không chạy trên bản dữ liệu bệnh nhân thật. Thanh toán hiện là giả lập, không có SLA cổng ngân hàng.
