# Milestone 01 - Layout Hệ thống

> **Tên file:** `workbench/sprint-01/001-layout.md`

---

# Mục tiêu

Xây dựng giao diện nền (Application Layout) cho toàn bộ hệ thống ERP.

Layout là nền tảng dùng chung cho tất cả Module trong hệ thống.

Sau khi hoàn thành, các Module chỉ cần xây dựng nội dung riêng mà không cần tạo lại giao diện tổng thể.

---

# Phạm vi

Chỉ thực hiện Layout.

Không phát triển nghiệp vụ.

Không tạo Module Khách hàng hoặc các Module khác.

---

# Tham chiếu

Trước khi thực hiện cần đọc:

* `.claude/CLAUDE.md`
* `knowledge/project/04-cong-nghe-su-dung.md`
* `knowledge/project/05-coding-convention.md`

---

# Yêu cầu kỹ thuật

* Sử dụng **Next.js App Router**
* Sử dụng **Tailwind CSS**
* Sử dụng **shadcn/ui**
* Sử dụng **Lucide React**
* Menu được quản lý bằng cấu hình (config), không hard-code.
* Layout phải dễ mở rộng khi thêm Module mới.

---

# Task 01 - Khởi tạo Layout

## Mục tiêu

Xây dựng bộ khung giao diện chung của hệ thống.

### Definition of Done

* [ v] Sidebar
* [ v] Header
* [ v] Content Area
* [ v] Footer (nếu cần)
* [ v] Responsive Desktop
* [ v] Có thể tái sử dụng cho toàn bộ Module

**Commit**

```text
feat(layout): create application layout
```

---

# Task 02 - Điều hướng

## Mục tiêu

Xây dựng hệ thống điều hướng chung.

### Definition of Done

* [ v] Menu Dashboard
* [ v] Menu Khách hàng
* [ v] Menu Sản phẩm
* [ v] Menu Báo giá
* [ v] Menu Đơn hàng
* [ v] Menu Kho
* [ v] Menu Sản xuất
* [ v] Menu Công nợ
* [ v] Menu Hàng hoàn
* [ v] Menu Báo cáo
* [ v] Menu Cài đặt
* [ v] Active Menu
* [ v] Sidebar có thể Thu gọn / Mở rộng
* [ v] Menu được sinh từ Config

**Commit**

```text
feat(layout): create navigation system
```

---

# Task 03 - Thành phần dùng chung

## Mục tiêu

Xây dựng các thành phần giao diện được sử dụng lại trong toàn bộ ERP.

### Definition of Done

* [ v] Breadcrumb
* [ v] Page Header
* [ v] Loading
* [ v] Empty State
* [ v] Error State
* [ v] Confirm Dialog
* [ v] Notification (Toast)

**Commit**

```text
feat(layout): create shared ui components
```

---

# Task 04 - Hoàn thiện

## Mục tiêu

Kiểm tra và hoàn thiện Layout.

### Definition of Done

* [ v] Build thành công
* [ v] Không còn lỗi TypeScript
* [ v] Không còn lỗi Console
* [ v] Responsive Desktop
* [ v] Đã tự review
* [ v] Đề xuất Commit Message
* [ v] Dừng và chờ Module tiếp theo

**Commit**

```text
chore(layout): complete application layout
```

---

# Tiêu chí hoàn thành

Layout được xem là hoàn thành khi:

* [ v] Hoàn thành toàn bộ Task
* [ v] Có thể tái sử dụng cho mọi Module
* [ v] Không cần sửa lại khi phát triển Module Khách hàng
* [ v] Đã Commit
* [ v] Đã Push GitHub

---

# Module tiếp theo

Sau khi hoàn thành Layout sẽ chuyển sang:

**002-khach-hang.md**
