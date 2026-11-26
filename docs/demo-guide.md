# Bộ demo Medicare sau cơ cấu dữ liệu

Cập nhật 12/11/2026. Ứng dụng vẫn có **7 service và 7 database riêng**. Dữ liệu dùng cho môn học; thanh toán, BHYT và hoàn tiền là mô phỏng.

## Chạy ứng dụng

Tại thư mục repo BTL2:

```bash
docker compose up -d --build --wait
docker compose exec -T identity python -m demo_setup --apply --start-date 2026-11-11 --days 30
cd Frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Mở <http://127.0.0.1:5173/>. Chỉ cần `npm ci` lần đầu hoặc khi lockfile thay đổi. Lệnh sinh lịch có thể chạy lại: không nhân đôi, không thêm tài khoản/chi nhánh/dịch vụ.

Không nhập lại dump cũ `clinic-7db-complete-2026-10-23.sql.gz` lên bộ dữ liệu này vì sẽ khôi phục cả các tài khoản/chi nhánh vừa loại bỏ.

## Tài khoản

**Mật khẩu chung của TẤT CẢ 56 tài khoản còn lại: `123456`.** Đã đổi cả Admin, bệnh nhân và nhân viên. Phiên đăng nhập cũ bị thu hồi, cần đăng nhập lại. Trạng thái khóa của 13 tài khoản bệnh nhân cũ được giữ nguyên; đặt mật khẩu không đồng nghĩa mở khóa bệnh nhân. Cả 37 nhân viên được giữ đều đã mở hoạt động.

| Vai trò chọn trên giao diện | Tên đăng nhập | Ghi chú |
| --- | --- | --- |
| Admin | `admin` hoặc `demo_admin` | Hai tài khoản quản trị được giữ |
| Bệnh nhân | `990000000001` | Bệnh nhân demo An; BHYT mô phỏng 80% đã xác minh |
| Bệnh nhân | `990000000002` | Bệnh nhân demo Bình |
| Bác sĩ | `LEGACY_BS001` | Nguyễn Văn An, Nội khoa |
| Bác sĩ | `LEGACY_BS002` | Trần Thị Bình, Nội khoa |
| Lễ tân | `LEGACY_LT001` | Nguyễn Thị Hồng, CN01 |
| Lễ tân | `LEGACY_LT002` | Trần Minh Quân, CN02 |
| Xét nghiệm viên | `LEGACY_XNV001` | Phạm Đình Toàn, CN01 |
| Xét nghiệm viên | `LEGACY_XNV003` | Âu Thị Mai, CN02 |

Đủ 33 bác sĩ: `LEGACY_BS001` đến `LEGACY_BS033`, cùng mật khẩu. Các tài khoản `demo_doctor`, `demo_backup`, `demo_reception`, `demo_lab` và các nhân viên của hai cơ sở Smart Clinic đã được loại bỏ. Admin và bệnh nhân demo vẫn được giữ.

## Chi nhánh, chuyên khoa, dịch vụ và lịch trực

- CN01: Medicare - Cơ sở Thanh Xuân.
- CN02: Medicare - Cơ sở Cầu Giấy.
- 8 chuyên khoa bác sĩ: Nội khoa, Tim mạch, Cơ xương khớp, Da liễu, Mắt, Răng - Hàm - Mặt, Tai - Mũi - Họng, Sản - Phụ khoa.
- 65 dịch vụ gốc: 15 khám, 32 điều trị, 18 Cận lâm sàng; mỗi chi nhánh có đủ 65 cấu hình, giữ giới hạn 15 chỗ/ca/cấu hình.
- 30 ngày **11/11–10/12/2026**, đủ 4 ca/ngày, kể cả cuối tuần. Mỗi chi nhánh mỗi ca có 8 bác sĩ, một người/chuyên khoa. Tổng 1.920 phân công mới, 960/chi nhánh, không trùng cùng bác sĩ/ngày/ca giữa hai chi nhánh.
- 1.728 lịch trực quá khứ vẫn lưu trạng thái lịch sử. Tổng số dòng lịch trực sau cơ cấu và sinh mới là 3.648.

Danh sách tên từng bác sĩ, dịch vụ và giá: [database-restructure-plan.md](database-restructure-plan.md).

## Kịch bản xuyên suốt tại CN01

Chọn một ngày trong lịch còn hiệu lực từ ngày hiện tại trở đi. `LEGACY_BS001` trực **CN01, ca 1** mỗi ngày trong vòng xoay này.

1. Bệnh nhân `990000000001` chọn **CN01 — Medicare Thanh Xuân**, dịch vụ **DV001 — Khám nội tổng quát**, bác sĩ **Nguyễn Văn An — LEGACY_BS001**, **ca 1**. Tạo lịch, thanh toán mô phỏng. Giá 200.000 đ; BHYT mô phỏng 80% của An giảm 160.000 đ, còn 40.000 đ tại thời điểm tạo hóa đơn.
2. Đăng nhập lễ tân `LEGACY_LT001`, tìm đúng lịch trong ngày và check-in. Lễ tân CN02 không được check-in lịch CN01.
3. Đăng nhập bác sĩ `LEGACY_BS001`, mời bệnh nhân vào khám, nhập triệu chứng giả lập và thông tin khám. Chọn **DV016 — Xét nghiệm sinh hóa**, thêm chỉ định rồi bấm **Tạm hoãn - Chờ kết quả Xét nghiệm**.
4. Đăng nhập xét nghiệm viên `LEGACY_XNV001`, nhận đúng chỉ định tại CN01 và lưu kết quả giả lập. Xét nghiệm viên CN02 không được nhận chỉ định này.
5. Bác sĩ tải lại trang, mở **Đang khám / Chờ kết luận**, gọi/tiếp tục khám đúng bệnh nhân. Kiểm tra kết quả xét nghiệm, có thể thêm **DV034 — Truyền dịch**, chỉ định 2 buổi, rồi hoàn tất lượt khám. Đây là thao tác minh họa, không phải hướng dẫn điều trị thực tế.
6. Bệnh nhân vào **Lịch trình Điều trị & Sổ khám bệnh**, xem lượt khám, kết quả và phác đồ; chọn đặt từng buổi DV034 vào lịch còn chỗ của bác sĩ Nội khoa. Thanh toán, đến đúng ngày để lễ tân check-in; bác sĩ hoàn tất buổi. Lịch sử bác sĩ và bệnh nhân cùng hiển thị tiến độ.
7. Admin mở báo cáo theo chi nhánh/bác sĩ/dịch vụ và đối chiếu hóa đơn mô phỏng.

Kịch bản CN02: dùng bác sĩ `LEGACY_BS002` ở **ca 1**, lễ tân `LEGACY_LT002`, xét nghiệm viên `LEGACY_XNV003`; chọn cùng nhóm dịch vụ Nội khoa phù hợp.

## Kiểm tra và giới hạn

Admin vào **Hóa đơn & Hoàn tiền → Hoàn tiền & hủy lịch** để thực hiện cả hai bước trước check-in. Hủy ca có lịch hẹn sẽ tự hoàn tiền lịch đã trả, hủy các lịch liên quan và gửi thông báo; chuyển ca sang bác sĩ cùng chuyên khoa/rảnh giờ sẽ cập nhật bác sĩ và thông báo. Ca có bệnh nhân đã check-in/khám bị chặn. Xem [chi tiết và kết quả kiểm thử](refund-shift-workflow.md).

```bash
docker compose exec -T identity python -m maintenance.verify_medicare
```

Lệnh này kiểm tra đọc API và đăng nhập; không tạo lượt khám. Kiểm thử nghiệp vụ có ghi chỉ được chạy trên stack tách biệt với `--exercise`; các lượt kiểm thử trước áp dụng không được đưa vào database chính.

`demo_verify.py` là bộ kiểm tra fixture tổng quát, có chặn stack chính. Không dùng nó để tạo lại bộ CN_DEMO. `demo_setup.py` trên stack chính chỉ sinh lịch cho đúng tập 33 bác sĩ và 2 chi nhánh đã cơ cấu.

Lịch sử gốc của hai chi nhánh được giữ. Hai xét nghiệm viên đã loại bỏ vẫn có tên/mã gốc lưu trên kết quả cũ, không đổi người thực hiện. Các lượt demo cũ thuộc ba chi nhánh bị bỏ đã được sao lưu và dọn khỏi database chạy ứng dụng.
