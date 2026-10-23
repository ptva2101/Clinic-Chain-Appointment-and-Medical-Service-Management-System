# Registry: hồ sơ bệnh nhân và nhân viên

Registry sở hữu `registry_db.patients` và `registry_db.staff_profiles`; Identity sở hữu `identity_db.accounts`. Khi bệnh nhân đăng ký, Identity tạo tài khoản chờ, gọi `PUT /api/v1/registry/internal/patients/{account_id}` trong mạng Docker, rồi lưu `patients.id` vào `accounts.subject_id` và kích hoạt tài khoản. `account_id` là UUID ổn định và Registry dùng cùng UUID làm ID hồ sơ; CCCD và `identity_account_id` đều unique. Gọi lại với cùng dữ liệu trả cùng hồ sơ; CCCD đã gắn tài khoản khác trả 409.

API nội bộ yêu cầu header `X-Service-Token` có giá trị `REGISTRY_INTERNAL_TOKEN`. Trong local, Compose truyền cùng biến cho hai service; trên môi trường chung phải thay bằng secret riêng, không dùng giá trị mẫu. Registry chỉ mở CORS cho frontend local theo `REGISTRY_CORS_ORIGINS`; các API nội bộ không dùng từ trình duyệt. Identity gọi bằng `REGISTRY_INTERNAL_URL=http://registry:8000` và timeout 5 giây.

Nếu Registry lỗi, API đăng ký trả 503, tài khoản vẫn ở trạng thái chờ và không đăng nhập được. Đăng ký lại với cùng CCCD/mật khẩu hoặc đăng nhập đúng mật khẩu sau khi Registry hồi phục sẽ thử tiếp; thao tác Registry có tính idempotent. Tài khoản bệnh nhân cũ chưa có `subject_id` cũng được liên kết khi đăng nhập hợp lệ. Không sao chép dữ liệu bệnh nhân từ backend cũ.

Sau khi đăng nhập, bệnh nhân có thể xem và cập nhật hồ sơ của chính mình qua:

| API | Quyền | Nội dung |
| --- | --- | --- |
| `GET /api/v1/registry/patients/me` | Bearer token Identity vai trò `patient` | Trả CCCD, họ tên, ngày sinh, điện thoại |
| `PATCH /api/v1/registry/patients/me` | Bearer token Identity vai trò `patient` | Cập nhật một hoặc nhiều trường `full_name`, `date_of_birth`, `phone` |
| `GET /api/v1/registry/patients?q=&limit=20&offset=0` | Bearer token Identity vai trò `admin` | Danh sách hồ sơ bệnh nhân có tìm kiếm CCCD/họ tên/SĐT và phân trang; trả `items`, `total`, `limit`, `offset` |

Registry hỏi Identity `/me` để xác thực token và trạng thái tài khoản, không giữ khóa ký JWT hay truy vấn `identity_db`. Truy vấn hồ sơ luôn giới hạn bằng cả `identity_account_id` và `subject_id`, nên không có API xem/sửa hồ sơ người khác bằng cách đoán ID. CCCD không được sửa qua PATCH. Tên không được rỗng, ngày sinh không ở tương lai, điện thoại gồm 9–15 chữ số (có thể có dấu `+` ở đầu). Gửi `null` để xóa một trường tùy chọn. API trả `Cache-Control: no-store`; CORS mặc định chỉ cho frontend local, có thể đổi qua `REGISTRY_CORS_ORIGINS`.

Frontend hiện hiển thị form hồ sơ cơ bản sau khi bệnh nhân đăng nhập. Bảng bệnh nhân trong Admin đọc Registry, không còn hiển thị các hồ sơ mẫu; họ tên, ngày sinh và SĐT sẽ trống cho tới khi bệnh nhân cập nhật hồ sơ. Registry hiện chưa lưu địa chỉ/BHYT. Khi trang đang mở, token Identity được làm mới trong bộ nhớ; tải lại trang phải đăng nhập lại. Có `subject_id` **không** làm tài khoản mới dùng được dashboard đặt lịch cũ.

## Hồ sơ nhân viên

Admin cấp tài khoản bác sĩ/lễ tân/xét nghiệm viên qua `POST /api/v1/identity/accounts` với `role`, `username`, `subject_id` (mã nhân sự), `full_name`, `password` và tùy chọn `phone`, `specialty`, `branch_code`. Identity lưu tài khoản ở trạng thái chờ, gọi `PUT /api/v1/registry/internal/staff/{account_id}`, sau đó mới kích hoạt. Nếu Registry tạm lỗi, API trả 503 và tài khoản **không thể đăng nhập**; admin gửi lại cùng mã đăng nhập/mã nhân sự/mật khẩu để hoàn tất. Mã nhân sự và `identity_account_id` đều duy nhất. Mã đã gắn tài khoản khác trả 409. Tài khoản nhân viên cũ đang hoạt động được tạo hồ sơ tối thiểu từ mã đăng nhập khi đăng nhập lần đầu; trường họ tên khi đó chỉ là mã đăng nhập, cần hoàn thiện sau.

