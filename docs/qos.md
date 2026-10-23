# QoS local cho 7 microservice

Các mục tiêu dưới đây là **SLO đề xuất cho bản demo**, chưa phải SLA vận hành được chứng minh. SLI độ trễ là p95 thời gian HTTP của API nghiệp vụ; SLI thành công là tỷ lệ phản hồi 2xx/3xx trên tổng yêu cầu hợp lệ (không tính lỗi 4xx do dữ liệu nhập sai). Đo theo từng service, cửa sổ 30 ngày nếu triển khai thật; khi đo local phải ghi rõ phần cứng, số người dùng và bộ dữ liệu. Không cam kết độ sẵn sàng production khi chưa có giám sát, dự phòng và quy trình ứng cứu.

| Service | API quan trọng | Mục tiêu p95 local | Tỷ lệ thành công mục tiêu |
| --- | --- | ---: | ---: |
| Identity | đăng nhập, xác thực token | < 500 ms | ≥ 99,5% |
| Registry | hồ sơ, danh mục | < 500 ms | ≥ 99,5% |
| Scheduling | khả dụng slot, giữ chỗ | < 800 ms | ≥ 99,5% |
| Appointment | đặt lịch, check-in | < 1.500 ms | ≥ 99% |
| Billing | tạo hóa đơn có BHYT, thanh toán/hoàn tiền giả lập, báo cáo | < 800 ms | ≥ 99,5% |
| Clinical | lưu lượt khám, đặt buổi điều trị | < 1.500 ms | ≥ 99% |
| Laboratory | nhận chỉ định, trả kết quả | < 800 ms | ≥ 99,5% |

Đo smoke test không ghi dữ liệu, từ thư mục gốc repo khi Docker Compose đã chạy:

```powershell
services\.venv\Scripts\python.exe services/load/read_smoke.py --requests 30 --concurrency 5
```

Script đo `/ready` của cả 7 service, báo p50/p95 và lỗi HTTP/kết nối. Đây chỉ chứng minh đường mạng + kết nối MySQL chịu tải đọc nhẹ, **không** đo luồng đặt lịch/khám hay SLA trong bảng. Bài k6 `services/load/scheduling.js` đo GET lịch trực. Thanh toán hiện là giả lập, không có SLA cổng ngân hàng.

Kịch bản ghi `services/load/appointment.js` thực hiện đặt lịch qua Appointment → Scheduling, sau đó hủy và trả slot. **Chỉ chạy trên stack MySQL dùng một lần**, với tài khoản bệnh nhân và ca trực test; không chạy trên bản dump chia sẻ hoặc tài khoản thật. Tạo sẵn cấu hình dịch vụ và ca trực tương lai, với giới hạn slot ít nhất bằng số VU; tài khoản test phải có hồ sơ Registry và token còn hạn. Script yêu cầu `LOAD_TEST_ISOLATED=1` để tránh chạy nhầm và dùng idempotency key riêng cho mỗi lượt.

Ví dụ sau khi đã chuẩn bị stack test cách ly trong cùng mạng Docker Compose (thay các giá trị `TEST_*` bằng dữ liệu **test**, không dùng CCCD thật):

```powershell
$env:LOAD_TEST_ISOLATED='1'
$env:APPOINTMENT_PATIENT_ACCESS_TOKEN='TEST_TOKEN'
$env:APPOINTMENT_CONFIG_CODE='TEST_CONFIG'
$env:APPOINTMENT_DOCTOR_CODE='TEST_DOCTOR'
$env:APPOINTMENT_DATE='2026-11-15'
$env:APPOINTMENT_SHIFT='1'
$network = (docker inspect (docker compose ps -q appointment) --format '{{range $name, $network := .NetworkSettings.Networks}}{{$name}}{{end}}')
docker run --rm --network $network -e LOAD_TEST_ISOLATED -e APPOINTMENT_PATIENT_ACCESS_TOKEN -e APPOINTMENT_CONFIG_CODE -e APPOINTMENT_DOCTOR_CODE -e APPOINTMENT_DATE -e APPOINTMENT_SHIFT -v "${PWD}/services/load:/scripts:ro" grafana/k6:0.55.0 run /scripts/appointment.js
```

Mặc định 2 VU × 10 vòng, yêu cầu >99% lượt đặt và hủy thành công, p95 HTTP đặt lịch <1,5 giây như SLO Appointment ở bảng. Đây là ngưỡng của kịch bản test local, không phải SLA production. Nếu thiếu stack cách ly thì không chạy k6 ghi dữ liệu.

