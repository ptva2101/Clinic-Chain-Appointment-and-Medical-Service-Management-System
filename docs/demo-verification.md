# Kiểm tra bộ demo hiện tại

Bộ dữ liệu hiện tại đã cơ cấu ngày **12/11/2026** về 33 bác sĩ gốc và 2 chi nhánh Medicare. Xem [kết quả cơ cấu, backup và kiểm thử](database-restructure-result.md), [tài khoản/kịch bản mới](demo-guide.md).

- Database: đúng 33 bác sĩ, 2 chi nhánh, 2 lễ tân, 2 xét nghiệm viên, 65 dịch vụ, 130 cấu hình.
- Mật khẩu của cả 56 tài khoản còn lại đã đặt `123456`; 43 tài khoản đang hoạt động đăng nhập được qua API.
- 1.920 lịch mới từ 11/11 đến hết 10/12/2026, đúng vòng xoay, chạy lại không tạo thêm.
- 94 kiểm thử Python đạt, 5 bỏ qua; frontend build và ESLint đạt.
- 12 nhóm kiểm tra API nghiệp vụ trên bản sao đã cơ cấu đạt; 6 nhóm đọc API trên ứng dụng chính đạt. Không đưa các lượt kiểm thử ghi vào database chính.
- 8 tình huống Chrome đạt, đủ 5 vai trò và hai chi nhánh; không có lỗi JavaScript hoặc HTTP 5xx. File 7 database mới đã thử phục hồi và audit thành công.

Các báo cáo JSON ngày 09/11 thuộc bộ CN_DEMO trước cơ cấu, dùng làm bằng chứng lịch sử. Không dùng tài khoản/chi nhánh của bộ đó để đăng nhập hoặc đặt khám hiện tại.
