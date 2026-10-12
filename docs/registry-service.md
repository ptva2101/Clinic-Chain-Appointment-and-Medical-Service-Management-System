# Liên kết Identity - Registry

Registry sở hữu `registry_db.patients`; Identity sở hữu `identity_db.accounts`. Khi bệnh nhân đăng ký, Identity tạo tài khoản chờ, gọi `PUT /api/v1/registry/internal/patients/{account_id}` trong mạng Docker, rồi lưu `patients.id` vào `accounts.subject_id` và kích hoạt tài khoản. `account_id` là UUID ổn định và Registry dùng cùng UUID làm ID hồ sơ; CCCD và `identity_account_id` đều unique. Gọi lại với cùng dữ liệu trả cùng hồ sơ; CCCD đã gắn tài khoản khác trả 409.

API nội bộ yêu cầu header `X-Service-Token` có giá trị `REGISTRY_INTERNAL_TOKEN`. Trong local, Compose truyền cùng biến cho hai service; trên môi trường chung phải thay bằng secret riêng, không dùng giá trị mẫu. Registry không mở CORS cho frontend. Identity gọi bằng `REGISTRY_INTERNAL_URL=http://registry:8000` và timeout 5 giây.

Nếu Registry lỗi, API đăng ký trả 503, tài khoản vẫn ở trạng thái chờ và không đăng nhập được. Đăng ký lại với cùng CCCD/mật khẩu hoặc đăng nhập đúng mật khẩu sau khi Registry hồi phục sẽ thử tiếp; thao tác Registry có tính idempotent. Tài khoản bệnh nhân cũ chưa có `subject_id` cũng được liên kết khi đăng nhập hợp lệ. Không sao chép dữ liệu bệnh nhân từ backend cũ.

Hồ sơ hiện chỉ có CCCD. `full_name`, `date_of_birth`, `phone` còn trống; chưa có API hoàn thiện hồ sơ, đặt lịch hay quyền truy cập Registry từ frontend. Việc có `subject_id` **không** làm tài khoản mới đăng nhập được vào dashboard cũ.

Chạy từ thư mục gốc repo:

```powershell
docker compose up --build -d registry identity
docker compose ps registry identity
docker build --target test -t medicare-services-test ./services
docker run --rm medicare-services-test
```

OpenAPI của Registry: `http://127.0.0.1:8002/docs`. API nội bộ không dành cho trình duyệt hoặc người dùng cuối.
