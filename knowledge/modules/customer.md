# Module Khách hàng

> **Tên file:** `knowledge/modules/customer.md`

---

# Mục đích

Quản lý toàn bộ thông tin khách hàng của doanh nghiệp.

Đây là Module nền tảng, được sử dụng bởi:

* Báo giá
* Đơn hàng
* Công nợ
* Báo cáo
* Dashboard

---

# Phạm vi

Module này chỉ chịu trách nhiệm quản lý dữ liệu khách hàng.

Không xử lý:

* Thống kê khách hàng lâu ngày không mua
* Phân tích doanh thu khách hàng
* Khách hàng VIP

Các chức năng trên sẽ thuộc Module Báo cáo.

---

# Quy tắc kiến trúc

* Toàn bộ ID sử dụng `String` + `cuid()`.
* Mã nghiệp vụ (KH000001) sinh từ bảng `running_numbers` bằng transaction + row lock.
* Soft Delete dùng `deletedAt` (nullable DateTime), không dùng `isDeleted`.
* Mọi bảng nghiệp vụ có `createdBy`, `updatedBy` (FK → users, nullable cho đến khi có auth).

---

# Danh mục (Master Data)

## Nhóm khách hàng (`customer_groups`)

* Là dữ liệu danh mục.
* Người dùng có thể tự tạo, sửa, xóa.
* Lưu dưới dạng bảng riêng.

## Tuyến giao hàng (`delivery_routes`)

* Là dữ liệu danh mục.
* Người dùng có thể tự tạo, sửa, xóa.
* Lưu dưới dạng bảng riêng.

## Mức độ ưu tiên (`Priority`)

Giá trị cố định (Enum):

* LOW (Thấp)
* MEDIUM (Trung bình)
* HIGH (Cao)

## Trạng thái khách hàng (`CustomerStatus`)

Giá trị cố định (Enum):

* ACTIVE (Đang hoạt động)
* INACTIVE (Ngừng hoạt động)

Khác với Soft Delete: INACTIVE = vẫn hiển thị nhưng không cho tạo đơn mới. Soft Delete = ẩn khỏi hệ thống.

---

# Sinh mã tự động (`running_numbers`)

Bảng dùng chung cho toàn bộ hệ thống.

| Field | Mô tả |
|---|---|
| type | Loại thực thể: `CUSTOMER`, `ORDER`, `QUOTATION`... |
| prefix | Tiền tố: `KH`, `DH`, `BG`... |
| lastNumber | Số cuối cùng đã sử dụng |
| paddingLength | Số chữ số (mặc định 6) |

Ví dụ: `CUSTOMER` + `KH` + `000001` → `KH000001`

Logic: Transaction → SELECT FOR UPDATE → lastNumber + 1 → format code.

---

# Dữ liệu quản lý

## Thông tin cơ bản

* Mã khách hàng — sinh tự động từ `running_numbers` (KH000001)
* Tên khách hàng
* Số điện thoại
* Email
* Tỉnh/Thành phố
* Quận/Huyện
* Phường/Xã
* Địa chỉ chi tiết
* Ghi chú

## Thông tin kinh doanh

* Nhóm khách hàng (FK → `customer_groups`)
* Tuyến giao hàng (FK → `delivery_routes`)
* Người phụ trách — `saleId` (FK → `users`)
* Mức độ ưu tiên (Enum: LOW / MEDIUM / HIGH, mặc định MEDIUM)
* Trạng thái (Enum: ACTIVE / INACTIVE, mặc định ACTIVE)
* Hạn mức công nợ (VNĐ, mặc định 0)
* Thời hạn công nợ (Ngày, mặc định 30)

## Audit

* createdBy (FK → `users`, nullable)
* updatedBy (FK → `users`, nullable)
* createdAt
* updatedAt
* deletedAt (nullable — null = chưa xóa, có giá trị = đã xóa lúc nào)

## Thông tin thống kê

Các thông tin dưới đây **không lưu trực tiếp trong bảng customers**.

Được tính toán realtime từ các Module liên quan (Đơn hàng, Công nợ) khi cần hiển thị.

* Lần mua đầu tiên
* Lần mua gần nhất
* Tổng số đơn hàng
* Tổng doanh thu
* Công nợ hiện tại

---

# Thiết kế Database

## Bảng `customers`

```
id              String          PK, cuid()
code            String          Unique, sinh từ running_numbers
name            String          Bắt buộc
phone           String          Unique, bắt buộc
email           String?         Không unique, validate format
company_name    String?         Tên công ty — khách doanh nghiệp (thêm 08/07/2026, testlan1)
tax_code        String?         Mã số thuế — phục vụ xuất hoá đơn (thêm 08/07/2026)
province        String?
district        String?
ward            String?
address         String?
customer_group_id  String?      FK → customer_groups
delivery_route_id  String?      FK → delivery_routes
sale_id         String?         FK → users
priority        Priority        Default MEDIUM
status          CustomerStatus  Default ACTIVE
debt_limit      Decimal         Default 0 (VNĐ)
debt_term_days  Int             Default 30 (Ngày)
note            String?
created_by      String?         FK → users
updated_by      String?         FK → users
created_at      DateTime
updated_at      DateTime
deleted_at      DateTime?
```

