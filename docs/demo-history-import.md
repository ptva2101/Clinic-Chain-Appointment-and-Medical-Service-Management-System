# Nhập dữ liệu mẫu cũ vào MySQL

Dữ liệu nguồn gồm seed SQLite ở `Backend/init_db.py` (cả các phiên bản Git cũ), bản `Backend/hospital.db` có sẵn, hai file SQL lịch trực cũ và các mảng mẫu trong 5 dashboard React (bản hiện tại lẫn Git history). Công cụ chỉ **đọc** nguồn, chạy SQL seed trong SQLite **bộ nhớ**, rồi nhập vào MySQL của 6 service theo đúng nhóm nghiệp vụ. Không sửa `hospital.db` và không chạy lệnh reset database cũ.

Đã nhập 459 bản ghi từ seed hiện tại, 356 bản ghi frontend, 750 biến thể seed trong Git, 459 bản ghi từ `hospital.db`, và 1.728 bản ghi từ hai file lịch trực: tổng **3.752 bản ghi lịch sử** vào `historical_records` của Registry, Scheduling, Appointment, Billing, Clinical, Laboratory. Mỗi bản ghi có nguồn, loại, khóa và JSON gốc. Dữ liệu đã bị xóa khỏi Admin trước đây, như `AdminDashboard.branches` và `AdminDashboard.staffList`, được khôi phục từ Git. Dữ liệu frontend không đánh giá biểu thức JavaScript động; phần không phải literal được lưu nguyên văn trong `_raw_js` để không mất nguồn.

Ngoài bản ghi gốc, các bảng nghiệp vụ hiện có nhận bản sao không ghi đè từ seed hiện tại: 27 hồ sơ nhân viên Registry (23 bác sĩ, 2 lễ tân, 2 xét nghiệm viên), 2 chi nhánh, 30 dịch vụ, 60 cấu hình chi nhánh–dịch vụ, 248 ca trực và 5 lịch hẹn với `source='legacy_demo'`, `status='historical'`. Hồ sơ nhân viên mẫu ban đầu có `identity_account_id=NULL`, `source='legacy_demo'` để admin thấy trong danh sách nhưng chưa đăng nhập được; biến thể trùng mã từ giao diện/Git chỉ lưu trong `historical_records`. Ngày lịch cũ giữ nguyên (tháng 6–7/2026), không tạo lịch mới giả. Lịch trực trong hai file SQL dùng mã chi nhánh `CN01`/`CN02`, khác danh mục hiện hành `CN_CG`/`CN_HBT`, nên chỉ bảo tồn ở bảng lịch sử chứ không đưa vào lịch trực đang hoạt động. Import lịch sử không tự tạo tài khoản Identity; có công cụ riêng để chủ động kích hoạt 27 hồ sơ nhân viên local. Mật khẩu mẫu được thay bằng dấu `[REDACTED DEMO CREDENTIAL]`, không lưu hoặc kích hoạt nguyên văn.

Chạy lại trên máy có Node/npm, Python venv và MySQL Docker đã khởi động:

```powershell
cd Frontend
npm install
cd ..
services\.venv\Scripts\python.exe services/demo_import/import_history.py
services\.venv\Scripts\python.exe services/demo_import/import_history.py --apply
```

Cần clone đầy đủ lịch sử Git (không dùng `--depth 1`) để khôi phục cả những dữ liệu mẫu đã bị xóa khỏi mã nguồn hiện tại. Docker volume MySQL trên máy này không đi theo Git; mỗi máy clone cần chạy lệnh nhập riêng sau khi khởi động hệ thống.

Lệnh đầu chỉ kiểm kê. `--apply` dùng các tài khoản database phát triển trong `compose.yaml`; có thể cấu hình `DEMO_MYSQL_HOST`, `DEMO_MYSQL_PORT`, `DEMO_<SERVICE>_DB_PASSWORD`. Việc nhập có khóa duy nhất và `ON DUPLICATE KEY UPDATE` no-op: chạy lại không ghi đè bản ghi đang có. Tuy nhiên, đây là **dữ liệu mô phỏng**, không phải hồ sơ y tế thật hoặc lịch khám hiện hành. Không triển khai bộ dữ liệu này lên môi trường chứa dữ liệu bệnh nhân thật.

Để cấp tài khoản đăng nhập cho 27 hồ sơ nhân viên mẫu **chỉ trên máy local**, chạy sau khi đã nhập lịch sử:

```powershell
services\.venv\Scripts\python.exe services/demo_import/activate_staff.py
services\.venv\Scripts\python.exe services/demo_import/activate_staff.py --apply
```

Lệnh đầu xem trước, lệnh sau tạo tài khoản Identity với tên đăng nhập chính là mã nhân sự (`BS001`, `LT001`, `XNV001`...), mật khẩu khởi tạo chung `123456` được băm Argon2; Registry được liên kết bằng `identity_account_id`. Chỉ tác động hồ sơ `source='legacy_demo'`. Chạy lại không đặt lại mật khẩu và không mở khóa tài khoản mà admin đã vô hiệu hóa. Người dùng nên đổi mật khẩu ngay sau lần đăng nhập đầu; mật khẩu chung rất yếu, không dùng cách này ở môi trường công khai hoặc dữ liệu y tế thật. Hồ sơ vẫn giữ `source='legacy_demo'` để không nhầm người/số điện thoại mô phỏng với nhân viên thật.

Các bảng `historical_records` dành cho bảo tồn và tra cứu lịch sử. Catalog Registry và lịch trực Scheduling đọc từ bảng nghiệp vụ canonical; Admin có thể đọc 5 lịch hẹn cũ qua `GET /api/v1/appointments` với token Admin. Billing, Clinical và Laboratory vẫn đang phát triển API nghiệp vụ, nên bản ghi lịch sử của chúng chưa được coi là hóa đơn, bệnh án hoặc kết quả xét nghiệm thực tế.

Admin có thể tra cứu bản ghi gốc qua `GET /api/v1/{registry|scheduling|appointment|billing|clinical|laboratory}/history?entity=&source=&limit=&offset=` trên cổng tương ứng 8002–8007. API trả `items` và `total`, yêu cầu Bearer token Identity vai trò Admin. Bản ghi mẫu vẫn còn trong một số mảng giao diện React cũ; việc chuyển toàn bộ màn hình sang đọc API của từng service là công việc tiếp theo, không nên hiểu bản nhập lịch sử là đã hoàn tất phần giao diện.
