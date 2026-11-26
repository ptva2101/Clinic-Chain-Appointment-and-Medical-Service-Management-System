# Kế hoạch cơ cấu dữ liệu demo về bộ Medicare gốc

Ngày kiểm kê: 11/11/2026, giờ Việt Nam. **Đã thực hiện ngày 12/11/2026** theo phê duyệt của người dùng; xem [kết quả và backup](database-restructure-result.md). Danh sách dưới đây là kế hoạch đã dùng để thực hiện.

## 1. Phạm vi và quyết định đã có

- Giữ đúng 33 tài khoản bác sĩ cũ `LEGACY_BS001–LEGACY_BS033`, kích hoạt và giữ nguyên liên kết Identity–Registry.
- Giữ đúng hai chi nhánh `CN01` (Medicare - Cơ sở Thanh Xuân), `CN02` (Medicare - Cơ sở Cầu Giấy), mở hoạt động trở lại.
- Giữ đúng hai lễ tân và hai xét nghiệm viên, mỗi chi nhánh một người.
- Lịch mới bắt đầu **11/11/2026**, đủ **30 ngày, đến hết 10/12/2026**, cả cuối tuần theo thuật toán cũ.
- Người dùng chọn **sao lưu rồi dọn các lượt liên quan đến bác sĩ/chi nhánh bị xóa khỏi database chạy demo**.
- Giữ các tài khoản Admin, bệnh nhân, hồ sơ bệnh nhân, BHYT, bệnh và thuốc ngoài phạm vi dọn các lượt liên quan. Theo chỉ đạo bổ sung khi phê duyệt, đặt mật khẩu **123456 cho tất cả tài khoản còn lại, gồm Admin**.
- Đề xuất giữ **65 dịch vụ gốc**, gồm 47 dịch vụ thuộc tám chuyên khoa bác sĩ và 18 dịch vụ Cận lâm sàng hỗ trợ xét nghiệm/chẩn đoán hình ảnh. Đây là điểm bổ sung cần được xem cùng kế hoạch: xóa nhóm Cận lâm sàng sẽ mất toàn bộ lựa chọn xét nghiệm gốc.

## 2. Cấu hình đích

| Thành phần | Hiện tại | Sau cơ cấu theo đề xuất |
| --- | ---: | ---: |
| Tài khoản/hồ sơ bác sĩ | 58 | 33 |
| Chi nhánh | 5 | 2 |
| Tài khoản/hồ sơ lễ tân | 5 | 2 |
| Tài khoản/hồ sơ xét nghiệm viên | 7 | 2 |
| Dịch vụ | 98 | 65 |
| Cấu hình chi nhánh–dịch vụ | 193 | 130 |
| Nhóm chuyên khoa bác sĩ được giữ | — | 8 |
| Nhóm trong danh mục dịch vụ được giữ | — | 9, gồm Cận lâm sàng |
| Lịch phân công mới | 0 | 1.920 |

65 dịch vụ và 130 cấu hình gốc hiện đều ngừng hoạt động. Mỗi chi nhánh đã có đủ 65 cấu hình, giới hạn hiện tại 15 chỗ/ca/cấu hình; tái sử dụng mã và giới hạn này.

## 3. Tám chuyên khoa và 33 bác sĩ

| Chuyên khoa | Số bác sĩ | Khám lâm sàng | Điều trị | Tổng dịch vụ |
| --- | ---: | ---: | ---: | ---: |
| Cơ xương khớp | 4 | 3 | 5 | 8 |
| Da liễu | 4 | 1 | 6 | 7 |
| Mắt | 5 | 1 | 0 | 1 |
| Nội khoa | 4 | 4 | 4 | 8 |
| Răng - Hàm - Mặt | 4 | 1 | 6 | 7 |
| Sản - Phụ khoa | 4 | 3 | 4 | 7 |
| Tai - Mũi - Họng | 4 | 1 | 7 | 8 |
| Tim mạch | 4 | 1 | 0 | 1 |
| **Tổng** | **33** | **15** | **32** | **47** |

Trong database microservice, mã và tên đăng nhập của bác sĩ đã được thêm tiền tố `LEGACY_`. Script cũ dùng `BS001`; khi sinh lịch mới phải ánh xạ sang `LEGACY_BS001`. Không đổi UUID hay bỏ tiền tố trên tài khoản đang có.