## Kết quả đo ngày 23/10/2026

Chạy `grafana/k6:0.55.0` trong Docker Desktop 29.2.1 (12 vCPU, giới hạn bộ nhớ 8,06 GB), trên stack Compose `clinic-load-test` có MySQL **riêng và dữ liệu tổng hợp**. Bộ E2E tạo trước một bệnh nhân, bác sĩ, dịch vụ, ca trực và hóa đơn thử nghiệm. Không dùng database thật hoặc file dump chứa dữ liệu cá nhân. Các con số dưới đây đo trong cùng mạng Docker trên một máy; chưa đại diện triển khai nhiều máy hoặc tải production.

| Kịch bản | Tải | Kết quả | p95 | Lỗi HTTP |
| --- | --- | --- | ---: | ---: |
| Đặt → hủy lịch (`services/load/appointment.js`) | 2 VU × 10 vòng | 20/20 đặt, 20/20 hủy thành công | 643,28 ms cho yêu cầu đặt | 0/40 |
| GET lịch trực (`services/load/scheduling.js`) | 10 VU trong 30 giây | 2.815/2.815 phản hồi 200 | 8,12 ms | 0/2.815 |

Cả hai bài đều đạt threshold k6 đã khai báo. Bài đặt/hủy đo cả Appointment và Scheduling nhưng chưa đo đồng thời toàn bộ luồng thanh toán/khám/xét nghiệm; không suy diễn số đo này thành SLA của các service khác.

## Bài đọc API nghiệp vụ của cả 7 service

`services/load/seven_services.js` lần lượt đọc `/me`, lịch trực, lịch hẹn, hóa đơn, lượt khám và chỉ định xét nghiệm bằng **tài khoản tổng hợp** trên stack Compose cách ly. Mỗi request được gắn nhãn service để k6 kiểm tra p95 và tỷ lệ lỗi riêng theo bảng SLO ở đầu tài liệu. Bài này không ghi dữ liệu khi chạy tải; bộ E2E tạo fixture trước đó có ghi **chỉ vào MySQL riêng của stack thử nghiệm**. Không truyền token hoặc dump của bệnh nhân thật vào k6. Ví dụ PowerShell từ gốc repo (Docker Desktop phải chạy):

```powershell
docker compose -p clinic-qos-7svc -f compose.yaml -f compose.e2e.yaml up -d --build
$smoke = & docker compose -p clinic-qos-7svc -f compose.yaml -f compose.e2e.yaml run --rm --no-deps -e E2E_ISOLATED_STACK=1 -e E2E_EXPORT_LOAD_FIXTURE=1 appointment python -m e2e_smoke 2>&1
if ($LASTEXITCODE -ne 0) { $smoke | Select-Object -Last 30; throw 'E2E failed' }
$fixtureLine = $smoke | Where-Object { $_ -like 'LOAD_FIXTURE *' } | Select-Object -Last 1
$fixture = $fixtureLine.Substring(13) | ConvertFrom-Json
$env:PATIENT_ACCESS_TOKEN = $fixture.patient_access_token
$env:LOAD_TEST_ISOLATED = '1'
try {
  docker run --rm --network clinic-qos-7svc_default -e PATIENT_ACCESS_TOKEN -e LOAD_TEST_ISOLATED -e VUS -e DURATION -v "${PWD}/services/load:/scripts:ro" grafana/k6:0.55.0 run /scripts/seven_services.js
  $k6ExitCode = $LASTEXITCODE
} finally {
  Remove-Item Env:PATIENT_ACCESS_TOKEN,Env:LOAD_TEST_ISOLATED -ErrorAction SilentlyContinue
  docker compose -p clinic-qos-7svc -f compose.yaml -f compose.e2e.yaml down
}
if ($k6ExitCode -ne 0) { throw "k6 thresholds failed (exit $k6ExitCode)" }
```

`down` không có `-v`, nên volume thử nghiệm được giữ lại; chỉ xóa volume sau khi tự xác nhận không cần dữ liệu đó nữa. Không chạy lệnh trên stack mặc định dùng dữ liệu thật. Có thể đặt `VUS=5` và `DURATION=30s` qua biến môi trường cho k6; mặc định là 10 VU/30 giây. Token fixture có hạn 15 phút, vì vậy cần chạy k6 ngay sau E2E.

Kết quả local ngày 23/10/2026, Docker Desktop 29.2.1/12 vCPU/giới hạn RAM 8,06 GB. Bài 10 VU chạy trên stack `clinic-qos-7svc` cùng máy với stack chính và các container khác; vì vậy số đo có thể bị nhiễu bởi tải nền. **Tất cả phản hồi đều thành công, nhưng bài 10 VU không đạt đủ threshold p95**:

