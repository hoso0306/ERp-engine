# Sprint 01 — Module Permission (Authorization)

> **Tên file:** `workbench/sprint-01/013-permission.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Permission theo kiến trúc đã thống nhất.

Module này trả lời: **"Anh được làm gì?"**

Phụ thuộc `012-authentication.md` đã hoàn thành trước — Permission chạy ngay sau Authentication trong pipeline.

Đọc kỹ `knowledge/modules/permission.md` trước khi bắt đầu — mọi quyết định thiết kế đã chốt ở đó.

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Permission.

Bao gồm:

- Thêm `roleId` vào `User`
- Tạo `Role`
- Tạo `Permission`
- Tạo `RolePermission`
- Tạo `PermissionAudit`
- Seed Permission catalog + Default Roles + Role↔Permission mặc định
- Seed 1 User Owner khởi tạo (bootstrap)
- Đồng bộ Prisma Schema
- Đồng bộ ERD

---

## Models cần tạo

### Role

| Field | Ghi chú |
| --- | --- |
| `code` | UNIQUE, bất biến sau khi tạo — `OWNER`, `ADMIN`, `MANAGER`, `SALES`, `PRODUCTION`, `WAREHOUSE`, `ACCOUNTANT`, `VIEWER` |
| `name` | hiển thị, sửa được — vd "Chủ doanh nghiệp" |
| `isActive` | `@default(true)` — không Delete, chỉ Disable |
| `createdAt` / `updatedAt` | |

**Tách `code` (bất biến, dùng để so sánh trong Business Rule) và `name` (hiển thị, tự do đổi).** Không dùng chung một field — nếu chỉ có `name` vừa là định danh vừa "sửa được", đổi nhãn hiển thị sẽ làm gãy các so sánh cứng (vd rule "Owner cuối cùng" ở Task 03 so sánh `role.code == 'OWNER'`, không so sánh `name`).

### Permission

| Field | Ghi chú |
| --- | --- |
| `resource` | vd `sales-order` |
| `action` | vd `ship` |
| `key` | `resource.action`, UNIQUE — vd `sales-order.ship`. Derived Data được phép lưu (lý do Hiệu năng đọc — `PermissionGuard` chạy trên gần như mọi request, tránh nối chuỗi lại mỗi lần check). |

**Không có Create/Update/Delete API cho `Permission`** — chỉ seed theo release (xem Task 00 phần Seed).

### RolePermission

| Field | Ghi chú |
| --- | --- |
| `roleId` | |
| `permissionId` | |

Unique: `(roleId, permissionId)`.

### PermissionAudit

| Field | Ghi chú |
| --- | --- |
| `roleId` | |
| `permissionId` | nullable — null khi action là `ROLE_CREATED`/`ROLE_DISABLED`/`USER_*` |
| `action` | `GRANT`, `REVOKE`, `ROLE_CREATED`, `ROLE_DISABLED`, `USER_CREATED`, `USER_DISABLED`, `USER_ROLE_CHANGED` |
| `changedBy` | userId thực hiện thay đổi |
| `payload` | Json — **chỉ lưu phần thay đổi (delta)**, không snapshot toàn bộ object. Vd đổi Role: `{ "fromRole": "SALES", "toRole": "MANAGER" }` |
| `createdAt` | |

Append-only — không có Update/Delete.

### User (bổ sung)

| Field | Ghi chú |
| --- | --- |
| `roleId` | FK tới `Role`, bắt buộc |

---

## Seed

**Permission catalog** — seed đầy đủ theo danh sách Action Permission ở `permission.md`:

```text
customer: view, create, update, delete, export
quotation: view, create, update, approve, cancel, override, print
sales-order: view, ship, deliver, cancel, override
production: view, start, complete
warehouse: view, receipt
debt: view, create-payment
return: view, create, mark-used, dispose
dashboard: view
settings: view, update
user: view, create, update
role: view, create, update, disable
```

**Default Roles** + **Role↔Permission mặc định** (có thể chỉnh sửa sau qua Task 04):

```text
OWNER, ADMIN     → toàn bộ Permission ở trên
MANAGER          → toàn bộ *.view + approve/override/cancel
SALES            → customer.*, quotation.*, sales-order.view
PRODUCTION       → production.*, warehouse.view
WAREHOUSE        → warehouse.*
ACCOUNTANT       → debt.*, settings.view
VIEWER           → chỉ *.view
```

**Bootstrap 1 User Owner** — để có thể đăng nhập lần đầu tiên vào hệ thống (nếu không, không ai đăng nhập được để tự tạo User qua Task 03):

```text
Nếu chưa có User nào trong hệ thống:
    ↓
Tạo 1 User (email cấu hình sẵn, vd từ biến môi trường)
    ↓
