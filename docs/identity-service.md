# Identity service

Identity chạy tại `http://127.0.0.1:8001`, OpenAPI tại `/docs` và `/openapi.json`. Service sở hữu riêng `identity_db` (`accounts`, `refresh_tokens`) và không truy vấn database của service khác khi chạy API. Mật khẩu băm bằng Argon2; refresh token chỉ lưu SHA-256 digest; access token JWT HS256 có hạn 15 phút, refresh token có hạn 7 ngày và được xoay khi dùng.

## Chạy local

Tại gốc repo, cần Docker Desktop:

```powershell
Copy-Item .env.example .env
docker compose up --build -d identity
docker compose ps identity
```

Identity tự khởi tạo/nâng cấp schema trước khi mở API, kể cả với volume MySQL đã tồn tại. Lần chạy đầu tạo admin từ `IDENTITY_ADMIN_USERNAME` và `IDENTITY_ADMIN_PASSWORD` trong `.env`; chạy lại không ghi đè mật khẩu. Các giá trị mẫu chỉ dành cho local: **đổi mật khẩu và `IDENTITY_JWT_SECRET` trước khi dùng trên môi trường chung**. Thay biến môi trường sau khi admin đã tạo không tự đổi mật khẩu trong database; dùng API đổi mật khẩu hoặc reset bởi admin khác. `.env` thật đã được gitignore.

## API

| Endpoint | Quyền | Tác dụng |
| --- | --- | --- |
| `POST /api/v1/identity/register` | Công khai | Tạo tài khoản bệnh nhân và hồ sơ Registry liên kết bằng CCCD 12 chữ số |
| `POST /api/v1/identity/login` | Công khai | Đăng nhập theo `role`, `username`, `password` |
| `POST /api/v1/identity/refresh` | Refresh token | Xoay refresh token và cấp access token mới |
| `POST /api/v1/identity/logout` | Refresh token | Thu hồi một refresh token; HTTP 204 |
| `POST /api/v1/identity/logout-all` | Bearer token | Thu hồi mọi refresh token và vô hiệu hóa access token cũ |
| `GET /api/v1/identity/me` | Bearer token | Xem tài khoản hiện tại |
| `POST /api/v1/identity/change-password` | Bearer token | Đổi mật khẩu; vô hiệu hóa mọi phiên cũ |
| `GET /api/v1/identity/accounts` | Admin | Liệt kê tài khoản có phân trang/lọc vai trò, không lộ mật khẩu |
| `POST /api/v1/identity/accounts` | Admin | Tạo tài khoản, `subject_id` là ID hồ sơ nghiệp vụ |
| `POST /api/v1/identity/accounts/{id}/reset-password` | Admin | Đặt lại mật khẩu, vô hiệu hóa mọi phiên cũ |
| `PATCH /api/v1/identity/accounts/{id}/disable` | Admin | Vô hiệu hóa tài khoản và mọi phiên |
| `PATCH /api/v1/identity/accounts/{id}/enable` | Admin | Kích hoạt lại tài khoản |

Vai trò: `admin`, `patient`, `doctor`, `letan`, `xnv`. Mật khẩu mới tối thiểu 12 ký tự. Sau 5 lần đăng nhập sai, tài khoản bị khóa 15 phút; thông báo đăng nhập vẫn chung để tránh lộ trạng thái tài khoản. CORS mặc định chỉ cho phép `localhost:5173` và `127.0.0.1:5173`, có thể cấu hình bằng `IDENTITY_CORS_ORIGINS`.

Đăng ký công khai **chỉ tạo vai trò `patient`**; client không thể gửi `role=admin` hay vai trò nhân viên. Ví dụ tạo tài khoản mới rồi đăng nhập:

```powershell
$base = 'http://127.0.0.1:8001/api/v1/identity'
$newAccount = @{ username = '001095012345'; password = '<mật khẩu mới từ 12 ký tự>' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/register" -ContentType 'application/json' -Body $newAccount
$login = @{ role = 'patient'; username = '001095012345'; password = '<cùng mật khẩu>' } | ConvertTo-Json
$tokens = Invoke-RestMethod -Method Post -Uri "$base/login" -ContentType 'application/json' -Body $login
```

Identity chỉ lưu thông tin xác thực. Khi đăng ký, Identity gọi API nội bộ của Registry để tạo hồ sơ bệnh nhân tối thiểu (CCCD), rồi lưu mã hồ sơ vào `accounts.subject_id`. Registry sở hữu bảng `patients`; hai service không truy cập database của nhau. Nếu Registry tạm lỗi, tài khoản ở trạng thái chờ và chưa đăng nhập được; gửi lại đăng ký với cùng CCCD/mật khẩu sẽ hoàn tất liên kết mà không tạo hồ sơ trùng. Tài khoản Identity bệnh nhân cũ có `subject_id` trống được bổ sung hồ sơ khi đăng nhập hợp lệ. Họ tên, ngày sinh, BHYT... chưa được thu thập/chuyển sang Registry trong luồng này; không coi hồ sơ tối thiểu là hồ sơ khám bệnh hoàn chỉnh.

