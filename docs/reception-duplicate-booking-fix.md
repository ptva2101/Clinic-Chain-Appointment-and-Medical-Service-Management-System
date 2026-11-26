# Sửa tên bác sĩ ở lễ tân và ngăn đặt trùng ca — 12/11/2026

## Tên bác sĩ ở hàng đợi lễ tân

Giao diện cũ dựng hồ sơ bác sĩ từ `doctorSchedules`. API lịch trực chỉ cung cấp mã bác sĩ, chi nhánh, ngày, ca và trạng thái, nên không phải nguồn tên/chuyên khoa. Khi thiếu tên, giao diện dùng mã bác sĩ thay tên; trường tên cũ có thể sai sau chuyển ca.

Giao diện hiện lấy tên, chuyên khoa và số điện thoại từ `catalogData.doctors` của Registry, ghép bằng `MaBacSi`. Lịch trực chỉ dùng để xác định bác sĩ đang trực tại chi nhánh/ngày hiện tại. Bản ghi ca không hoạt động không được đưa vào danh sách tải hàng đợi.

Đã kiểm tra phòng `LEGACY_BS002` hiển thị **Trần Thị Bình — Nội khoa** ở CN02. Kiểm tra thêm hai phòng ở mỗi chi nhánh với tên/chuyên khoa trên lịch trực bị cố tình thay bằng dữ liệu cũ trong trình duyệt: tiêu đề vẫn khớp đúng hồ sơ Registry. Dữ liệu giả lập này chỉ dùng trong kiểm tra trình duyệt, không ghi database.

## Chặn cùng bệnh nhân đặt trùng ca

Một bệnh nhân chỉ được giữ/đặt **một lịch trong cùng ngày và cùng ca**, kể cả khi đổi dịch vụ, bác sĩ hoặc chi nhánh. Người khác vẫn đặt được ca đó; cùng bệnh nhân vẫn được chọn ngày/ca khác. Áp dụng chung cho đặt khám và đặt buổi điều trị vì cả hai đều đi qua Scheduling.

Scheduling bổ sung bảng `patient_slot_locks` và chỉ mục `ix_hold_patient_slot`. Trong một giao dịch, service khóa theo `(patient_id, duty_date, shift)`, kiểm tra giữ chỗ chưa hết hạn/lịch đã xác nhận trước khi thêm giữ chỗ và tăng inventory. Khóa bao trùm các cấu hình dịch vụ khác nhau, nên hai tab cùng đặt không thể lấy hai slot.

- Yêu cầu trùng ca trả **HTTP 409** với thông báo tiếng Việt, không tạo lịch và không trừ slot.
- Gửi lại đúng idempotency key vẫn trả về giữ chỗ/lịch cũ để hỗ trợ thử lại khi mạng lỗi.
- Sau khi hủy hợp lệ và giải phóng giữ chỗ, hoặc giữ chỗ hết hạn, có thể đặt lại.
- Giao diện hiển thị thông báo và khóa nút xác nhận nếu danh sách lịch cá nhân đã có ca đó. Backend vẫn kiểm tra độc lập để chặn hai tab hoặc gọi API trực tiếp.
- Đã cập nhật mô tả OpenAPI của API tạo giữ chỗ và API đặt lịch.

Hệ thống vẫn có 7 database. Bảng khóa mới thuộc `scheduling_db`; không bổ sung truy cập database của service khác.

## Hai lịch trùng cũ của An

Ca 1 ngày **12/11/2026**, `CN02_DV003`, bác sĩ `LEGACY_BS002` có hai lịch của An:

- `120e2121-b507-401d-b127-75e24f717a50`.
- `b1034419-bf2b-4181-9582-6f224aff4978`.

Cả hai đều đã thanh toán **50.000đ/lịch** và đã check-in, trạng thái hàng đợi `waiting`. Hai lịch/hóa đơn được giữ nguyên theo yêu cầu trước đây: chỉ được hủy/hoàn trước check-in. Việc sửa này ngăn lịch trùng mới; không tự sửa lịch sử thanh toán hoặc hoàn tiền sau check-in. Vì hai lịch cũ vẫn tồn tại, ca đó hiện còn **13/15** chỗ.

Đã sao lưu trước thay đổi: `../backups/clinic-before-duplicate-booking-fix-20261112/seven-databases.sql.gz`.

## Kiểm thử

- Build Vite, lint hai giao diện và `git diff --check`: đạt.
- Bộ kiểm thử nghiệp vụ: **95 passed, 3 skipped**, bao gồm kiểm tra MySQL thật trên instance tạm ở cổng 13317. Instance này đã tắt sau kiểm thử.
- Kiểm tra mới gửi **20 yêu cầu đồng thời** của cùng bệnh nhân qua bốn dịch vụ/hai chi nhánh: chỉ một giữ chỗ thành công. Kiểm tra thêm thử lại cùng key, giữ chỗ đã xác nhận, người khác, ca/ngày khác, hủy/đặt lại và hết hạn/đặt lại.
- Ba bài thuộc bộ nhập dữ liệu cũ không chạy được trong container vì thiếu Git và `/Backend/init_db.py`; module `test_demo_import.py` được loại khỏi lần chạy hồi quy cuối. Đây là giới hạn môi trường kiểm thử bộ import, không phải bài chống đặt trùng.
- **7 nhóm Chrome/API đạt**: tên thật của phòng CN02; tên phòng ở hai chi nhánh khi lịch có tên cũ sai; UI chặn cùng ca nhưng cho ca khác; API Appointment/Scheduling chặn trùng và giữ nguyên slot; thử lại đúng key không tạo lịch mới; bệnh nhân khác vẫn chọn được ca đó.
- Đối chiếu sau thử nghiệm: lịch/hóa đơn/check-in đang có, slot inventory và 56 tài khoản được giữ nguyên.

Kết quả chi tiết: `docs/reception-duplicate-booking-browser-2026-11-12.json` và `docs/reception-duplicate-booking-main-2026-11-12.json`.
