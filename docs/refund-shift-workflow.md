# Hoàn tiền, hủy lịch và thay bác sĩ — 12/11/2026

Đã triển khai trên ứng dụng local BTL2, giữ nguyên 7 database riêng. Các service chỉ truy cập database của mình; phối hợp qua HTTP có xác thực token nội bộ.

## Quy tắc sử dụng

| Tình huống | Xử lý |
| --- | --- |
| Bệnh nhân chưa thanh toán, chưa check-in | Bệnh nhân tự hủy; trả chỗ, thông báo hủy; hóa đơn không còn thanh toán được |
| Đã thanh toán, chưa check-in | Admin bấm **Hoàn tiền & hủy lịch** trong Hóa đơn & Hoàn tiền; hoàn toàn bộ số đã trả sau BHYT, hủy lịch, trả chỗ và gửi thông báo |
| Đã check-in / đang khám / đã khám | Chặn hoàn tiền và hủy/chuyển lịch, kể cả gọi API trực tiếp |
| Admin hủy ca có lịch hẹn | Hủy các lịch chưa check-in; lịch đã trả tiền được hoàn mô phỏng, lịch chưa trả tiền không phát sinh hoàn; thông báo cho từng bệnh nhân |
| Admin chuyển bác sĩ của ca có lịch hẹn | Bác sĩ thay thế phải đang hoạt động, cùng chuyên khoa, rảnh đúng ngày/ca; cập nhật các lịch hẹn và thông báo tên bác sĩ cũ/mới; giữ ngày, ca, chi nhánh và tiền/BHYT |
| Ca có bất kỳ bệnh nhân đã check-in/khám | Từ chối cả thao tác trước khi hoàn tiền các lịch khác trong ca |
| Có giữ chỗ tạm hoặc lịch đặt đang xử lý | Yêu cầu đợi xử lý xong rồi thử lại |
| Hóa đơn lịch sử hoặc phương thức khác simulated | Không hoàn qua chức năng này |

Đây vẫn là hoàn tiền **mô phỏng**, không chuyển tiền ngân hàng. Mật khẩu/tập 33 bác sĩ và 2 chi nhánh không đổi trong đợt cập nhật này.

## Phối hợp và chống xử lý trùng

1. Scheduling giữ ca ở trạng thái `changing`, ẩn khỏi các chỗ có thể đặt mới. Khi chuyển bác sĩ, một dòng `reserved` giữ khóa duy nhất của bác sĩ mới/ngày/ca; dòng này không hiển thị như lịch trực bình thường.
2. Appointment khóa các lịch hẹn liên quan trong transaction, kiểm tra check-in rồi ghi `appointment_changes` và `change_operation_id`. Check-in khóa cùng bản ghi Appointment nên không thể cùng thắng với hoàn tiền.
3. Appointment gọi Billing để hoàn/freeze hóa đơn, Clinical để đồng bộ buổi điều trị, Scheduling để trả chỗ hoặc chốt ca. Mỗi bước chạy lại được; không giữ transaction database trong khi gọi service khác.
4. Khi các bước đã hoàn tất, Appointment cập nhật trạng thái/bác sĩ và lưu thông báo trong cùng transaction của mình. Hủy dùng sự kiện `cancelled`; chuyển bác sĩ dùng sự kiện theo operation ID để tránh gửi trùng khi thử lại.
5. Timeout/lỗi service trả thông báo đang xử lý, giữ reservation và last_error. Worker Appointment tiếp tục từ dữ liệu đã lưu; đồng thời tìm cả operation Scheduling đã tạo nhưng chưa gửi được sang Appointment.

Billing và Clinical kiểm tra bằng chứng reservation qua API Appointment trước khi áp dụng. Tiền/giá/BHYT không bị tính lại khi thay bác sĩ; mã bác sĩ trên hóa đơn hiện tại được cập nhật cho báo cáo. Trạng thái hóa đơn đã hoàn không thể thanh toán lại.

Buổi điều trị bị hủy được giữ trạng thái `cancelled`, không xóa lịch sử. Unique key chỉ áp dụng lên số buổi còn hoạt động, nên có thể đặt lại số buổi vừa hủy bằng request key mới. Giao diện bỏ qua buổi đã hủy khi dựng lịch, dùng khóa có thế hệ retry để tránh khôi phục lịch cũ.