roleId = OWNER
    ↓
Gọi AuthService.setTemporaryPassword(userId) — lấy mật khẩu tạm in ra log/console lúc seed
```

---

## Definition of Done

- [x] `User.roleId` đã thêm (FK bắt buộc).
- [x] `Role`, `Permission`, `RolePermission`, `PermissionAudit` đã tạo.
- [x] Permission catalog seed đầy đủ (đúng danh sách ở trên, khớp `permission.md`).
- [x] Default Roles + Role↔Permission mặc định seed đầy đủ.
- [x] Bootstrap 1 User Owner — đăng nhập được ngay sau khi seed.
- [x] Migration chạy thành công.
- [x] Prisma Schema đồng bộ.
- [x] ERD đồng bộ.

---

# Task 01 — Permission Guard (Engine)

## Mục tiêu

Xây dựng cơ chế kiểm tra quyền dùng chung — **chưa gắn vào Controller nào ở Task này** (xem Task 02).

```text
@RequirePermission('sales-order.ship')
    ↓
PermissionGuard
    ↓
req.user.roleId → RolePermission → Permission.key == 'sales-order.ship' ?
    ↓ Không                              ↓ Có
403 Forbidden                       Cho qua Controller
```

Chạy ngay sau `AuthGuard` (Authentication) trong pipeline.

---

## Definition of Done

- [x] Decorator `@RequirePermission(key)` hoạt động.
- [x] `PermissionGuard` kiểm tra đúng Role → RolePermission → Permission.
- [x] Không có quyền → 403, có quyền → cho qua.
- [x] Chạy đúng sau `AuthGuard`.

---

# Task 02 — Áp dụng Permission Guard vào Controller đã ship

## Mục tiêu

Gắn `@RequirePermission` vào từng endpoint đã ship ở các module trước, đúng theo Permission catalog ở Task 00.

---

## Danh sách cần gắn

```text
CustomerController         → customer.view / .create / .update / .delete / .export
QuotationController        → quotation.view / .create / .update / .approve / .cancel / .override / .print
SalesOrderController       → sales-order.view / .ship / .deliver / .cancel / .override
ProductionOrderController  → production.view / .start / .complete
WarehouseController /
MaterialReceiptController  → warehouse.view / .receipt
DebtController /
PaymentController          → debt.view / .create-payment
ReturnController /
RecoveryInventoryController → return.view / .create / .mark-used / .dispose
DashboardController        → dashboard.view
SettingController          → settings.view / .update
```

**Không thêm `warehouse.issue`** — Material Issue tự sinh từ `production.start`, không phải Action người dùng gọi trực tiếp (xem `permission.md`).

**Không gắn `PermissionGuard` vào các endpoint của Authentication:**

```text
POST /auth/login             → không Guard nào cả (chưa đăng nhập, không có gì để check quyền)
POST /auth/logout             → chỉ AuthGuard, không PermissionGuard
POST /auth/change-password    → chỉ AuthGuard, không PermissionGuard
GET  /auth/me                 → chỉ AuthGuard, không PermissionGuard
```

Đổi mật khẩu/đăng xuất/xem thông tin của chính mình là quyền mặc định đi kèm có session hợp lệ — không thuộc hệ thống Role/Permission.

---

## Definition of Done

- [x] Toàn bộ Controller ở trên đã gắn đúng `@RequirePermission`.
- [x] Test: Role không có quyền tương ứng → 403 khi gọi đúng endpoint đó.
- [x] Test: Role có quyền → gọi thành công như trước (không phá hành vi cũ).
- [x] Xác nhận 4 endpoint của Authentication không bị gắn `PermissionGuard` (chỉ `AuthGuard` hoặc không Guard nào, theo đúng danh sách ở trên).

---

# Task 03 — Quản lý User

## Mục tiêu

CRUD User (thuộc Permission, không thuộc Authentication — xem `authentication.md`/`permission.md`).

```http
POST /users
GET /users
GET /users/:id
PATCH /users/:id
```

`POST /users`: nhập `email`, `name`, `roleId` → gọi `AuthService.setTemporaryPassword(userId)` để đặt mật khẩu tạm.

`PATCH /users/:id`: sửa `name`, `isActive`, `roleId`.

**Không có Delete.** Chỉ `isActive = false`.

**Không được vô hiệu hoá Owner cuối cùng đang hoạt động** (`isActive = true` và `Role.code = 'OWNER'`, so sánh qua `role.code`, không so sánh `role.name`) — chặn nếu đây là Owner duy nhất còn `isActive`.

**Không cho User tự vô hiệu hoá chính mình** (áp dụng mọi Role, độc lập với rule Owner cuối cùng ở trên — dựa vào `req.user` từ Guard để so sánh với `:id` trong request).

---

## Definition of Done

- [x] Tạo User mới, tự động gọi `AuthService.setTemporaryPassword()`.
- [x] List/Detail User.
- [x] Sửa `name`/`isActive`/`roleId`.
- [x] Không có Delete User.
- [x] Chặn vô hiệu hoá Owner cuối cùng.
- [x] Chặn User tự vô hiệu hoá chính mình.
- [x] Ghi `PermissionAudit` (`USER_CREATED`/`USER_DISABLED`/`USER_ROLE_CHANGED`).

---

# Task 04 — Quản lý Role

## Mục tiêu

CRUD Role.

```http
GET /roles
POST /roles
PATCH /roles/:id            (đổi tên, gán/gỡ Permission)
POST /roles/:id/disable
```

**Không có Delete.** Chỉ Disable.

**Không Disable được nếu còn User đang dùng Role đó** (`User.roleId = :id AND isActive = true`) — phải chuyển hết User sang Role khác trước.

---

## Definition of Done

- [x] Tạo/sửa Role, gán/gỡ Permission.
- [x] Không có Delete Role.
- [x] Chặn Disable khi còn User đang dùng.
- [x] Ghi `PermissionAudit` (`ROLE_CREATED`/`ROLE_DISABLED`/`GRANT`/`REVOKE`).

---

# Task 05 — Menu Permission

## Mục tiêu

Cung cấp API để FE biết Menu nào được hiển thị.

```http
GET /auth/me
```

(Mở rộng response của `GET /auth/me` — đã có ở Authentication Task 02 — thêm danh sách `permissions`/`menus` theo Role hiện tại, không tạo endpoint mới riêng.)

Menu ẩn nếu User không có bất kỳ Permission `view` nào thuộc module đó.

---

## Definition of Done

- [x] `GET /auth/me` trả về đủ danh sách quyền của Role hiện tại.
- [x] FE có đủ dữ liệu để ẩn/hiện Menu tương ứng.

---

# Task 06 — Dashboard Permission

## Mục tiêu

Dashboard ẩn/hiện từng KPI theo đúng quyền `view` của module sở hữu dữ liệu — **không tạo permission `dashboard.xxx` riêng**.

```text
Warehouse Overview   → cần  warehouse.view
Debt Overview        → cần  debt.view
Return Overview      → cần  return.view
Production Overview  → cần  production.view
```

Không có quyền tương ứng → ẩn đúng phần KPI đó, không ẩn toàn bộ Dashboard.

---

## Definition of Done

- [x] Từng KPI section kiểm tra đúng quyền `view` của module sở hữu.
- [x] Không tạo permission `dashboard.sales`/`dashboard.debt`/`dashboard.warehouse` nào.
- [x] Thiếu quyền → ẩn đúng phần đó, Dashboard tổng thể vẫn hoạt động.

---

# Task 07 — Audit

## Mục tiêu

Ghi `PermissionAudit` cho mọi thay đổi liên quan Role/Permission/User đã liệt ở Task 03/04.

Append-only, không cho xoá.

---

## Definition of Done

- [x] Mọi hành động ở Task 03/04 đều ghi đúng `PermissionAudit`.
- [x] Không có API xoá `PermissionAudit`.

---

# Task 08 — Validation

## Mục tiêu

Kiểm tra toàn bộ Business Rule.

Bao gồm:

- Permission không có CRUD API (chỉ seed).
- Role/User không xoá — chỉ chuyển trạng thái.
- Không Disable Role còn User đang dùng.
- Không vô hiệu hoá Owner cuối cùng.
- Permission chỉ kiểm tra quyền — không tự kiểm tra Business Rule (Business Rule vẫn ở Module nghiệp vụ, xem `permission.md`).

---

## Definition of Done

- [x] Validation đầy đủ.
- [x] Pass Review.

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Guard/Decorator
- Menu Permission
- Dashboard Permission
- Quản lý User/Role
- Audit
- Validation
- API
- Prisma
- ERD

Đảm bảo đồng bộ:

- knowledge/modules/permission.md
- knowledge/modules/authentication.md
- schema.prisma
- ERD

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Authentication (`012-authentication.md`) — đã xác định User, gọi `AuthService.setTemporaryPassword()`.

## Module bị ảnh hưởng

- Toàn bộ module nghiệp vụ đã ship: Customer, Product, Quotation, Sales Order, Production, Warehouse, Debt, Return, Dashboard, Settings — mỗi Controller cần gắn `@RequirePermission` (Task 02).

Không được thay đổi Business Rule/Data Model của các Module trên ngoài việc gắn thêm Guard.

Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

# Commit Message

```text
feat(permission): implement permission & authorization foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module tiếp theo (Báo cáo).

Sau đó dừng và chờ Task tiếp theo.