### Cơ xương khớp

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS015 | Võ Văn Khải |
| LEGACY_BS016 | Lưu Thị Phương |
| LEGACY_BS024 | Tạ Thị Bích |
| LEGACY_BS032 | Phùng Thị Lan |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV013 | Khám cơ xương khớp | Khám lâm sàng | 300.000 |
| DV014 | Khám đau cột sống | Khám lâm sàng | 350.000 |
| DV015 | Khám thoái hóa khớp | Khám lâm sàng | 350.000 |
| DV061 | Tiêm nội khớp | Điều trị | 800.000 |
| DV062 | Chọc hút dịch khớp | Điều trị | 1.200.000 |
| DV063 | Bó bột | Điều trị | 500.000 |
| DV064 | Nẹp cố định | Điều trị | 600.000 |
| DV065 | Điều trị đau cột sống | Điều trị | 800.000 |

### Da liễu

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS009 | Bùi Văn Đức |
| LEGACY_BS010 | Đinh Thị Ngọc |
| LEGACY_BS021 | Phan Thị Yến |
| LEGACY_BS029 | Vũ Đình Sơn |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV008 | Khám da liễu | Khám lâm sàng | 250.000 |
| DV051 | Điều trị mụn | Điều trị | 500.000 |
| DV052 | Tiêm sẹo lồi | Điều trị | 800.000 |
| DV053 | Đốt mụn cóc | Điều trị | 500.000 |
| DV054 | Đốt nốt ruồi | Điều trị | 400.000 |
| DV055 | Áp lạnh tổn thương da | Điều trị | 700.000 |
| DV056 | Laser điều trị da | Điều trị | 1.500.000 |

### Mắt

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS007 | Hoàng Minh Tú |
| LEGACY_BS008 | Ngô Thị Hương |
| LEGACY_BS020 | Lâm Quốc Tuấn |
| LEGACY_BS028 | Lê Thị Thanh |
| LEGACY_BS033 | Ngô Thị Tâm |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV007 | Khám mắt tổng quát | Khám lâm sàng | 200.000 |

### Nội khoa

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS001 | Nguyễn Văn An |
| LEGACY_BS002 | Trần Thị Bình |
| LEGACY_BS017 | Nguyễn Thị Cẩm |
| LEGACY_BS025 | Mai Văn Long |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV001 | Khám nội tổng quát | Khám lâm sàng | 200.000 |
| DV002 | Khám bệnh tiêu hóa | Khám lâm sàng | 250.000 |
| DV003 | Khám bệnh nội tiết | Khám lâm sàng | 250.000 |
| DV004 | Khám bệnh truyền nhiễm | Khám lâm sàng | 250.000 |
| DV034 | Truyền dịch | Điều trị | 250.000 |
| DV035 | Tiêm thuốc | Điều trị | 80.000 |
| DV036 | Tiêm tĩnh mạch | Điều trị | 120.000 |
| DV037 | Tiêm bắp | Điều trị | 80.000 |

### Răng - Hàm - Mặt

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS005 | Vũ Quang Huy |
| LEGACY_BS006 | Đỗ Thị Mai |
| LEGACY_BS019 | Trương Thị Diễm |
| LEGACY_BS027 | Bùi Quang Minh |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV006 | Khám nha khoa tổng quát | Khám lâm sàng | 150.000 |
| DV045 | Cạo vôi răng | Điều trị | 300.000 |
| DV046 | Trám răng | Điều trị | 400.000 |
| DV047 | Điều trị tủy | Điều trị | 1.500.000 |
| DV048 | Nhổ răng khôn | Điều trị | 2.000.000 |
| DV049 | Điều trị nha chu | Điều trị | 1.000.000 |
| DV050 | Tẩy trắng răng | Điều trị | 2.500.000 |

### Sản - Phụ khoa

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS011 | Cao Thị Thu |
| LEGACY_BS012 | Lý Thị Hoa |
| LEGACY_BS022 | Dương Minh Châu |
| LEGACY_BS030 | Ngô Thị Xuân |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV009 | Khám phụ khoa | Khám lâm sàng | 300.000 |
| DV010 | Khám thai | Khám lâm sàng | 350.000 |
| DV011 | Khám hiếm muộn | Khám lâm sàng | 500.000 |
| DV057 | Đặt vòng tránh thai | Điều trị | 700.000 |
| DV058 | Tháo vòng tránh thai | Điều trị | 500.000 |
| DV059 | Cấy que tránh thai | Điều trị | 2.500.000 |
| DV060 | Tháo que tránh thai | Điều trị | 1.000.000 |

