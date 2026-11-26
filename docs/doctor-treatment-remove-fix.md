# Xóa chỉ định điều trị trước khi hoàn tất lượt khám — 12/11/2026

Đã thêm nút **Xóa chỉ định** trên mỗi mục điều trị của lượt khám đang khám/chờ kết luận. Nút áp dụng cho cả mục mới thêm và chỉ định đã khôi phục từ bản nháp chưa hoàn tất. Thay đổi nằm trên form và được gửi khi bác sĩ lưu bằng Tạm hoãn hoặc Hoàn thành; tải lại trước khi lưu có thể khôi phục bản nháp cũ.

Chỉ mục của lượt khám hiện tại được xóa. Không cung cấp nút xóa trong lịch sử hoàn tất hoặc cho liệu trình đã có buổi đặt/làm. Khóa thao tác khi đang lưu, chặn thêm trùng dịch vụ, dùng UUID cho mã tạm để bỏ rồi thêm lại không trùng mã.

Danh mục điều trị được lọc theo trạng thái active và chuyên khoa bác sĩ. Bác sĩ Nguyễn Văn An (LEGACY_BS001), Nội khoa, có 4 dịch vụ DV034–DV037: Truyền dịch, Tiêm thuốc, Tiêm tĩnh mạch, Tiêm bắp. Cùng chuyên khoa dùng chung danh mục; toàn bộ hệ thống hiện có 32 dịch vụ điều trị.

Kiểm tra frontend build, ESLint và git diff --check: đạt. Chrome kiểm tra 7 tình huống: danh mục Nội khoa 4 mục; bỏ chỉ định từ bản nháp; chặn trùng; bỏ/thêm lại; payload hoàn tất chỉ còn mục giữ; bỏ hết gửi treatments=[]; không lỗi JavaScript và giữ nguyên lượt khám thật. Phản hồi bản nháp được mô phỏng trong trình duyệt và POST hoàn tất bị chặn, không hoàn tất lượt của người dùng.

Bằng chứng: [doctor-treatment-remove-verification-2026-11-12.json](doctor-treatment-remove-verification-2026-11-12.json).
