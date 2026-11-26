# Kết quả cơ cấu dữ liệu Medicare — 12/11/2026

Đã áp dụng trên ứng dụng local trong BTL2. **Giữ nguyên 7 service, 7 database và tài khoản MySQL riêng theo service**: Identity, Registry, Scheduling, Appointment, Billing, Clinical, Laboratory. Database monolith `clinic` ở cổng 3306 không được sửa.

## Dữ liệu vận hành

| Hạng mục | Trước | Sau |
| --- | ---: | ---: |
| Bác sĩ | 58 | 33, LEGACY_BS001–LEGACY_BS033, đã mở |
| Chi nhánh | 5 | 2, CN01 và CN02, đã mở |
| Lễ tân | 5 | 2, LEGACY_LT001 và LEGACY_LT002 |
| Xét nghiệm viên | 7 | 2, LEGACY_XNV001 và LEGACY_XNV003 |
| Dịch vụ | 98 | 65, DV001–DV065, đã mở |
| Cấu hình chi nhánh–dịch vụ | 193 | 130, đã mở |
| Tài khoản ứng dụng | 89 | 56 |
| Lịch trực mới | 0 | 1.920, từ 11/11 đến hết 10/12/2026 |

65 dịch vụ gồm 15 khám, 32 điều trị thuộc 8 chuyên khoa bác sĩ và 18 Cận lâm sàng dùng chung. Mỗi chi nhánh có đủ 65 cấu hình; giới hạn giữ 15 chỗ/ca/cấu hình.

Mỗi ca, mỗi chi nhánh đủ 8 nhóm chuyên khoa. Mỗi chi nhánh 960 phân công mới; không trùng bác sĩ cùng ngày/ca giữa hai chi nhánh. Giữ 1.728 lịch trực lịch sử; tổng bảng Scheduling có 3.648 dòng sau sinh.

**Mật khẩu chung của TẤT CẢ 56 tài khoản còn lại: `123456`**, gồm 2 Admin, 17 bệnh nhân và 37 nhân viên. Đã kiểm tra hash của cả 56 tài khoản. Các phiên trước cơ cấu bị thu hồi. 13 bệnh nhân cũ vẫn giữ trạng thái khóa; cả 37 nhân viên được giữ đã mở. Có 43 tài khoản đang hoạt động và đã thử đăng nhập qua API.

## Lịch sử được giữ và dữ liệu đã dọn

Giữ 49 lịch hẹn, 40 check-in lịch sử, 49 hóa đơn, 13 khoản thu xét nghiệm cũ, 20 lượt khám, 8 phác đồ, 16 buổi điều trị và 13 chỉ định xét nghiệm của tập Medicare gốc. Giữ bệnh nhân, hồ sơ/BHYT, danh mục bệnh và thuốc. Khi xác minh đăng nhập, cơ chế Identity–Registry đã tự đồng bộ một hồ sơ còn thiếu cho tài khoản bệnh nhân có sẵn: số hồ sơ bệnh nhân từ 16 lên 17, số tài khoản vẫn 56. Không tạo thêm tài khoản hoặc lượt khám kiểm thử trên stack chính.

Đã dọn 9 lịch hẹn, 4 check-in, 4 thông báo, 4 hóa đơn, 3 lượt khám, 2 phác đồ, 1 buổi điều trị, 3 chỉ định xét nghiệm, 4 hold, 3 dòng tồn chỗ, 2 bộ đếm hàng chờ và 290 lịch trực thuộc các thực thể bị loại. Xóa 33 tài khoản nhân viên/hồ sơ ngoài tập giữ, 3 chi nhánh, 33 dịch vụ và 63 cấu hình theo manifest.

Các bản sao fixture frontend cũ trong `historical_records` được dọn sau khi đã lưu vào backup, tránh lẫn với bộ Medicare. Lịch sử `legacy_mysql` phù hợp vẫn được giữ. Tám check-in có lễ tân `LEGACY_UNASSIGNED` từ dump được giữ nguyên, không giả định người thực hiện.

Ba kết quả cũ do LEGACY_XNV002/LEGACY_XNV004 thực hiện vẫn giữ mã tác giả, đồng thời lưu tên vào `laboratory_db.lab_orders.technician_name_snapshot`. Laboratory công bố trường tùy chọn này trong OpenAPI; giao diện bệnh nhân đọc tên snapshot. Không chuyển kết quả sang tên xét nghiệm viên khác. Có migration chạy lại được và schema cho cài mới.

## Backup và file gửi nhóm

Bản sao trước cơ cấu (ngoài Git):

