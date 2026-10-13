# Medicare - Hệ Thống Quản Lý Lịch Khám Và Dịch Vụ Chuỗi Phòng Khám Đa Khoa

> Bộ khung 7 microservice và cách chạy bằng Docker Compose: [docs/microservices-base.md](docs/microservices-base.md). Backend và frontend hiện tại vẫn là phiên bản cũ trong giai đoạn chuyển đổi.

Identity service đã có API đăng nhập độc lập: [hướng dẫn và OpenAPI](docs/identity-service.md). Đăng ký bệnh nhân tạo hồ sơ tối thiểu tại Registry và liên kết bằng `subject_id`: [luồng Identity–Registry](docs/registry-service.md).
Tài khoản bệnh nhân mới đăng ký bằng CCCD; mọi vai trò đăng nhập qua Identity tại `http://localhost:5173/`. Bệnh nhân có thể xem/sửa hồ sơ cơ bản tại Registry; admin cấp tài khoản nhân viên kèm hồ sơ Registry ở dashboard. Các API nghiệp vụ cũ chưa kiểm tra token Identity; bệnh nhân mới chưa được nối với màn hình đặt lịch cũ.

**Đại học Công nghệ - Đại học Quốc gia Hà Nội**
## 📌 Giới Thiệu

**Medicare** là dự án Bài tập lớn môn **Phân tích và Thiết kế Hệ thống Thông tin**, được thực hiện bởi **Nhóm 4**.

Hệ thống được xây dựng nhằm hỗ trợ quản lý hoạt động của chuỗi phòng khám đa khoa thông qua nền tảng trực tuyến, giúp bệnh nhân dễ dàng đặt lịch khám, thanh toán viện phí và theo dõi hồ sơ y tế. Đồng thời, hệ thống cung cấp các công cụ hỗ trợ cho bác sĩ, lễ tân, xét nghiệm viên và quản trị viên nhằm tối ưu hóa quy trình khám chữa bệnh và quản lý dữ liệu.

---

## 👥 Thành Viên Nhóm

| Thành viên              | Mã sinh viên |
| ----------------------- | ------------ |
| **Trần Phương Phương**  | 23020562     |
| **Nguyễn Hoàng Hà Anh** | 23020513     |
| **Phạm Ngọc Huyền**     | 23020541     |
| **Phạm Thúc Việt Anh**  | 23020514     |

---

## 🛠️ Công Nghệ Sử Dụng

### Frontend

* ReactJS
* Next.js

### Backend

* Python
* FastAPI

### Cơ sở dữ liệu

* MySQL 

---
## 📌 Tài liệu phân tích: https://drive.google.com/file/d/1pezAa3n-Xtdp2YLo3BO8xvN7V1Cjry6Z/view?usp=sharing

## ✨ Chức Năng Chính

### 👤 Bệnh Nhân

* Đăng ký, đăng nhập và quản lý tài khoản cá nhân.
* Cập nhật thông tin cá nhân và thông tin bảo hiểm y tế.
* Tìm kiếm suất khám theo:

  * Chi nhánh
  * Chuyên khoa
  * Bác sĩ
* Đặt lịch khám trực tuyến.
* Thanh toán viện phí bằng mã QR.
* Tra cứu:

  * Lịch sử khám bệnh
  * Đơn thuốc
  * Kết quả xét nghiệm
  * Chỉ định điều trị
* Nhận thông báo khi:

  * Đổi bác sĩ
  * Hủy lịch khám
  * Hoàn tiền
  * Các sự cố phát sinh liên quan đến lịch hẹn

---

### 👨‍⚕️ Bác Sĩ

* Xem danh sách bệnh nhân đăng ký khám theo ngày.
* Quản lý trạng thái khám bệnh.
* Ghi nhận triệu chứng và kết quả khám.
* Xem kết quả xét nghiệm.
* Chẩn đoán bệnh.
* Kê đơn thuốc.
* Tạo chỉ định điều trị.
* Tra cứu lịch sử bệnh án của bệnh nhân.

---

### 🏥 Lễ Tân

* Tra cứu thông tin bệnh nhân bằng:

  * Mã lịch khám
  * CCCD
  * Số điện thoại
* Thực hiện check-in bệnh nhân.
* Cập nhật trạng thái từ **"Chưa đến"** sang **"Đang chờ"**.
* Hỗ trợ điều phối hàng đợi khám bệnh.

---

### 🔬 Xét Nghiệm Viên

* Tiếp nhận chỉ định xét nghiệm từ bác sĩ.
* Quản lý danh sách yêu cầu xét nghiệm.
* Nhập kết quả xét nghiệm.
* Ghi chú chuyên môn.
* Trả kết quả lên hệ thống để bác sĩ theo dõi.

---

### ⚙️ Quản Trị Viên

#### Quản lý danh mục

* Quản lý chi nhánh phòng khám.
* Quản lý danh mục dịch vụ:

  * Khám bệnh
  * Điều trị
  * Xét nghiệm
* Thiết lập giá dịch vụ.

#### Quản lý nhân sự

* Cấp tài khoản bác sĩ.
* Cấp tài khoản xét nghiệm viên.
* Vô hiệu hóa tài khoản khi cần thiết.

#### Quản lý lịch làm việc

* Thiết lập lịch làm việc hàng tháng cho bác sĩ.
* Tạo và quản lý các suất khám.

#### Báo cáo thống kê

* Thống kê số lượt khám theo chi nhánh.
* Thống kê số lượt khám theo chuyên khoa.
* Theo dõi hiệu suất hoạt động.
* Thống kê dịch vụ được sử dụng nhiều nhất.

---

## 🏗️ Kiến Trúc Hệ Thống

```text
Frontend (ReactJS / Next.js)
            │
            ▼
Backend  (FastAPI + Python)
            │
            ▼
      MySQL
```

---

## 🚀 Hướng Dẫn Cài Đặt

### Yêu cầu hệ thống

* Python 3.8 trở lên
* Node.js 16 trở lên
* MySQL

---

## Cài Đặt Backend

```bash
# Di chuyển tới thư mục Backend
cd Backend

# Khởi động FastAPI
uvicorn main:app --reload
```


## Cài Đặt Frontend

```bash
# Di chuyển tới thư mục Frontend
cd Frontend

# Cài đặt thư viện
npm install

# Chạy ứng dụng
npm run dev
```



## 🎯 Mục Tiêu Dự Án

* Số hóa quy trình đặt lịch khám và quản lý hồ sơ bệnh nhân.
* Tăng hiệu quả vận hành cho chuỗi phòng khám.
* Hỗ trợ luân chuyển dữ liệu giữa các bộ phận một cách nhanh chóng và chính xác.
* Nâng cao trải nghiệm của bệnh nhân thông qua các dịch vụ trực tuyến.

