# Module Permission (Authorization)

> **Tên file:** `knowledge/modules/permission.md`

---

# Mục đích

Quản lý quyền truy cập của người dùng trong toàn bộ ERP.

Permission chỉ quyết định:

- Người dùng nhìn thấy gì.
- Người dùng được phép làm gì.
- Người dùng được phép truy cập module nào.

Permission **không** quyết định Business Rule.

Ví dụ:

Có quyền Ship

≠

Được Ship mọi Sales Order.

Business Rule vẫn do từng Module kiểm tra.

---

# Vai trò trong ERP

Permission là Module nền tảng.

Toàn bộ Module nghiệp vụ đều sử dụng.

Bao gồm:

- Customer
- Product
- Quotation
- Sales Order
- Production
- Warehouse
- Debt
- Return
- Dashboard
- Settings

---

# Triết lý thiết kế

Permission chỉ kiểm tra:

```text
Có được phép thực hiện Action hay không?
```

Không kiểm tra:

- Workflow
- Validation
- Business Rule

Ví dụ

```text
sales-order.ship
```

↓

Permission

Có quyền?

↓

YES

↓

SalesOrderService.ship()

↓

Business Rule

↓

Production đã hoàn thành chưa?
```

---

# Kiến trúc

```text
Request

↓

Authentication

↓

Permission

↓

Controller

↓

Business Service

↓

Database
```

Permission luôn chạy trước Business.

---

# Data Model

```text
User
    │
    ▼
Role
    │
    ▼
RolePermission
    │
    ▼
Permission
```

---

# User

Một User chỉ thuộc một Role.

```text
User

roleId
```

V1 không hỗ trợ nhiều Role.

---

# Role

Ví dụ

```text
OWNER

ADMIN

MANAGER

SALES

PRODUCTION

WAREHOUSE

ACCOUNTANT

VIEWER
```

Role có thể sửa.

Không hard-code.

---

# Permission

Permission được định nghĩa theo:

```text
resource

+

action
```

Ví dụ

```text
sales-order

ship
```

↓

```text
sales-order.ship
```

Không lưu theo URL.

Không lưu theo HTTP Method.

---

# Role Permission

Role được gán nhiều Permission.

Ví dụ

Sales

```text
customer.view

quotation.create

quotation.update

sales-order.view
```

Warehouse

```text
warehouse.view

warehouse.receipt

warehouse.issue
```

---

# Action Permission

Permission theo Action.

Ví dụ

## Customer

```text
view

create

update

delete

export
```

---

## Quotation

```text
view

create

update

approve

cancel

print
```

---

## Sales Order

```text
view

ship

deliver

cancel
```

---

## Production

```text
view

start

complete
```

---

## Warehouse

```text
view

receipt

issue
```

---

## Debt

```text
view

create-payment
```

---

## Return

```text
view

create

mark-used

dispose
```

---

## Dashboard

```text
view
```

---

## Settings

```text
view

update
```

---

# Menu Permission

Permission cũng quyết định Menu.

Ví dụ

Warehouse không có quyền

↓

Ẩn Menu Warehouse.

Không hiển thị Menu mà User không được phép truy cập.

---

# Dashboard Permission

Dashboard không tự kiểm tra quyền.

Dashboard hỏi Permission Module.

Ví dụ

```text
Dashboard

↓

PermissionService

↓

Có quyền xem KPI?

↓

YES

↓

Hiển thị
```

Không

↓

Ẩn KPI.

---

# Business Rule

Permission không thay đổi Business Rule.

Ví dụ

Có quyền:

```text
production.complete
```

Không có nghĩa:

```text
ProductionOrder

PENDING

↓

COMPLETE
```

Business Rule vẫn kiểm tra:

```text
Status

==

IN_PRODUCTION
```

Tương tự

Có quyền:

```text
sales-order.cancel
```

Không có nghĩa:

Được huỷ mọi Sales Order.

Sales Order vẫn phải kiểm tra:

- Production đã bắt đầu chưa.
- Có Payment chưa.
- Điều kiện Business khác.

---

# Default Roles

Hệ thống seed sẵn:

```text
OWNER

ADMIN

MANAGER

SALES

PRODUCTION

WAREHOUSE

ACCOUNTANT

VIEWER
```

Có thể chỉnh sửa sau.

---

# Audit

Mọi thay đổi Permission phải ghi Audit Log.

Ví dụ

```text
09:30

Owner

Đổi Role

Sales

Thêm quyền

sales-order.ship
```

Không cho phép xoá lịch sử.

---

# Business Rule

- Một User chỉ thuộc một Role (V1).
- Một Role có nhiều Permission.
- Một Permission có thể thuộc nhiều Role.
- Permission chỉ kiểm tra quyền.
- Business Rule vẫn thuộc Module nghiệp vụ.
- Không phân quyền theo URL.
- Không phân quyền theo HTTP Method.
- Phân quyền theo Action.
- Menu hiển thị theo Permission.
- Dashboard hiển thị theo Permission.
- Mọi thay đổi Permission đều ghi Audit Log.

---

# Không làm trong V1

Không triển khai:

- Multiple Roles
- Scope (SELF / TEAM / ALL)
- Field Permission
- Data Masking
- Dynamic Policy
- Department Permission

Đây sẽ là V2.

---

# Mục tiêu của Module

Module Permission giúp doanh nghiệp:

- Quản lý quyền truy cập.
- Quản lý Menu.
- Quản lý Dashboard.
- Kiểm soát Action của từng User.

Permission chỉ quyết định:

**"Được phép làm gì?"**

Business Module quyết định:

**"Có được thực hiện nghiệp vụ hay không?"**