```text
/home/va/Documents/PTTKHT/BTL_2mon/BTL2/backups/clinic-before-restructure-20261112-0003/clinic-seven-databases.sql.gz
```

SHA-256: `f0cf9a4a27a4edabc9594cf767a7a6d419ad3353cf77d29335cf67df29d9f43b`. Đã kiểm tra gzip và phục hồi thành công vào MySQL riêng `clinic-restructure-check` trước khi thử dọn. Thư mục backup có manifest và cấu hình Compose; file SQL quyền 600, thư mục quyền 700.

File dữ liệu mới để gửi nhóm (được gitignore):

```text
data/mysql/clinic-medicare-7db-2026-11-12.sql.gz
```

SHA-256: `e6f930e9cc0cbe6a4f71c203c28c1d54425347c93254d7aed6d6b3ce27ed3ddf`. Đã kiểm tra gzip, import lại trên MySQL riêng và audit đạt cả số dòng lẫn 56 mật khẩu; file chứa đúng 7 database sau cơ cấu và lịch mới. Bằng chứng: [audit file đã phục hồi](database-restructure-export-restore-2026-11-12.json). Khi chuyển máy, dùng repo hiện tại và file này. Import chỉ trên môi trường đích đã sao lưu và chấp nhận thay thế; không trộn lại dump tháng 10 vào bộ hiện tại.

## Xác minh

- Kiểm thử Python: **94 passed, 5 skipped** trong image kiểm thử local có source chỉ đọc. Ba kiểm thử mới kiểm tra vòng xoay lịch, ví dụ ngày đầu theo script gốc và chặn tạo lại catalogue demo trên stack chính.
- Frontend production build và ESLint các file thay đổi: đạt.
- Trên bản sao đã phục hồi và cơ cấu: **12 nhóm kiểm tra API đạt**, bao gồm đăng nhập, danh mục, lịch đúng vòng xoay, quyền theo chi nhánh, hủy lịch chưa thanh toán, BHYT/thanh toán, check-in, tạm hoãn xét nghiệm, trả kết quả, kết luận, bệnh sử, buổi điều trị và báo cáo theo ba chiều. Chạy lại setup tạo thêm **0** lịch.
- Trên ứng dụng chính: **6 nhóm kiểm tra API chỉ đọc đạt**; 43 tài khoản đang mở đăng nhập được với 123456; đủ 7 readiness/OpenAPI; tài khoản bị xóa bị từ chối; đúng danh mục và 1.920 lịch; tên tác giả xét nghiệm cũ còn đúng.
- Chrome: **8 tình huống đọc giao diện đạt**, đủ 5 vai trò và nhân viên hai chi nhánh; bệnh nhân chọn được đúng DV001/bác sĩ ở cả CN01 và CN02; bác sĩ thấy lịch cả hai cơ sở; Admin chỉ thấy hai chi nhánh. Không có lỗi JavaScript hoặc HTTP 5xx, không tạo thêm lượt trên database chính.
- Kiểm tra database xác nhận tất cả mật khẩu và số dòng tập giữ. Không chạy kiểm thử tải mới trong đợt cơ cấu này.

Bằng chứng: [chạy thử dọn](database-restructure-rehearsal-2026-11-12.json), [API trên bản sao](database-restructure-api-rehearsal-2026-11-12.json), [áp dụng chính](database-restructure-applied-2026-11-12.json), [audit chính](database-restructure-audit-2026-11-12.json), [API chính](database-restructure-api-main-2026-11-12.json), [giao diện](database-restructure-browser-2026-11-12.json).

## Công cụ và cách chạy lại

- `services/maintenance/restructure_medicare.py`: công cụ bảo trì offline; mặc định chỉ preview, apply cần xác nhận biến môi trường và checksum backup. Không chạy lại apply khi chỉ cần xem trạng thái, vì nó reset mật khẩu/thu hồi phiên theo yêu cầu cơ cấu.
- `services/maintenance/verify_medicare.py`: kiểm tra đọc API của bộ dữ liệu hiện tại. `--exercise` chỉ được phép trên cấu hình test tách biệt.
- `services/demo_setup.py`: sinh lịch qua Scheduling, giữ nguyên vòng xoay của file cũ, chạy lại không nhân đôi. Không tạo thêm nhân viên, chi nhánh hay dịch vụ trên stack chính.
- `services/demo_verify.py`: kiểm thử fixture tổng quát tách biệt, không dùng để chuẩn bị dữ liệu chính.

Xem [tài khoản và kịch bản demo mới](demo-guide.md). Các báo cáo ngày 09/11 và các bản sửa ngày 11/11 giữ lại để tham khảo lịch sử; tài khoản và chi nhánh trong đó có thể đã được loại bỏ.