Frontend dùng một giao diện tại `http://localhost:5173/`: tab “Đăng ký” tạo tài khoản và hồ sơ Registry, còn đăng nhập bệnh nhân gọi Identity ngay trên trang chính. Chạy frontend:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev
```

Phiên Identity không lưu token trong `localStorage`; tải lại trang sẽ kết thúc phiên giao diện. Các màn hình khám bệnh/đặt lịch trong app chính vẫn dùng backend cũ và **chưa** được kết nối với tài khoản Identity mới, dù tài khoản đã có mã hồ sơ Registry.

Ví dụ đăng nhập:

```powershell
$body = @{ role = 'admin'; username = 'admin'; password = '<mật khẩu trong .env>' } | ConvertTo-Json
$tokens = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8001/api/v1/identity/login' -ContentType 'application/json' -Body $body
Invoke-RestMethod -Uri 'http://127.0.0.1:8001/api/v1/identity/me' -Headers @{ Authorization = "Bearer $($tokens.access_token)" }
```

`logout` chỉ thu hồi refresh token; access token đã cấp có thể tồn tại thêm tối đa 15 phút. Dùng `logout-all` hoặc đổi mật khẩu để vô hiệu hóa access token ngay **tại Identity**. Các service khác chưa triển khai kiểm tra `token_version`/trạng thái tài khoản, vì vậy chưa thể đảm bảo thu hồi token tức thì ở toàn hệ thống. Không lưu token dài hạn trong `localStorage` khi tích hợp frontend.

## Tạo lại dữ liệu Identity local

Theo lựa chọn hiện tại, tài khoản cũ trong `identity_db` đã được xóa; chỉ tạo lại admin local. Công cụ dưới đây là thao tác **phá hủy dữ liệu Identity**, không tác động các database dịch vụ khác. Chỉ chạy khi thực sự muốn xóa toàn bộ tài khoản và phiên Identity:

```powershell
docker compose stop identity
docker compose run --rm --no-deps identity python -m identity.reset --confirm identity_db
docker compose up -d identity
```

Không dùng `docker compose down -v`: lệnh đó sẽ xóa cả volume MySQL chứa sáu database còn lại.

## Nhập tài khoản từ backend cũ (không cần cho luồng mới)

Backend cũ lưu mật khẩu trong các bảng `BENH_NHAN`, `BAC_SI`, `LE_TAN`, `XET_NGHIEM_VIEN`. Công cụ nhập chạy **một lần theo yêu cầu**, không nằm trong tiến trình Identity thường trực. Nó chỉ đọc database cũ và chỉ tạo tài khoản mới trong `identity_db`, băm lại mật khẩu; không xóa hoặc cập nhật bảng cũ. `admin` cũ dùng mật khẩu hard-code nên không nhập; dùng admin bootstrap mới.

1. Sao chép `services/identity/legacy-import.env.example` thành `services/identity/legacy-import.env`, điền thông tin MySQL cũ. File thật được gitignore. Nếu MySQL cũ chạy trên Windows host, thử `LEGACY_DB_HOST=host.docker.internal`; nếu chạy ở máy khác, dùng địa chỉ truy cập được từ Docker.
2. Chạy xem trước, xem các bộ đếm `ready`, `existing`, `conflicts`, `invalid` (không in mật khẩu):

```powershell
$image = docker compose images -q identity
$network = (docker inspect (docker compose ps -q identity) --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')
docker run --rm --network $network --env-file services/identity/legacy-import.env $image python -m identity.import_legacy
```

3. Nếu đã kiểm tra kết quả, thêm `--apply` vào cuối lệnh để ghi. Chạy lại sẽ bỏ qua tài khoản đã nhập cùng `role`, `username`, `subject_id`; trường hợp trùng username nhưng khác `subject_id` báo `conflicts` và không ghi đè. Cần xử lý xung đột thủ công. Sau khi xác nhận người dùng đăng nhập được qua Identity, mới lên kế hoạch loại bỏ mật khẩu cũ; công cụ này **không** tự xóa dữ liệu cũ.

Máy hiện chưa có cấu hình kết nối database backend cũ và người dùng đã chọn bắt đầu từ tài khoản mới, nên **không chạy import**. Frontend hiện vẫn gọi API đăng nhập/đăng ký cũ; chuyển frontend và bảo vệ các API nghiệp vụ cần làm theo giai đoạn để không làm hỏng các màn hình đang dùng.

## Kiểm thử và QoS

```powershell
docker build --target test -t medicare-services-test ./services
docker run --rm medicare-services-test
```

Kịch bản tải ở `services/load/identity.js` chạy 2 người dùng đồng thời trong 20 giây, mỗi vòng gọi login → me → logout. Cần cấp tài khoản test riêng qua admin, rồi chạy k6 trong cùng mạng Docker Compose:

```powershell
$env:IDENTITY_TEST_USERNAME = '<tài khoản test>'
$env:IDENTITY_TEST_PASSWORD = '<mật khẩu test>'
docker run --rm --network $network -e IDENTITY_TEST_USERNAME -e IDENTITY_TEST_PASSWORD -v "${PWD}/services/load:/scripts:ro" grafana/k6:0.55.0 run /scripts/identity.js
```

Ngưỡng kiểm thử hiện tại: lỗi HTTP dưới 1%, p95 thời gian phản hồi dưới 2 giây cho cấu hình local này. Lần đo 2026-10-12: 2 VU, 20 giây, 96 request/32 vòng, 0 lỗi, p95 = 429 ms; đây là kết quả thử local, **không phải cam kết SLA production**. Khi triển khai thật cần xác định phần cứng, mức tải, giám sát uptime, backup và mục tiêu khả dụng riêng.