### Tai - Mũi - Họng

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS003 | Lê Hoàng Nam |
| LEGACY_BS004 | Phạm Thị Lan |
| LEGACY_BS018 | Đặng Văn Hải |
| LEGACY_BS026 | Kiều Thị Nhung |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV005 | Khám Tai - Mũi - Họng | Khám lâm sàng | 250.000 |
| DV038 | Khí dung | Điều trị | 150.000 |
| DV039 | Hút mũi | Điều trị | 120.000 |
| DV040 | Rửa tai | Điều trị | 150.000 |
| DV041 | Lấy dị vật tai | Điều trị | 300.000 |
| DV042 | Lấy dị vật mũi | Điều trị | 300.000 |
| DV043 | Lấy dị vật họng | Điều trị | 400.000 |
| DV044 | Đốt họng hạt | Điều trị | 800.000 |

### Tim mạch

| Mã bác sĩ / tên đăng nhập | Họ tên |
| --- | --- |
| LEGACY_BS013 | Trịnh Quốc Bảo |
| LEGACY_BS014 | Phan Thị Dung |
| LEGACY_BS023 | Hồ Văn Phúc |
| LEGACY_BS031 | Đinh Công Thắng |

| Mã dịch vụ | Tên dịch vụ | Loại | Giá gốc (đ) |
| --- | --- | --- | ---: |
| DV012 | Khám tim mạch | Khám lâm sàng | 350.000 |

## 4. Các dịch vụ xét nghiệm cần giữ để chạy đủ luồng

Đây là nhóm hỗ trợ **Cận lâm sàng**, không phải nhóm có thêm bác sĩ. Hệ thống phân loại toàn bộ 18 dịch vụ sau là `Xét nghiệm`, bao gồm cả siêu âm, X-quang, CT và MRI; tiếp tục dùng mô hình mô phỏng hiện tại, không diễn giải đây là phân công chuyên môn ngoài thực tế.

| Mã | Dịch vụ | Giá gốc (đ) |
| --- | --- | ---: |
| DV016 | Xét nghiệm sinh hóa | 250.000 |
| DV017 | Xét nghiệm miễn dịch | 450.000 |
| DV018 | Xét nghiệm nước tiểu | 100.000 |
| DV019 | Siêu âm ổ bụng | 250.000 |
| DV020 | Siêu âm tuyến giáp | 250.000 |
| DV021 | Siêu âm vú | 350.000 |
| DV022 | Siêu âm tim | 700.000 |
| DV023 | Siêu âm thai | 350.000 |
| DV024 | X-quang ngực | 180.000 |
| DV025 | X-quang cột sống | 250.000 |
| DV026 | X-quang khớp | 220.000 |
| DV027 | X-quang xoang | 220.000 |
| DV028 | CT sọ não | 1.500.000 |
| DV029 | CT ngực | 1.800.000 |
| DV030 | CT bụng | 2.000.000 |
| DV031 | MRI não | 2.500.000 |
| DV032 | MRI cột sống | 2.800.000 |
| DV033 | MRI khớp | 2.500.000 |

## 5. Nhân viên hỗ trợ đề xuất giữ

| Vai trò | Chi nhánh | Tên đăng nhập | Họ tên |
| --- | --- | --- | --- |
| Lễ tân | CN01 | LEGACY_LT001 | Nguyễn Thị Hồng (CN Thanh Xuân) |
| Lễ tân | CN02 | LEGACY_LT002 | Trần Minh Quân (CN Cầu Giấy) |
| Xét nghiệm viên | CN01 | LEGACY_XNV001 | Phạm Đình Toàn |
| Xét nghiệm viên | CN02 | LEGACY_XNV003 | Âu Thị Mai |

Hai xét nghiệm viên trên được đề xuất vì đang gắn với nhiều kết quả cũ hơn trong từng chi nhánh: XNV001 có 7 kết quả, XNV003 có 2. Không chuyển danh tính người trả kết quả khi dọn nhân viên.

