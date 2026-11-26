# Hiển thị liệu trình cũ trên giao diện bác sĩ — 11/11/2026

Liệu trình đã được lưu tại Clinical nhưng lớp chuyển đổi dữ liệu của giao diện bác sĩ chỉ tải lượt khám và xét nghiệm. Khi không nhận được phác đồ, lớp này trả danh sách điều trị rỗng. Việc gom các buổi cũng lấy trạng thái buổi đầu làm trạng thái cả liệu trình.

Đã bổ sung:

- `GET /api/v1/clinical/treatments/doctor`, lọc theo bác sĩ đang đăng nhập và tùy chọn `patient_id`. Bác sĩ chỉ thấy phác đồ do mình chỉ định.
- `GET /api/v1/clinical/treatments/{plan_id}/sessions` cho bệnh nhân sở hữu hoặc bác sĩ chỉ định đọc. Quyền đặt buổi vẫn thuộc bệnh nhân.
- Tải phác đồ và buổi điều trị cho lịch sử đợt khám, hồ sơ bệnh nhân đang khám và chi tiết lượt khám. Lỗi API được trả về thay vì âm thầm biến thành danh sách rỗng.
- Tổng hợp số buổi hoàn tất và trạng thái cả liệu trình: hoàn tất một phần hiển thị **Đang thực hiện**. Chỉ định trong bản nháp vẫn hiển thị số buổi với trạng thái **Chờ hoàn tất lượt khám**.

Clinical tiếp tục đọc database riêng của mình. Không thay schema, không truy cập database service khác và không nhập lại dữ liệu. Hợp đồng API mới có tại <http://127.0.0.1:8006/docs> và <http://127.0.0.1:8006/openapi.json>.

## Kiểm tra

- Kiểm thử Clinical/Laboratory: **9 passed**; toàn bộ `services/tests`: **91 passed, 5 skipped** trong image kiểm thử local, gắn source chỉ đọc. Các kiểm thử mới bao gồm lọc bác sĩ/bệnh nhân, chặn đọc chéo, giữ quyền bệnh nhân và từ chối truy vấn phác đồ không có phạm vi.
- Frontend build và ESLint hai file thay đổi: đạt.
- Trình duyệt Chrome với dữ liệu demo thật: bác sĩ thấy An **1/2 buổi, Đang thực hiện**; Bình **0/2 buổi, Chưa đặt lịch**; tải lại trang vẫn đúng; giao diện bệnh nhân vẫn hiển thị **Đã đi 1 / 2 buổi**.
- API thực tế: bác sĩ dự phòng không đọc được buổi điều trị của bác sĩ Minh; bệnh nhân An vẫn đọc được phác đồ của mình.
- Không có lỗi JavaScript. Kiểm tra chỉ đọc, không hoàn tất hay đặt thêm buổi thay người dùng.

Bằng chứng: [doctor-treatment-history-verification-2026-11-11.json](doctor-treatment-history-verification-2026-11-11.json).

## Xem trên giao diện

Tải lại trang bác sĩ → **Lịch sử đợt khám** → bấm lượt khám ban đầu đã chỉ định điều trị → **Liệu trình điều trị cũ**. Trong màn khám bệnh, chọn lượt khám cũ ở phần lịch sử bệnh nhân để xem cùng nội dung.
