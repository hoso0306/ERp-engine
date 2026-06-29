# Danh sách Module

> **Tên file:** `03-danh-sach-module.md`

---

# Mục đích

Tài liệu này mô tả các Module chính của hệ thống ERP.

Các Module được nhóm theo nghiệp vụ nhằm giúp người dùng dễ sử dụng và dễ mở rộng trong tương lai.

---

# I. Điều hành

## 1. Dashboard

**Mục đích**

Hiển thị nhanh tình hình hoạt động của doanh nghiệp.

**Chức năng chính**
* Bộ lọc theo ngày
* Doanh thu, tiền mặt về, lợi nhuận
* Đơn hàng
* Công nợ
* Tồn kho
* Hàng hoàn
* Thống kê nhanh tiến độ sản xuất

---

## 2. Báo cáo

**Mục đích**

Tổng hợp số liệu phục vụ quản lý và ra quyết định.

**Chức năng chính**

* Bộ lọc theo ngày
* Báo cáo doanh thu
* Báo cáo tiền mặt về
* Báo cáo lợi nhuận
* Báo cáo đơn hàng
* Báo cáo khách hàng
* Báo cáo kho
* Báo cáo công nợ
* Báo cáo hàng hoàn
* Cơ cấu doanh thu theo sản phẩm
* Báo cáo tốc độ phát triển qua các tháng, năm
* Báo cáo tốc độ phát triển theo nhóm sản phẩm
* Doanh thu theo nhân viên 
* Doanh thu theo khách hàng 



---

# II. Kinh doanh

## 3. Khách hàng

**Mục đích**

Quản lý toàn bộ thông tin khách hàng.

**Chức năng chính**

* Bộ lọc theo ngày
* Danh sách khách hàng
* Thông tin liên hệ
* Tuyến giao hàng
* Nhóm khách hàng 
* Mức độ ưu tiên
* Hạn mức công nợ
* Thời hạn công nợ
* Chiết khấu mặc định
* Lần mua hàng đầu tiên, Lần mua hàng cuối cùng
* Lịch sử mua hàng
* Công nợ
* Ghi chú
* Tạo báo giá

---

## 4. Báo giá

**Mục đích**

Lập và quản lý báo giá.

**Chức năng chính**

* Bộ lọc theo ngày
* Tạo báo giá
* Chỉnh sửa báo giá
* In báo giá
* Gửi khách hàng
* Chuyển thành đơn hàng

---

## 5. Đơn hàng

**Mục đích**

Quản lý toàn bộ đơn hàng từ khi xác nhận đến khi hoàn thành.

**Chức năng chính**

* Bộ lọc theo ngày
* Tạo đơn hàng
* Theo dõi trạng thái
* Ngày tạo đơn
* Ngày hẹn giao
* Thanh toán
* Công nợ
* Bảo hành

---

## 6. Công nợ

**Mục đích**

Theo dõi công nợ khách hàng.

**Chức năng chính**

* Bộ lọc theo ngày
* Tổng dư nợ
* Tổng thu hồi
* Số nợ quá hạn
* Danh sách công nợ
* Thu tiền
* Lịch sử thanh toán 

---

## 7. Hàng hoàn

**Mục đích**

Quản lý các đơn hàng phát sinh hàng hoàn.

**Chức năng chính**

* Bộ lọc theo ngày
* Lý do hoàn
* Trạng thái xử lý
* Giá trị hàng hoàn
* Lịch sử xử lý

---

# III. Vận hành

## 8. Sản phẩm

**Mục đích**

Quản lý danh mục sản phẩm và bảng giá.

**Chức năng chính**

* Bộ lọc theo ngày
* Danh sách sản phẩm
* Loại sản phẩm
* Công thức báo giá
* Cấu hình báo giá
* Thư viện công thức
* Tính toán chi tiết báo giá
* Giá bán
* Trạng thái kinh doanh
* Mẫu mã
* Đơn vị tính

---

## 9. Sản xuất

**Mục đích**

Theo dõi tiến độ sản xuất theo từng đơn hàng.

**Chức năng chính**

* Bộ lọc theo ngày
* Danh sách đơn cần sản xuất
* Cảnh báo đơn cần giao theo ngày
* Trạng thái sản xuất
* Ngày bắt đầu
* Ngày hoàn thành
* Ghi chú sản xuất

---

## 10. Kho

**Mục đích**

Quản lý vật tư và hàng hóa trong kho.

**Chức năng chính**

* Bộ lọc theo ngày
* Nhập kho
* Xuất kho
* Tồn kho
* Kiểm kê
* Nhà cung cấp
* Lịch sử nhập xuất

---

## 11. Cài đặt

**Mục đích**

Quản lý cấu hình hệ thống.

**Chức năng chính**

* Người dùng
* Phân quyền
* Danh mục dùng chung
* Cấu hình hệ thống

---

# Sơ đồ Module

```text
ERP Quản lý Xưởng Rèm Thăng Long

├── Điều hành
│   ├── Dashboard
│   └── Báo cáo
│
├── Kinh doanh
│   ├── Khách hàng
│   ├── Báo giá
│   ├── Đơn hàng
│   ├── Công nợ
│   └── Hàng hoàn
│
└── Vận hành
    ├── Sản phẩm
    ├── Sản xuất
    ├── Kho
    └── Cài đặt
```

---

# Ghi chú

* Đây là danh sách Module của phiên bản ERP đầu tiên.
* Mỗi Module sẽ được triển khai thành nhiều chức năng chi tiết trong giai đoạn phát triển.
* Các Module có thể được mở rộng ở các phiên bản tiếp theo mà không làm thay đổi kiến trúc tổng thể của hệ thống.