**Điểm cần xử lý riêng:** `LEGACY_XNV002` và `LEGACY_XNV004` có lần lượt 2 và 1 kết quả đã trả tại hai chi nhánh giữ lại. Phương án giữ lịch sử hợp lệ của hai chi nhánh cần giữ tên/mã người thực hiện dưới dạng snapshot lịch sử (không giữ thêm tài khoản/hồ sơ nhân viên hoạt động). Nếu phải thêm trường snapshot vào Laboratory thì có migration và kiểm thử tương ứng. Không gán các kết quả này sang XNV001/XNV003.

## 6. Danh sách loại bỏ

Chi nhánh: `CN_CG`, `CN_HBT`, `CN_DEMO`.

Tài khoản/hồ sơ nhân viên loại bỏ: **33**, gồm 25 bác sĩ, 3 lễ tân, 5 xét nghiệm viên. Đây là xóa khỏi tập tài khoản/hồ sơ vận hành sau khi đã xử lý liên kết; chỉ khóa hoặc ẩn chưa đáp ứng số lượng đích.

| Mã hồ sơ | Vai trò | Họ tên | Chi nhánh hồ sơ |
| --- | --- | --- | --- |
| BS001 | doctor | Nguyễn Văn An | — |
| BS002 | doctor | Lê Thị Bình | — |
| BS003 | doctor | Phạm Hoàng Long | — |
| BS004 | doctor | Trần Trần Đức | — |
| BS005 | doctor | Nguyễn Thị Minh | — |
| BS006 | doctor | Phan Văn Khải | — |
| BS007 | doctor | Hoàng Lê Giang | — |
| BS008 | doctor | Vũ Ngô Hùng | — |
| BS009 | doctor | Đỗ Thúy Hạnh | — |
| BS010 | doctor | Bùi Chí Kiên | — |
| BS011 | doctor | Lý Thu Thảo | — |
| BS012 | doctor | Đặng Quốc Bảo | — |
| BS013 | doctor | Ngô Bảo Ngọc | — |
| BS014 | doctor | Dương Văn Lâm | — |
| BS015 | doctor | Võ Thị Sáu | — |
| BS016 | doctor | Tống Phước Hải | — |
| BS017 | doctor | Đinh Công Mạnh | — |
| BS018 | doctor | Mai Phương Thảo | — |
| BS019 | doctor | Hồ Tiến Dũng | — |
| BS020 | doctor | Trịnh Đình Quang | — |
| BS021 | doctor | Vương Kim Chi | — |
| BS022 | doctor | Đoàn Nguyên Đức | — |
| BS023 | doctor | Lưu Hồng Quang | — |
| DEMO_BS_NOI | doctor | [DEMO] Bác sĩ Minh - Nội tổng quát | CN_DEMO |
| DEMO_BS_PHU | doctor | [DEMO] Bác sĩ Lan - dự phòng | CN_DEMO |
| DEMO_LT | letan | [DEMO] Lễ tân Hà | CN_DEMO |
| LT001 | letan | Phạm Minh Thư | CN_CG |
| LT002 | letan | Nguyễn Hoàng Yến | CN_HBT |
| DEMO_XNV | xnv | [DEMO] Xét nghiệm viên Nam | CN_DEMO |
| LEGACY_XNV002 | xnv | Phạm Đình Sắc | CN01 |
| LEGACY_XNV004 | xnv | Phạm Ngọc Huyền | CN02 |
| XNV001 | xnv | Trần Văn Cường | CN_CG |
| XNV002 | xnv | Vũ Hồng Ngọc | CN_HBT |

33 dịch vụ loại bỏ:

