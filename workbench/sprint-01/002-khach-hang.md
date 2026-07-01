# Milestone 02 - Module Khách hàng

> **Tên file:** `workbench/sprint-01/002-khach-hang.md`

---

# Mục tiêu

Hoàn thành Module Quản lý Khách hàng theo đúng tài liệu nghiệp vụ.

Sau khi hoàn thành, Module phải sẵn sàng để các Module Báo giá, Đơn hàng và Công nợ sử dụng.

---

# Phạm vi

Chỉ phát triển Module Khách hàng.

Không sửa hoặc phát triển Module khác.

Nếu phát hiện nghiệp vụ chưa rõ hoặc xung đột, phải dừng và hỏi người dùng trước khi tiếp tục.

---

# Tham chiếu

Trước khi thực hiện cần đọc:

* `.claude/CLAUDE.md`
* `knowledge/project/05-coding-convention.md`
* `knowledge/modules/customer.md`

Chỉ đọc thêm tài liệu khác nếu thật sự cần thiết.

---

# Quy trình làm việc

* Mỗi lần chỉ thực hiện **01 Task**.
* Hoàn thành xong Task thì dừng.
* Tóm tắt những gì đã thực hiện.
* Liệt kê các file đã tạo hoặc chỉnh sửa.
* Đề xuất Commit Message.
* Chờ Task tiếp theo.

---

# Task 01 - Thiết kế dữ liệu

## Mục tiêu

Thiết kế Model Customer dựa trên tài liệu nghiệp vụ.

### Definition of Done

* [x] Đề xuất Model Customer.
* [x] Đề xuất các bảng liên quan (nếu có).
* [x] Đề xuất quan hệ giữa các bảng.
* [x] Đề xuất Index cần thiết.
* [x] Chờ người dùng xác nhận trước khi code.

**Commit**

```text
docs(customer): design customer data model
```

---

# Task 02 - Danh sách khách hàng

## Mục tiêu

Hoàn thành chức năng xem danh sách khách hàng.

### Definition of Done

* [x] Database đáp ứng chức năng.
* [x] API danh sách hoạt động.
* [x] Giao diện danh sách hoạt động.
* [x] Tìm kiếm hoạt động.
* [x] Bộ lọc hoạt động.
* [x] Phân trang hoạt động.
* [x] Build thành công.

**Commit**

```text
feat(customer): customer list
```

---

# Task 03 - Thêm khách hàng

## Mục tiêu

Hoàn thành chức năng thêm mới khách hàng.

### Definition of Done

* [x] API tạo khách hàng hoạt động.
* [x] Form thêm khách hàng hoạt động.
* [x] Validation hoạt động.
* [x] Lưu dữ liệu thành công.
* [x] Build thành công.

**Commit**

```text
feat(customer): create customer
```

---

# Task 04 - Chỉnh sửa & Chi tiết khách hàng

## Mục tiêu

Hoàn thành chức năng xem và cập nhật thông tin khách hàng.

### Definition of Done

* [x] API hoạt động.
* [x] Trang chi tiết hoạt động.
* [x] Chỉnh sửa thành công.
* [x] Hiển thị đúng dữ liệu.
* [x] Build thành công.

**Commit**

```text
feat(customer): update customer
```

---

# Task 05 - Xóa khách hàng

## Mục tiêu

Hoàn thành chức năng xóa mềm khách hàng.

### Definition of Done

* [x] API Soft Delete hoạt động.
* [x] Không xóa dữ liệu vật lý.
* [x] Tuân thủ Business Rule.
* [x] Tab "Đã xoá" hiển thị KH đã xoá.
* [x] Khôi phục KH đã xoá hoạt động.
* [x] Build thành công.

**Commit**

```text
feat(customer): soft delete customer
```

---

# Task 06 - Import & Export Excel

## Mục tiêu

Hoàn thành chức năng Import và Export Excel.

### Definition of Done

* [x] Import Excel hoạt động.
* [x] Export Excel hoạt động.
* [x] File mẫu import có đầy đủ các trường giống export.
* [x] Trường bắt buộc đánh dấu * trong file mẫu.
* [x] Kiểm tra dữ liệu khi Import.
* [x] Thông báo lỗi rõ ràng.
* [x] Build thành công.

**Commit**

```text
feat(customer): import export excel
```

---

# Task 07 - Hoàn thiện Module

## Mục tiêu

Kiểm tra và hoàn thiện toàn bộ Module.

### Definition of Done

* [x] Toàn bộ chức năng hoạt động.
* [x] Không còn lỗi TypeScript.
* [x] Không còn lỗi Runtime.
* [x] Build thành công.
* [x] Đã tự review.
* [x] Đề xuất Commit Message.
* [x] Dừng.

**Commit**

```text
chore(customer): complete customer module
```

---

# Tiêu chí hoàn thành

Module được xem là hoàn thành khi:

* [x] Hoàn thành toàn bộ Task.
* [x] Đã Commit.
* [x] Đã Push GitHub.
* [x] Sẵn sàng cho Module tiếp theo.

---

# Module tiếp theo

Sau khi hoàn thành Module Khách hàng sẽ chuyển sang:

**003-san-pham.md**