| Service | API đọc | SLO p95 | p95 đo được, 10 VU | HTTP lỗi |
| --- | --- | ---: | ---: | ---: |
| Identity | `/identity/me` | < 500 ms | 321,39 ms | 0/160 |
| Registry | `/registry/patients/me` | < 500 ms | 841,96 ms — chưa đạt | 0/160 |
| Scheduling | `/scheduling/doctor-schedules` | < 800 ms | 210,26 ms | 0/160 |
| Appointment | `/appointments/me` | < 1.500 ms | 1.560 ms — chưa đạt | 0/160 |
| Billing | `/billing/invoices/me` | < 800 ms | 625,98 ms | 0/160 |
| Clinical | `/clinical/encounters/me` | < 1.500 ms | 1.160 ms | 0/160 |
| Laboratory | `/laboratory/orders/me` | < 800 ms | 2.140 ms — chưa đạt | 0/160 |

Tổng cộng 1.120/1.120 kiểm tra HTTP 200, 0 lỗi, khoảng 36,77 request/giây. Lần lặp 5 VU/30 giây sau đó cũng có 245/245 phản hồi thành công nhưng 4/7 service trượt p95 (Registry 7,62 s, Scheduling 2,24 s, Billing 2,68 s, Laboratory 6,90 s). Tại thời điểm kiểm tra, máy còn chạy stack chính và container OpenSearch khác sử dụng khoảng 359% CPU; đây là **yếu tố gây nhiễu có thể có**, chưa chứng minh là nguyên nhân duy nhất. Cần đo lại trên máy/stack không có tải nền, dùng dữ liệu đại diện hơn, rồi tối ưu các service trượt ngưỡng trước khi tuyên bố đạt SLO. Bài đọc này không thay thế bài tải luồng ghi đặt/hủy lịch, cũng không kiểm chứng SLA khả dụng 30 ngày.

### Đo lại sau khi dùng chung kết nối HTTP tới Identity

Sáu service nghiệp vụ trước đây tạo `httpx.AsyncClient` mới cho **mỗi lần** kiểm tra token qua Identity. Nay mỗi tiến trình giữ một client với connection pool theo vòng đời ứng dụng, đóng khi tắt; mỗi request **vẫn gọi Identity**, không cache trạng thái khóa tài khoản. Sau khi build lại stack cách ly với thay đổi này, ba lần đo cùng cấu hình 10 VU/30 giây đều đạt các threshold k6 đã khai báo; lần 3 chạy trên bản build cuối sau bài đặt/hủy lịch:

| Service | SLO p95 | Lần 1: 1.110 request/service | Lần 2: 986 request/service | Lần 3: 1.204 request/service |
| --- | ---: | ---: | ---: | ---: |
| Identity | < 500 ms | 50,12 ms | 58,50 ms | 45,92 ms |
| Registry | < 500 ms | 88,31 ms | 86,45 ms | 74,99 ms |
| Scheduling | < 800 ms | 13,27 ms | 14,43 ms | 9,89 ms |
| Appointment | < 1.500 ms | 75,82 ms | 88,97 ms | 67,69 ms |
| Billing | < 800 ms | 68,52 ms | 85,28 ms | 58,77 ms |
| Clinical | < 1.500 ms | 63,18 ms | 80,66 ms | 57,55 ms |
| Laboratory | < 800 ms | 64,35 ms | 76,11 ms | 60,93 ms |

Ba lượt có tổng cộng **23.100/23.100 HTTP 200, 0 lỗi**; throughput lần lượt 256,81, 229,27 và 279,42 request/giây. Bài tải ghi đặt → hủy lịch trên bản build cuối với threshold p95 **<1.500 ms**: 2 VU × 10 vòng, 20/20 đặt và 20/20 hủy thành công, p95 đặt **270,40 ms**, 0/40 lỗi. Ngưỡng này đã được siết từ 2.000 ms để khớp SLO Appointment và đã đo lại thành công.

Đây là bằng chứng **đạt SLO local dưới các mức tải và dữ liệu thử nghiệm nêu trên**, không phải SLA khả dụng 30 ngày hoặc bảo đảm khi dữ liệu/tải tăng. So sánh trước–sau có thể còn chịu tác động bởi tải nền của máy; muốn cam kết production cần môi trường đo riêng, dữ liệu đại diện, giám sát liên tục và ngân sách lỗi rõ ràng.