| Mã | Tên dịch vụ | Chuyên khoa |
| --- | --- | --- |
| DEMO_DT | [DEMO] Buổi điều trị minh họa | Nội tổng quát |
| DT_TIEM_KHANG_SINH | Dịch vụ tiêm thuốc/kháng sinh theo chỉ định | Nội tổng quát |
| DT_TRUYEN_DICH | Liệu trình truyền dịch giải độc, bù nước | Nội tổng quát |
| DEMO_KHAM | [DEMO] Khám Nội tổng quát | Nội tổng quát |
| DV_KHAM_DINH_DUONG | Khám Tư Vấn Dinh Dưỡng Chuyên Sâu | Nội tổng quát |
| DV_KHAM_GIA_DINH | Khám Sức Khỏe Gia Đình | Nội tổng quát |
| DV_KHAM_HO_HAP | Khám Bệnh Lý Đường Hô Hấp | Nội tổng quát |
| DV_KHAM_LAO_KHOA | Khám Tư Vấn Sức Khỏe Lão Khoa | Nội tổng quát |
| DV_KHAM_NOI | Khám Nội Tổng Quát | Nội tổng quát |
| DV_KHAM_NOI_TIET | Khám Sàng Lọc Tiểu Đường & Nội Tiết | Nội tổng quát |
| DV_KHAM_TIEU_HOA | Khám Tiêu Hóa - Gan Mật | Nội tổng quát |
| DV_KHAM_TIM_MACH | Khám Sàng Lọc Tim Mạch - Huyết Áp | Nội tổng quát |
| DEMO_XN | [DEMO] Xét nghiệm minh họa | Nội tổng quát |
| DT_HAN_RANG | Hàn Răng Composite Thẩm Mỹ (1 Răng) | Răng hàm mặt |
| DT_NHO_RANG_KHON | Phẫu Thuật Nhổ Răng Khôn Mọc Lệch | Răng hàm mặt |
| DT_RANG_TUY | Liệu Trình Điều Trị Tủy Răng Toàn Diện | Răng hàm mặt |
| DT_TAY_TRANG | Tẩy Trắng Răng Công Nghệ Laser | Răng hàm mặt |
| DV_KHAM_IMPLANT | Khám Tư Vấn Trồng Răng Implant | Răng hàm mặt |
| DV_KHAM_NIENG_RANG | Khám Tư Vấn Chỉnh Nha/Niềng Răng | Răng hàm mặt |
| DV_KHAM_RANG | Khám Răng Hàm Mặt Định Kỳ | Răng hàm mặt |
| DV_LAY_CAO | Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ | Răng hàm mặt |
| DT_KHIDUNG | Liệu Trình Khí Dung Mũi Họng | Tai mũi họng |
| DT_LAY_DI_VAT | Thủ Thuật Lấy Dị Vật Vùng Tai/Mũi/Họng | Tai mũi họng |
| DT_RUA_XOANG | Hút Mủ Và Chọc Rửa Xoang Điều Trị | Tai mũi họng |
| DT_VIEM_AMIDAN | Liệu Trình Điều Trị Viêm Amidan Hạt | Tai mũi họng |
| DV_KHAM_THINH_LUC | Khám Đo Thính Lực Đơn Âm | Tai mũi họng |
| DV_KHAM_TMH | Khám Tai Mũi Họng Thông Thường | Tai mũi họng |
| DV_NOI_SOI_TMH | Nội Soi Tai Mũi Họng Ống Mềm | Tai mũi họng |
| SA_O_BUNG | Siêu Âm Ổ Bụng Tổng Quát | Xét nghiệm |
| XN_DUONG_HUYET | Xét Nghiệm Đường Huyết Nhanh | Xét nghiệm |
| XN_MAU | Xét Nghiệm Công Thức Máu 24 Chỉ Số | Xét nghiệm |
| XN_NUOC_TIEU | Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số) | Xét nghiệm |
| XN_SINH_HOA | Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu) | Xét nghiệm |

Chuyên khoa hiện được lưu bằng chuỗi trong hồ sơ nhân viên và dịch vụ, chưa có bảng danh mục chuyên khoa độc lập. Khi bỏ các hồ sơ/dịch vụ mới tương ứng thì các tên Nội tổng quát, Răng hàm mặt, Tai mũi họng, Xét nghiệm không còn trong danh mục vận hành; các tên chuyên khoa gốc có dấu gạch được giữ nguyên để đối chiếu khớp.

## 7. Ảnh hưởng lên dữ liệu hiện tại

Snapshot kiểm kê cho ba chi nhánh bị loại:

| Dữ liệu | Số dòng liên quan |
| --- | ---: |
| Lịch hẹn | 9: 4 Cầu Giấy mới, 1 Hai Bà Trưng, 4 DEMO |
| Hóa đơn | 4: 3 paid, 1 refunded, đều tại DEMO |
| Lượt khám Clinical | 3 completed, tại DEMO |
| Chỉ định xét nghiệm | 3 resulted, tại DEMO |
| Phác đồ điều trị | 2, dịch vụ DEMO_DT |
| Buổi điều trị | 1 completed, bác sĩ DEMO_BS_NOI |
| Lịch trực hiện hành của các bác sĩ bị xóa | 290 |
| Cấu hình chi nhánh–dịch vụ | 63 |
| Slot hold | 4 confirmed, tại DEMO |

