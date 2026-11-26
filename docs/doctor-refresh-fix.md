# Khôi phục ca đang khám sau F5 — 11/11/2026

## Hiện tượng và nguyên nhân

Lượt khám demo của An vẫn tồn tại ở Appointment với `queue_state=examining`; Clinical giữ bản nháp và Laboratory đã trả kết quả. Màn bác sĩ chỉ liệt kê `waiting` và `conclusion`, trong khi mã ca đang mở chỉ được giữ trong React state. F5 xóa lựa chọn đó, làm ca `examining` không xuất hiện ở bảng nào.

Form nhập triệu chứng/chẩn đoán/thuốc cũng chưa được nạp từ bản nháp khi mở lại, dù nội dung đã lưu vẫn còn tại Clinical.

## Thay đổi

- Bảng **Đang khám / Chờ kết luận** hiển thị cả hai trạng thái, có cột trạng thái riêng.
- **Tiếp tục khám** mở ca `examining` mà không gửi lại bước chuyển `examining → examining` không hợp lệ.
- **Gọi lại vào phòng** vẫn chuyển ca `conclusion → examining` theo API cũ.
- Nạp lại lượt khám và xét nghiệm đã lưu cho các ca đang xử lý; bảng hiển thị số kết quả đã có.
- Khi mở hồ sơ, nạp triệu chứng, chẩn đoán, lời dặn và đơn thuốc đã lưu trước khi mở form. Ca mới bắt đầu từ form rỗng.
- Chỉ sửa frontend; không reset lịch hẹn, đổi ngày hẹn, trả chỗ hoặc hoàn tất khám thay người dùng.

## Kiểm tra

| Tình huống | Kết quả |
| --- | --- |
| Đăng nhập lại, thấy ca đang khám của An và kết quả 1/1 | PASS, dữ liệu thật của lượt demo |
| F5 khi đang mở ca, bấm Tiếp tục khám; bản nháp và kết quả hiện lại | PASS, không gửi thêm POST chuyển trạng thái |
| Ca chờ kết luận vẫn gọi lại vào phòng được | PASS, phản hồi queue/transition được mô phỏng trong trình duyệt để giữ nguyên lượt của người dùng |
| Ca hoàn tất không hiện ở danh sách đang xử lý | PASS, phản hồi queue được mô phỏng trong trình duyệt |
| Mã lịch, trạng thái đang khám, bản nháp và thời điểm cập nhật không bị thay đổi bởi kiểm tra | PASS |
| Lỗi JavaScript trong browser | 0 |
| Frontend build và ESLint file bác sĩ | PASS |

Bằng chứng: [doctor-refresh-verification-2026-11-11.json](doctor-refresh-verification-2026-11-11.json). Các kiểm tra giao diện không tự bấm Hoàn thành lượt khám và không làm thay đổi bệnh án đang thử.

Nội dung đã lưu được khôi phục; các thay đổi chỉ gõ trên form mà chưa lưu vẫn có thể mất khi F5. Sau khi xét nghiệm viên lưu kết quả, bác sĩ tải lại trang, mở đúng bệnh nhân từ bảng trên rồi tiếp tục kết luận.
