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

* [ ] Database đáp ứng chức năng.
* [ ] API danh sách hoạt động.
* [ ] Giao diện danh sách hoạt động.
* [ ] Tìm kiếm hoạt động.
* [ ] Bộ lọc hoạt động.
* [ ] Phân trang hoạt động.
* [ ] Build thành công.

**Commit**

```text
feat(customer): customer list
```

---

# Task 03 - Thêm khách hàng

## Mục tiêu

Hoàn thành chức năng thêm mới khách hàng.

### Definition of Done

* [ ] API tạo khách hàng hoạt động.
* [ ] Form thêm khách hàng hoạt động.
* [ ] Validation hoạt động.
* [ ] Lưu dữ liệu thành công.
* [ ] Build thành công.

**Commit**

```text
feat(customer): create customer
```

---

# Task 04 - Chỉnh sửa & Chi tiết khách hàng

## Mục tiêu

Hoàn thành chức năng xem và cập nhật thông tin khách hàng.

### Definition of Done

* [ ] API hoạt động.
* [ ] Trang chi tiết hoạt động.
* [ ] Chỉnh sửa thành công.
* [ ] Hiển thị đúng dữ liệu.
* [ ] Build thành công.

**Commit**

```text
feat(customer): update customer
```

---

# Task 05 - Xóa khách hàng

## Mục tiêu

Hoàn thành chức năng xóa mềm khách hàng.

### Definition of Done

* [ ] API Soft Delete hoạt động.
* [ ] Không xóa dữ liệu vật lý.
* [ ] Tuân thủ Business Rule.
* [ ] Build thành công.

**Commit**

```text
feat(customer): soft delete customer
```

---

# Task 06 - Import & Export Excel

## Mục tiêu

Hoàn thành chức năng Import và Export Excel.

### Definition of Done

* [ ] Import Excel hoạt động.
* [ ] Export Excel hoạt động.
* [ ] Kiểm tra dữ liệu khi Import.
* [ ] Thông báo lỗi rõ ràng.
* [ ] Build thành công.

**Commit**

```text
feat(customer): import export excel
```

---

# Task 07 - Hoàn thiện Module

## Mục tiêu

Kiểm tra và hoàn thiện toàn bộ Module.

### Definition of Done

* [ ] Toàn bộ chức năng hoạt động.
* [ ] Không còn lỗi TypeScript.
* [ ] Không còn lỗi Runtime.
* [ ] Build thành công.
* [ ] Đã tự review.
* [ ] Đề xuất Commit Message.
* [ ] Dừng.

**Commit**

```text
chore(customer): complete customer module
```

---

# Tiêu chí hoàn thành

Module được xem là hoàn thành khi:

* [ ] Hoàn thành toàn bộ Task.
* [ ] Đã Commit.
* [ ] Đã Push GitHub.
* [ ] Sẵn sàng cho Module tiếp theo.

---

# Module tiếp theo

Sau khi hoàn thành Module Khách hàng sẽ chuyển sang:

**003-san-pham.md**