Phải dọn kèm notification, check-in, bộ đếm hàng chờ, tồn chỗ và phiên đăng nhập liên quan. Tái lập danh sách theo ID ngay trước khi chạy, không dùng số lượng snapshot làm điều kiện xóa.

Dữ liệu lịch sử gốc ở hai chi nhánh được giữ theo mặc định: 49 lịch hẹn, 49 hóa đơn, 20 lượt khám, 13 kết quả xét nghiệm và 1.728 dòng lịch trực lịch sử. Giữ phác đồ/buổi điều trị gốc và các khoản thu xét nghiệm tương ứng. Không xóa toàn bộ bệnh án hoặc reset toàn hệ thống. Bản sao `historical_records` có thể chứa thực thể cũ ngoài danh mục: cần đưa các thực thể loại bỏ sang bản lưu trữ hoặc loại khỏi trình đọc danh mục để restart/import không tái tạo chúng; giữ lịch sử phù hợp và không mở lại chức năng nhập cũ tự động.

## 8. Thuật toán lịch mới

Giữ nguyên thứ tự 8 nhóm của `Backend/gen_lich_truc_0406.py` và thứ tự bác sĩ trong từng nhóm. Đổi sang mã thật trong microservice bằng ánh xạ tiền tố LEGACY_.

- Với chỉ số ngày `d = 0..29` và ca `c = 1..4`, dùng `step = 4*d + c - 4`.
- CN01 chọn `group[(step + idx) % len(group)]`.
- CN02 chọn `group[(step + idx + 1) % len(group)]`.
- Bước tiếp tục tăng xuyên ngày, không khởi động lại vòng xoay vào mỗi sáng.
- Mỗi chi nhánh, mỗi ca có đúng một bác sĩ của mỗi chuyên khoa: 8 bác sĩ.
- Hai chi nhánh có 16 phân công/ca, 64 phân công/ngày, **1.920 dòng cho 30 ngày**, mỗi chi nhánh 960.
- Nhóm 4 người: mỗi người 60 ca/30 ngày. Nhóm Mắt 5 người: mỗi người 48 ca/30 ngày.
- Sinh qua API của Scheduling, chia lô tối đa 200, bỏ qua bản ghi đã khớp và dừng khi có xung đột thực sự. Chạy lại không nhân đôi; không tái sử dụng mã LT_... chung cho 16 dòng như SQL cũ.
- Giữ 1.728 lịch quá khứ trạng thái historical riêng. Nếu giữ đầy đủ thì sau sinh có 3.648 dòng lịch trực, trong đó 1.920 dòng mới hoạt động.

Đã mô phỏng thuần tính toán, không ghi DB: đủ 33 bác sĩ, 1.920 dòng, **0 trường hợp cùng bác sĩ trùng ngày/ca ở hai chi nhánh**.

## 9. Trình tự thực hiện

