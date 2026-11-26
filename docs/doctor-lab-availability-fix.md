# Chỉ định xét nghiệm không khả dụng — 11/11/2026

`DV030` (CT bụng) có `TrangThai=inactive` trong Registry. Clinical từ chối mã này đúng quy tắc, nhưng giao diện bác sĩ vẫn cho chọn từ toàn bộ danh mục, làm thao tác **Tạm hoãn - Chờ kết quả Xét nghiệm** nhận lỗi `Laboratory service DV030 is unavailable`.

Đã sửa giao diện:

- Chỉ cho chọn xét nghiệm và điều trị có trạng thái `active`; vẫn giữ toàn bộ danh mục để tra tên dịch vụ trong hồ sơ cũ.
- Chặn thêm trùng xét nghiệm trong cùng lượt khám.
- Thêm **Bỏ chỉ định chưa gửi** cho chỉ định mới còn ở trình duyệt. Chỉ định đã lưu không có nút này.
- Dùng mã tạm duy nhất khi thêm chỉ định, tránh trùng mã sau khi bỏ rồi thêm lại.
- Hiển thị thông báo tiếng Việt kèm tên dịch vụ nếu backend từ chối mã không khả dụng.

Không đổi trạng thái dịch vụ trong Registry, không xóa chỉ định đã lưu và không thay đổi backend.

Kiểm tra: frontend build, ESLint và `git diff --check` đạt. Chrome xác nhận danh mục đúng trạng thái, chặn trùng, bỏ chỉ định tạm và tạo payload tạm hoãn đúng. POST lưu lượt khám được chặn trong trình duyệt; hàng chờ và bệnh án thật không thay đổi, không có lỗi JavaScript. Clinical gọi Registry thực tế: từ chối DV030, chấp nhận DEMO_XN với giá 80.000 đ.

Bằng chứng: [doctor-lab-availability-verification-2026-11-11.json](doctor-lab-availability-verification-2026-11-11.json).

Khi demo, bỏ CT bụng khỏi chỉ định chưa gửi, chọn **[DEMO] Xét nghiệm minh họa**, thêm chỉ định rồi tạm hoãn. Tải lại trang chỉ giữ nội dung đã lưu; cần lưu ý nội dung vừa nhập chưa gửi trước khi F5.
