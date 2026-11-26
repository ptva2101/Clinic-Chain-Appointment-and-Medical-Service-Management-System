# Sửa đồng nhất số chỗ trống — 12/11/2026

## Nguyên nhân

Giao diện Patient trước đây dùng `bookings` của riêng bệnh nhân để đếm số lượt đặt. Bộ lọc chỉ xét chi nhánh/ngày/ca, thiếu mã dịch vụ. Điều này gây hai lỗi: An thấy các dịch vụ cùng bị trừ chỗ, còn Bình không nhìn thấy các lượt An đã đặt. Chỉ bước xác nhận cuối mới gọi Scheduling để kiểm tra chỗ thật.

Scheduling đã tính số chỗ chung đúng theo **cấu hình chi nhánh–dịch vụ + ngày + ca**. Bác sĩ phải có lịch trực phù hợp; số chỗ không được suy ra từ danh sách lịch hẹn của riêng một người.

## Thay đổi

- `Frontend/src/shared/useSlotAvailability.js` lấy số chỗ của bốn ca từ API Scheduling cho đúng dịch vụ, chi nhánh và ngày hiện chọn. Đặt lịch khám và đặt buổi điều trị cùng dùng cách này.
- Thay dịch vụ/ngày/chi nhánh sẽ bỏ số liệu của lựa chọn trước. Yêu cầu cũ bị hủy và kết quả đến muộn không thể ghi đè lựa chọn mới.
- Khi chưa tải xong hoặc Scheduling lỗi, giao diện không giả định còn 15 chỗ. Thông báo đang tải/lỗi được hiển thị, kèm nút thử lại khi lỗi.
- Tự làm mới mỗi 10 giây, khi quay lại cửa sổ/tab và sau khi đặt/hủy/ghi nhận thanh toán. Các tab cùng trình duyệt có thêm BroadcastChannel để yêu cầu làm mới ngay. Các trình duyệt/máy khác dùng polling và tải mới khi đăng nhập.
- Bước xác nhận vẫn kiểm tra Scheduling; thao tác giữ chỗ được backend xử lý trong giao dịch có khóa, tránh vượt sức chứa nếu hai người đặt cùng lúc.
- Giữ nguyên giá trị giới hạn 0 từ cấu hình, không dùng 15 làm mặc định cho trường hợp này.

Chỗ được giữ khi đặt lịch thành công, trước khi thanh toán. Thanh toán không trừ thêm một lần. Hủy lịch hợp lệ/giải phóng giữ chỗ sẽ trả lại số chỗ theo nghiệp vụ hiện có.

## Dữ liệu đối chiếu

Tại thời điểm kiểm tra, `CN02_DV003` (khám nội tiết), ngày **12/11/2026**, ca 1, bác sĩ `LEGACY_BS002` — Trần Thị Bình có **2 lịch confirmed**, giới hạn 15 nên còn **13** chỗ. `CN02_DV004` cùng ngày/ca chưa có lịch nên còn **15**. Giữ nguyên cả hai lịch đã có.

## Kiểm tra

Build Vite, lint ba file thay đổi và `git diff --check` đều đạt. Tám nhóm kiểm tra Chrome đều đạt, không có lỗi JavaScript:

1. An và Bình hiển thị cùng số chỗ 13 và đúng bác sĩ.
2. Đổi qua bốn dịch vụ Nội khoa lấy đúng sức chứa riêng của từng dịch vụ.
3. Đổi chi nhánh/ngày không dùng lại số liệu của lựa chọn cũ.
4. Tạo giữ chỗ tạm thật: hai phiên độc lập và một bệnh nhân đăng nhập sau đều thấy 13 → 12.
5. Giải phóng giữ chỗ: các phiên trở về 13, dịch vụ khác vẫn 15.
6. Mô phỏng lỗi Scheduling: không hiển thị số chỗ giả, chặn xác nhận; thử lại tải đúng dữ liệu.
7. Mô phỏng hết chỗ: không cho đặt.
8. Đặt buổi điều trị cũng hiển thị số chỗ chung, giảm/trả lại đúng khi giữ/giải phóng chỗ.

Bài kiểm tra chỉ tạo giữ chỗ tạm rồi giải phóng; không tạo hoặc thay đổi lịch khám, hóa đơn, check-in hay tài khoản. Kết quả: `docs/slot-availability-browser-2026-11-12.json`.