| API | Quyền | Nội dung |
| --- | --- | --- |
| `PUT /api/v1/registry/internal/staff/{account_id}` | Service token Identity | Tạo hồ sơ nhân viên idempotent |
| `GET /api/v1/registry/staff/me` | Bearer token Identity vai trò nhân viên | Xem hồ sơ của chính mình |
| `GET /api/v1/registry/staff?q=&limit=20&offset=0` | Bearer token Identity vai trò `admin` | Danh sách hồ sơ nhân viên đã liên kết và hồ sơ mẫu, có tìm kiếm và phân trang; trường `source` cho biết nguồn |

Registry hỏi Identity `/me` để kiểm tra token và trạng thái tài khoản; truy vấn staff của chính mình luôn giới hạn bằng `identity_account_id` và `subject_id`. Frontend lấy hồ sơ này khi nhân viên đăng nhập để hiện họ tên, chuyên khoa và chi nhánh. Danh sách hồ sơ nhân viên đọc từ Registry. 27 hồ sơ seed cũ vẫn được đánh dấu `source=legacy_demo` để giữ nguồn gốc; công cụ kích hoạt local có thể tạo tài khoản Identity và điền `identity_account_id` cho chúng. Khi đã liên kết, hồ sơ đăng nhập được và được tính là nhân viên hoạt động. Đây vẫn là tên/số điện thoại mô phỏng, không phải nhân viên ngoài đời. Registry chưa có API cập nhật nhân viên hay API đặt lịch.

## Danh mục thật

Registry lưu chi nhánh, dịch vụ y tế và cấu hình dịch vụ theo chi nhánh trong ba bảng riêng, ban đầu rỗng; không nhập dữ liệu mẫu. `GET /api/v1/registry/catalog/{branches|services|branch-services}` trả danh sách công khai để các màn hình đọc. Tài khoản Admin dùng Bearer token Identity để gọi `POST /catalog/branches`, `POST /catalog/services`, `PATCH /catalog/services/{code}/price`, `PUT /catalog/branch-services/{code}` và `PATCH /catalog/branch-services/{code}`. Mọi mã và giá được kiểm tra trước khi lưu; mã trùng hoặc chi nhánh/dịch vụ chưa tồn tại trả 409. Chưa hỗ trợ xóa danh mục thật vì các service khác có thể đang tham chiếu; nút xóa chỉ thay đổi giao diện trước đây đã được bỏ.

Chạy từ thư mục gốc repo:

```powershell
docker compose up --build -d registry identity
docker compose ps registry identity
docker build --target test -t medicare-services-test ./services
docker run --rm medicare-services-test
```

OpenAPI của Registry: `http://127.0.0.1:8002/docs`. API `/internal` không dành cho trình duyệt hoặc người dùng cuối. `GET/PATCH /patients/me` và `GET /staff/me` cần access token từ Identity.

## Kiểm thử tải và QoS local

`services/load/registry.js` đọc hồ sơ bằng token bệnh nhân, 2 VU trong 20 giây; ngưỡng kiểm thử: lỗi HTTP dưới 1%, p95 dưới 2 giây. Đây là mục tiêu test local, **không phải SLA production**. Cần đăng nhập một tài khoản bệnh nhân test đã liên kết Registry, lấy `access_token` và chạy trước khi token hết hạn (15 phút):

```powershell
$body = @{ role = 'patient'; username = '<CCCD bệnh nhân test>'; password = '<mật khẩu>' } | ConvertTo-Json
$tokens = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8001/api/v1/identity/login' -ContentType 'application/json' -Body $body
$env:REGISTRY_PATIENT_ACCESS_TOKEN = $tokens.access_token
$network = (docker inspect (docker compose ps -q registry) --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')
docker run --rm --network $network -e REGISTRY_PATIENT_ACCESS_TOKEN -v "${PWD}/services/load:/scripts:ro" grafana/k6:0.55.0 run /scripts/registry.js
Remove-Item Env:REGISTRY_PATIENT_ACCESS_TOKEN
```

Không dùng tài khoản thật hoặc chạy test tải trên môi trường production. Bài đo mới trên stack và tài khoản tổng hợp đã đọc API Registry cùng sáu service còn lại; xem [kết quả và các ngưỡng chưa đạt](qos.md). Lệnh phía trên chỉ dành cho tài khoản test riêng, không dùng bản dump chia sẻ.
