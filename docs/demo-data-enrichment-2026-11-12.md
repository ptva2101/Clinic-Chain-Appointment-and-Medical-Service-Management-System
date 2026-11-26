# Dữ liệu demo bổ sung — 12/11/2026

Đã nạp dữ liệu vào hệ thống Docker đang chạy, vẫn giữ **7 database** độc lập. Identity và Registry không bị thay đổi: **56 tài khoản, 17 hồ sơ bệnh nhân, 37 hồ sơ nhân viên, 2 chi nhánh**. Giữ nguyên mật khẩu và trạng thái khóa/mở. Không ghi đè các lượt khám, hóa đơn, kết quả hay liệu trình đã có.

## Dữ liệu đã thêm

| Nhóm | Số lượng thêm |
|---|---:|
| Lượt khám hoàn thành, tháng 8–11/2026 | 132 |
| Kết quả xét nghiệm hoàn thành | 44 |
| Liệu trình điều trị | 24 |
| Buổi điều trị hoàn thành | 48 |
| Buổi điều trị còn chưa đặt lịch | 24 |
| Lịch hẹn lịch sử đã hủy và hoàn tiền mô phỏng | 6 |
| Lịch hẹn hôm nay đã thanh toán, chờ tiếp đón | 8 |
| Tổng hóa đơn thêm, gồm khám/điều trị/chờ tiếp đón/hoàn tiền | 194 |

Các lượt khám có bác sĩ và dịch vụ đúng chuyên khoa, cấu hình dịch vụ đúng chi nhánh, giá và giảm trừ BHYT lưu trên hóa đơn. Có 186 dòng lịch trực lịch sử bổ sung cho các ngày khám/điều trị cũ; lịch trực hoạt động 11/11–10/12 vẫn được giữ nguyên. Những dòng lịch sử không chiếm chỗ lịch khám hiện hành. Tám lịch hẹn hôm nay có hold đã xác nhận và inventory tương ứng, nên có thể check-in bằng API và giao diện bình thường.

Hồ sơ mới có dấu `[DEMO bổ sung]`; hóa đơn và lịch sử sử dụng nguồn `demo_enriched`. Các lịch hẹn hôm nay sử dụng nguồn `live` để tiếp tục luồng nghiệp vụ; giữ dấu nhận diện trong UUID ổn định, request key `demo-enrich-v1:...` và manifest của bộ nạp. Dữ liệu xét nghiệm và diễn biến khám là mô phỏng để trình diễn phần mềm.

## Xem báo cáo

Đăng nhập **admin / 123456**, vào **Báo cáo Thống kê**, chọn tháng 08, 09, 10 hoặc 11/2026. Mỗi tháng đều có doanh thu ở cả hai chi nhánh và đủ 33 bác sĩ.

| Tháng | Số khoản ghi nhận doanh thu | Doanh thu mô phỏng |
|---|---:|---:|
| 08/2026 | 33 | 8.080.000 đ |
| 09/2026 | 33 | 7.785.000 đ |
| 10/2026 | 33 | 7.605.000 đ |
| 11/2026 | 90 | 35.356.000 đ |

Tháng 11 có 33 nhóm dịch vụ ghi nhận doanh thu. Tổng báo cáo tháng khớp tổng phân nhóm theo chi nhánh, bác sĩ và dịch vụ. Các con số trên là tại thời điểm nạp và kiểm tra; thao tác thanh toán/hoàn tiền khi demo có thể làm thay đổi số liệu.

## Danh sách chờ tiếp đón ngày 12/11/2026

| Tài khoản lễ tân | Chi nhánh | Bác sĩ | Bệnh nhân chờ |
|---|---|---|---|
| LEGACY_LT001 | CN01 — Medicare - Cơ sở Thanh Xuân | LEGACY_BS006 — Đỗ Thị Mai, Răng - Hàm - Mặt | Vũ Thị Mai, Phạm Huyền |
| LEGACY_LT001 | CN01 — Medicare - Cơ sở Thanh Xuân | LEGACY_BS013 — Trịnh Quốc Bảo, Tim mạch | Ngô Thị Tâm, Phạm Đông Hải |
| LEGACY_LT002 | CN02 — Medicare - Cơ sở Cầu Giấy | LEGACY_BS002 — Trần Thị Bình, Nội khoa | Hoàng Thu Trang, Bùi Minh Tuấn |
| LEGACY_LT002 | CN02 — Medicare - Cơ sở Cầu Giấy | LEGACY_BS003 — Lê Hoàng Nam, Tai - Mũi - Họng | Lê Gia Bảo, Trần Văn Hùng |

Mật khẩu các lễ tân/bác sĩ trên: **123456**. Cả tám lịch thuộc ca 1. Đăng nhập lễ tân, vào **Chờ tiếp đón**, mỗi chi nhánh có 4 bệnh nhân. Sau khi nhấn **Check-in Tiếp Đón**, bệnh nhân chuyển sang hàng đợi của đúng bác sĩ; để thử tiếp, đăng nhập tài khoản bác sĩ tương ứng ở bảng trên.

Đây là các hồ sơ bệnh nhân có sẵn, bao gồm tài khoản đăng nhập đang khóa. Trạng thái khóa đăng nhập không bị thay đổi khi sinh dữ liệu; lễ tân vẫn tiếp đón theo hồ sơ. Để trình diễn giao diện bệnh nhân, dùng An/Bình bên dưới.

Danh sách tiếp đón lọc theo ngày hiện tại, vì vậy dữ liệu này xuất hiện trong ngày **12/11/2026**. Khi đổi ngày demo cần tạo lịch hẹn mới cho ngày đó; các lượt đã check-in cũng không còn nằm trong danh sách chờ tiếp đón.

## Xem hồ sơ bệnh nhân

Mật khẩu **123456**. Vào **Lịch trình Điều trị & Sổ khám bệnh**:

- **990000000001 — An:** 9 lượt khám hoàn thành, gồm 8 lượt mới thêm; 2 liệu trình, 4 kết quả xét nghiệm.
- **990000000002 — Bình:** 7 lượt khám hoàn thành mới thêm; 1 liệu trình, 3 kết quả xét nghiệm.

Chọn một lượt khám tháng 11 trong dòng thời gian để xem triệu chứng, chẩn đoán và các mục xét nghiệm/điều trị nếu có chỉ định. Những buổi chưa đặt lịch có thể đặt tiếp theo lịch trực và cấu hình dịch vụ hiện có.

## Sao lưu và chạy lại

- Sao lưu trước khi nạp: `../backups/clinic-before-demo-enrichment-20261112/seven-databases.sql.gz`.
- Bộ nạp và dữ liệu đầu vào được lưu riêng trên máy tại `data/demo/enrichment-20261112/` và được bỏ qua bởi Git, tránh đưa hồ sơ vào repository.
- Chạy lại đúng manifest `plan.json` bằng `python3 data/demo/enrichment-20261112/apply.py --apply` từ thư mục gốc dự án không thêm trùng và không tăng inventory. Không sinh lại manifest từ snapshot sau khi đã nạp.
- Bộ nạp dùng tiến trình riêng của từng service để ghi đúng database do service đó sở hữu. Không thêm truy cập chéo database vào mã ứng dụng và không dùng `Backend/` cũ.

Đã kiểm tra ràng buộc MySQL bằng giao dịch rollback trước khi nạp, đối chiếu toàn bộ bản ghi sau khi nạp, kiểm tra chạy lại không thêm bản ghi, kiểm tra API báo cáo/hồ sơ/tiếp đón và kiểm tra giao diện Chrome. Danh sách chờ chưa bị check-in trong quá trình xác minh.