Trang bệnh nhân tự tải lại lịch hẹn, hóa đơn và thông báo mỗi 15 giây khi đang hiển thị, hoặc khi quay lại cửa sổ. Có thể F5 để xem ngay. Admin thấy nút mới và có thể hủy/chuyển ca có lịch đặt; backend vẫn kiểm tra điều kiện sau bước xác nhận.

## API và migration

- Billing giữ `POST /api/v1/billing/invoices/{invoice_id}/simulate-refund`, nay điều phối sang Appointment để hoàn tiền kèm hủy.
- Appointment bổ sung `POST /api/v1/appointments/admin/{appointment_id}/refund-cancel`; các endpoint proof/shift-impact/shift-changes nội bộ yêu cầu service token.
- Scheduling giữ `/doctor-schedules/{id}/cancel` và `/transfer`, bổ sung endpoint nội bộ finish/abort/pending.
- Clinical bổ sung endpoint đồng bộ thay đổi buổi điều trị theo reservation.
- Schema: `appointment_changes`, `schedule_changes`, cột reservation của Appointment/hóa đơn, tên sự kiện thông báo dài hơn, trạng thái buổi điều trị `cancelled` và unique key số buổi đang hoạt động. Migration chạy lại được, không xóa lịch sử gốc.
- Hợp đồng OpenAPI sinh từ code hiện chạy tại cổng 8003, 8004, 8005, 8006: `/docs` và `/openapi.json`.
- `APPOINTMENT_INTERNAL_TOKEN` được cấu hình thống nhất cho các service tham gia và worker trong Compose.

## Kiểm tra đã thực hiện

- **96 passed, 5 skipped** trong bộ Python trên source cuối cùng; có kiểm thử timeout sau hoàn tiền và chống hoàn/gửi thông báo trùng khi tiếp tục.
- 7 nhóm HTTP/MySQL trên stack riêng: bệnh nhân hủy chưa trả tiền; Admin hoàn/hủy và gọi lặp; chặn check-in/đã khám/cả ca; hủy ca trả/chưa trả tiền; chuyển bác sĩ cùng chuyên khoa/rảnh ca; đặt lại buổi điều trị đã hủy; đồng thời check-in với hoàn tiền chỉ một bên thắng.
- Dừng Billing trên stack test: không báo thành công, giữ operation pending. Bật lại: worker tự hoàn tất với đúng một hoàn tiền và một thông báo.
- Chrome: 4 tình huống đạt — nút hoàn tiền/hủy, thông báo bệnh nhân khi quay lại trang, hủy ca có lịch đã trả tiền, modal chuyển bác sĩ có lịch đặt. Toàn bộ API của browser test được chuyển sang stack riêng, không thao tác lịch thật.
- Frontend production build và ESLint các file thay đổi đạt; không có lỗi JavaScript trong browser test. Không chạy kiểm thử tải mới cho đợt cập nhật này.

Bằng chứng: [HTTP nghiệp vụ](refund-shift-core-2026-11-12.json), [Billing gián đoạn](refund-shift-outage-2026-11-12.json), [worker phục hồi](refund-shift-resume-2026-11-12.json), [giao diện](refund-shift-browser-2026-11-12.json).

## Backup và kiểm tra lại

Backup đủ 7 database trước migration:

```text
/home/va/Documents/PTTKHT/BTL_2mon/BTL2/backups/clinic-before-booking-changes-20261112/seven-databases.sql.gz
```

SHA-256: `bbceb1abaf73bb82a42357375145040bf5f033eb0dd09bbf709d871a22343b27`, gzip đã kiểm tra đạt. Chỉ restore đồng bộ trên môi trường đã dừng ghi nếu cần phục hồi; không import file test vào ứng dụng chính.

Bộ kiểm thử ghi nằm ở `services/maintenance/verify_booking_changes.py`, có guard chỉ cho chạy trên cấu hình E2E riêng. Không dùng tài khoản hay lịch thật của người dùng để thử hoàn tiền/hủy ca.

Kiểm tra sau triển khai: cả 7 service ready, OpenAPI mới ở 4 service tham gia, không có operation hoàn/hủy hay hold browser test trong database chính. Bằng chứng: [main smoke](refund-shift-main-smoke-2026-11-12.json).