1. Tạo manifest giữ/xóa theo ID và dry-run liệt kê số dòng từng service. Kiểm tra lại số liệu ngay trước khi áp dụng.
2. Dừng tiếp nhận thao tác ghi và worker; sao lưu đầy đủ cả 7 database và cấu hình chạy, kiểm tra nén/checksum, thử phục hồi vào môi trường MySQL riêng. Giữ backup ngoài Git và chuẩn bị cách phục hồi cả bộ, vì không có một transaction chung cho 7 database.
3. Chuẩn bị và chạy thử công cụ dọn trên bản sao đã phục hồi. Từng bước có checkpoint, kiểm đếm trước/sau và khả năng chạy tiếp. Mỗi công cụ chỉ sửa database do service đó sở hữu; việc tổng hợp ID nằm ở công cụ bảo trì, không thêm truy cập chéo vào runtime service.
4. Dọn các buổi/phác đồ/lab orders/hóa đơn/check-in/notification/hold/inventory và lượt khám/lịch hẹn thuộc tập loại bỏ, theo quan hệ phụ thuộc. Giữ hóa đơn cũ của tập giữ. Dọn refresh token và thu hồi access token của tài khoản sắp xóa; sau đó xóa Identity account, Registry staff profile tương ứng. Không bỏ qua ràng buộc bằng FOREIGN_KEY_CHECKS=0.
5. Dọn 63 cấu hình và 33 dịch vụ ngoài tập giữ; xóa ba chi nhánh ngoài tập giữ. Xử lý snapshot tác giả xét nghiệm cũ và các bản lưu lịch sử liên quan trước khi bỏ hồ sơ XNV002/XNV004. Dọn 290 lịch trực của bác sĩ bị loại.
6. Mở hai chi nhánh, 65 dịch vụ và 130 cấu hình. Kích hoạt đúng 37 tài khoản nhân viên được giữ qua Identity, khớp Registry; đặt mật khẩu demo biết trước bằng API reset nếu cần, giao bảng tài khoản riêng. Mật khẩu từ dump cũ không được giả định đăng nhập được. Không chạy `activate_staff.py` để xử lý nhóm này vì script đó chỉ nhận source legacy_demo và bỏ qua tài khoản đã khóa.
7. Sinh lịch 11/11–10/12/2026 qua Scheduling, kiểm trùng và kiểm đủ từng chuyên khoa/chi nhánh/ca.
8. Cập nhật công cụ demo và tài liệu để không tái tạo CN_DEMO/bác sĩ mới: thay `demo_setup.py`, các tham chiếu cố định trong `demo_verify.py`, tài khoản/kịch bản trong docs. Giữ bản import gốc để tham khảo nhưng không đưa lệnh import cũ vào luồng chạy bộ dữ liệu mới. Tách kiểm tra snapshot import cũ khỏi kiểm tra bộ dữ liệu đã cơ cấu.
9. Chạy kiểm thử hồi quy và kiểm tra giao diện trên bản sao. Khi kết quả và manifest đạt, áp dụng cùng quy trình lên database local; khởi động lại, kiểm tra đếm và giao kịch bản demo mới. Không đụng database monolith clinic ở cổng 3306.

## 10. Tiêu chí nghiệm thu

- Database vận hành và danh sách Admin đều đúng 33 bác sĩ, 2 chi nhánh, 2 lễ tân, 2 xét nghiệm viên; cả 37 tài khoản nhân viên được giữ đăng nhập đúng vai trò.
- Cả hai chi nhánh hoạt động; có 65 dịch vụ gốc, 130 cấu hình; các tên/mã mới bị loại không còn trong danh mục hoạt động.
- Đủ 1.920 phân công mới, 960/chi nhánh; 8 chuyên khoa ở mỗi ca, không trùng bác sĩ cùng ngày/ca, sinh lại không tăng số dòng.
- Bệnh nhân chọn được chi nhánh, dịch vụ khám và đúng bác sĩ; thanh toán/BHYT, check-in tại chi nhánh tương ứng, bác sĩ chỉ thấy hàng chờ của mình.
- Bác sĩ chỉ định xét nghiệm gốc; xét nghiệm viên cùng chi nhánh thấy và trả kết quả; chi nhánh còn lại bị chặn. Bác sĩ đọc kết quả, kết luận; bệnh nhân xem lại lượt khám.
- Chỉ định điều trị đúng chuyên khoa, đặt từng buổi, thanh toán và hoàn tất; thử hủy lịch chưa thanh toán, đổi/hủy ca trống, báo cáo từng chi nhánh/bác sĩ/dịch vụ.
- Lịch sử gốc thuộc tập giữ vẫn đọc được, có tên/mã người trả kết quả đúng; không còn tham chiếu lỗi đến các thực thể vận hành bị xóa. Phiên cũ của tài khoản bị xóa không truy cập được.
- Restart ứng dụng và chạy lại công cụ demo không tái tạo 25 bác sĩ, 3 chi nhánh hoặc 33 dịch vụ đã bỏ.

## 11. Phục hồi nếu có lỗi

Dừng ghi, lưu log/checkpoint lỗi và phục hồi đồng bộ cả 7 database từ cùng bộ backup đã thử phục hồi. Không chỉ phục hồi một database sau khi đã sửa các database còn lại. Chưa xóa backup hay dump gốc sau khi hoàn tất.