## Index

| Index | Mục đích |
|---|---|
| `code` (unique) | Tra cứu theo mã |
| `phone` (unique) | Kiểm tra trùng SĐT |
| `customer_group_id` | Filter theo nhóm |
| `delivery_route_id` | Filter theo tuyến |
| `sale_id` | Báo cáo theo nhân viên |
| `status` | Lọc active/inactive |
| `deleted_at` | Lọc bản ghi đã xoá |

## Quan hệ

```
User           1 ── N  Customer  (saleId, createdBy, updatedBy)
CustomerGroup  1 ── N  Customer
DeliveryRoute  1 ── N  Customer
Customer       1 ── N  Quotation (module sau)
Customer       1 ── N  Order     (module sau)
```

---

# Chức năng

## Danh sách

* Xem danh sách
* Tìm kiếm theo tên
* Tìm kiếm theo số điện thoại
* Lọc theo nhóm khách hàng
* Lọc theo tuyến giao hàng
* Phân trang
* Sắp xếp

## Thêm

Cho phép tạo khách hàng mới.

## Chỉnh sửa

Cho phép cập nhật toàn bộ thông tin.

## Xóa

Sử dụng Soft Delete (`deletedAt`).

Không xóa vật lý.

Không cho phép xóa khách hàng đã phát sinh đơn hàng.

## Chi tiết

Hiển thị:

* Thông tin khách hàng
* Danh sách báo giá
* Danh sách đơn hàng
* Công nợ
* Ghi chú
* Chiết khấu sản phẩm (xem mục riêng bên dưới)

## Chiết khấu sản phẩm

> Sprint 04 (chốt 16/07/2026) — THAY THẾ HOÀN TOÀN `CustomerGroup.discountPercent`
> ("CK nhóm") đã xoá khỏi hệ thống.

Cấu hình chiết khấu riêng theo **từng cặp Khách hàng × Sản phẩm** — khách A
mua sản phẩm X được giảm bao nhiêu %, sản phẩm Y có thể không được giảm gì.
Chỉ dùng đơn vị %, mặc định 0% nếu chưa cấu hình.

Bảng riêng `CustomerProductDiscount` — Master Data, không versioned (giống
Pricing Rule ở cấp đơn giản, không có khái niệm DRAFT/ACTIVE/ARCHIVED).

```
id                String   PK, cuid()
customer_id       String   FK → customers
product_id        String   FK → products
discount_percent  Decimal  0–100 (%)
created_at        DateTime
updated_at        DateTime

@@unique([customer_id, product_id])
```

API nested dưới Customer:

* `GET /customers/:id/product-discounts` — danh sách chiết khấu đã cấu hình
* `POST /customers/:id/product-discounts` — thêm mới `{ productId, discountPercent }`
* `PATCH /customers/:id/product-discounts/:discountId` — sửa % (không đổi được sản phẩm)
* `DELETE /customers/:id/product-discounts/:discountId` — xoá
* `GET /customers/:id/product-discounts/lookup?productId=` — trả `{ discountPercent }` (0 nếu chưa cấu hình), dùng khi Quotation module thêm dòng báo giá

**Ranh giới kiến trúc:** Không gộp vào Pricing Engine — Pricing Rule chỉ dùng
để tính giá bán (`systemPrice`), chiết khấu là chuyện của khách hàng
(Quotation module's Discount Engine, xem `quotation.md`).

Khi thêm dòng báo giá, hệ thống lookup và **snapshot** % này vào
`QuotationItem.discountPercent` — sửa cấu hình sau đó không ảnh hưởng báo giá
đã tạo (đúng CLAUDE.md mục 7, Snapshot & Document Design).

## Import Excel

Cho phép nhập danh sách khách hàng.

Yêu cầu:

* Kiểm tra dữ liệu.
* Báo lỗi theo từng dòng.
* Không import dữ liệu lỗi.

## Export Excel

Xuất danh sách khách hàng theo bộ lọc hiện tại.

---

# Business Rule

* Tên khách hàng là bắt buộc.
* Số điện thoại là bắt buộc.
* Số điện thoại không được trùng (unique).
* Email không bắt buộc, không unique.
* Nếu có Email phải đúng định dạng.
* Thời hạn công nợ mặc định là 30 ngày.
* Hạn mức công nợ mặc định bằng 0 VNĐ.
* Không xóa khách hàng đã phát sinh đơn hàng.
* Sử dụng Soft Delete (`deletedAt`).

---

# Validation

## Bắt buộc

* Tên khách hàng
* Số điện thoại

## Kiểm tra

* Email đúng định dạng.
* Hạn mức công nợ ≥ 0.
* Thời hạn công nợ ≥ 0.

---

# Ghi chú

Claude Code chỉ triển khai các chức năng được mô tả trong file này.

Nếu thiếu nghiệp vụ hoặc phát hiện xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
