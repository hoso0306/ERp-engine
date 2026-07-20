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

**Permission không xử lý đăng nhập** (mật khẩu, JWT, session) — đó là việc của Module Authentication riêng. Xem mục "Phụ thuộc Authentication" bên dưới.

**Permission sở hữu CRUD User** (tạo/sửa/vô hiệu hoá nhân viên) — vì tạo User luôn đi kèm gán `roleId`, hai việc này nằm chung một chỗ hợp lý hơn tách riêng. Xem mục "Quản lý User" bên dưới.

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

# Phụ thuộc Module Authentication

**Permission và Authentication là hai module tách biệt, không gộp chung** — đây là quyết định kiến trúc quan trọng nhất của module này:

```text
Authentication  →  "Anh là ai?"     (đăng nhập, JWT, session)
Permission      →  "Anh được làm gì?" (đã biết là ai, kiểm tra quyền)
```

Lý do tách riêng: nếu sau này đổi cơ chế đăng nhập (JWT → Google Login, Microsoft Login, SSO...), Permission hoàn toàn không cần đổi gì — chỉ Authentication đổi.

**Permission phụ thuộc vào Authentication đã chạy trước** (đã xác định được `User` hiện tại của request), nhưng không tự triển khai Authentication.

Thứ tự roadmap: `012-authentication` phải làm **trước** `013-permission`. Permission không thể hoạt động nếu Authentication chưa tồn tại — hiện tại `User` chưa có field `password`, chưa có JWT/session nào trong toàn bộ codebase.

**Chiều ngược lại:** Permission (khi tạo User mới — xem "Quản lý User") gọi qua `AuthService.setTemporaryPassword(userId)` để đặt mật khẩu tạm — không tự viết logic hash mật khẩu. Đây là phụ thuộc 2 chiều có chủ đích, không phải vòng lặp kiến trúc: Authentication lo cơ chế xác thực, Permission lo vòng đời User/Role — mỗi module chỉ gọi đúng phần việc thuộc về module kia.

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

Authentication (module riêng — xác định User hiện tại)

↓

Permission (kiểm tra quyền của User đó)

↓

Controller

↓

Business Service

↓

Database
```

Permission luôn chạy trước Business, và luôn chạy sau Authentication.

**Các endpoint của chính Authentication (`/auth/login`, `/auth/logout`, `/auth/change-password`, `/auth/me`) không đi qua `PermissionGuard`.** `/auth/login` không qua Guard nào cả (chưa đăng nhập thì không có gì để check quyền). 3 endpoint còn lại chỉ cần `AuthGuard` (biết đang là ai) — không có Permission cụ thể nào cho "được phép đổi mật khẩu/đăng xuất của chính mình", đây là quyền mặc định đi kèm có session hợp lệ, không thuộc hệ thống Role/Permission.

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

**`email`, `passwordHash`, `isActive`, `lastLoginAt`, `lastLoginIp` thuộc phạm vi Authentication** (xem `authentication.md`) — Permission chỉ sở hữu `roleId` và các API quản lý danh sách User bên dưới.

---

# Quản lý User

**Không có đăng ký công khai.** Chỉ Admin/Owner (đã có quyền tương ứng) mới tạo được User mới:

```http
POST /users        (tạo User mới — nhập email, tên hiển thị, gán roleId)
GET /users
GET /users/:id
PATCH /users/:id   (sửa tên hiển thị, isActive, roleId)
```

Khi tạo User, gọi qua `AuthService.setTemporaryPassword(userId)` (thuộc Authentication) để đặt mật khẩu tạm — Permission không tự viết logic hash mật khẩu, đúng pattern Module Ownership. Nhân viên tự đổi thành mật khẩu thật ở lần đăng nhập đầu (xem `authentication.md` mục "Quan hệ với Permission").

**Không xoá User — chỉ vô hiệu hoá (`isActive = false`)**, cùng nguyên tắc đã áp dụng cho `Role` ở mục dưới.

**Không được vô hiệu hoá (`isActive = false`) chính tài khoản Owner cuối cùng đang hoạt động** — tránh khoá luôn quyền truy cập cao nhất vào hệ thống, không còn ai vào lại được.

**Không cho User tự Disable chính mình** (áp dụng cho mọi Role, không riêng Owner) — rào chắn UX khác mục đích với rule "Owner cuối cùng" ở trên (rule này chặn tự khoá nhầm tài khoản đang dùng; rule kia chặn toàn hệ thống mất hết Owner). Cả hai cùng áp dụng, không thay thế nhau.

---

# Role

```text
Role

code   // bất biến — OWNER, ADMIN, MANAGER, SALES, PRODUCTION, WAREHOUSE, ACCOUNTANT, VIEWER
name   // hiển thị, sửa được — vd "Chủ doanh nghiệp"
```

**Tách `code` (bất biến) và `name` (hiển thị, sửa được)** — không dùng một field vừa làm định danh vừa cho phép đổi tự do. Lý do: Business Rule trong toàn dự án so sánh cứng theo `code` (vd rule "Không được vô hiệu hoá Owner cuối cùng" so sánh `role.code == 'OWNER'`) — nếu `name` vừa là định danh vừa "có thể sửa", Owner đổi nhãn hiển thị (vd sang tiếng Việt) sẽ vô tình làm gãy các so sánh cứng đó. `code` không bao giờ đổi sau khi tạo; `name` đổi tự do, chỉ phục vụ hiển thị — cùng pattern đã dùng cho `RunningNumber.type` (bất biến) vs `prefix` (sửa được).

`name` có thể sửa. `code` không hard-code theo nghĩa business logic, nhưng **không đổi được sau khi tạo**.

**Không được Delete, chỉ được Disable** (`isActive = false`).

**Không được Disable nếu còn User đang sử dụng Role đó.** Phải chuyển toàn bộ User sang Role khác trước, mới được Disable — cùng nguyên tắc "kiểm tra điều kiện trước khi chuyển trạng thái" đã áp dụng cho `SalesOrder.cancel()` (chặn nếu còn `Receivable.paidAmount > 0`).

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

**`key` (`resource.action` nối sẵn, vd `sales-order.ship`) được lưu thành field riêng, có index unique — là Derived Data được phép lưu theo lý do "Hiệu năng đọc" (CLAUDE.md mục 13):** Source Data là `resource`+`action`; cập nhật lúc seed/tạo Permission (không đổi sau đó). `PermissionGuard` chạy trên gần như mọi request (hot path thực sự) — lưu sẵn `key` tránh phải nối chuỗi lại mỗi lần kiểm tra quyền.

**Permission không có CRUD API — chỉ seed sẵn.** Owner/Admin không tự tạo Permission mới, chỉ được **gán** Permission có sẵn cho Role. Permission mới chỉ được thêm khi Dev release tính năng mới (đi kèm migration/seed), tránh loạn permission key do gõ tay sai hoặc đặt tên không nhất quán.

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

override

print

view-cost
```

**`view-cost` (Sprint 04 — 022):** xem giá vốn ước tính và lợi nhuận của báo giá (cột Giá vốn, nút Xem lãi/lỗ, cột Tổng giá vốn/Lợi nhuận ở danh sách). Đây là dữ liệu tài chính nhạy cảm, không phải Business Action, nên tách riêng khỏi `view`: chỉ OWNER và ADMIN có (qua `allKeys()`), SALES nhận toàn bộ action của resource `quotation` **trừ** `view-cost` (lọc tường minh trong seed). MANAGER/VIEWER không có. Backend enforce ở tầng API (`GET /quotations/:id/cost-summary` guard bằng permission này; `GET /quotations` chỉ đính kèm `totalCost`/`profit` khi role có quyền) — không dựa vào FE ẩn cột.

---

## Sales Order

```text
view

ship

deliver

cancel

override
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
```

**Không có `issue`.** Xuất kho (`WarehouseTransaction` direction OUT) được ERP tự sinh bên trong `ProductionOrder.start()` — không phải một Action người dùng bấm trực tiếp (xem `warehouse.md`). Quyền kiểm soát việc này nằm ở `production.start`, không phải một permission `warehouse.issue` riêng.

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

update

mark-used

dispose
```

**`update`** — dùng riêng cho endpoint Management (`PUT /recovery-inventory/:id`, sửa `location`/`imageUrl`/`status` thủ công — xem `return.md`). Tách biệt với `dispose` vì `dispose` là Business Action một chiều (chỉ chạy được khi `status = AVAILABLE`), còn Management sửa tự do không qua ràng buộc đó.

---

## Product

```text
view

create

update

delete

activate

export
```

**Bao gồm** Product, Material (+ giá vật tư), Unit, ProductType, ProductParameter, PricingRule (version + item + matrix), MaterialRequirement (version + item), ValidationRule, DerivedParameter — toàn bộ catalog/master data thuộc `ProductModule`, dùng chung một resource `product` (giống cách Quotation gộp chung QuotationItem vào resource `quotation`).

**`activate`** — kích hoạt PricingRuleVersion/MaterialRequirementVersion, tách riêng khỏi `update` cùng logic Quotation tách `approve` khỏi `update`: đây là hành động đổi giá bán/định mức vật tư đang chạy **live** cho toàn bộ đơn hàng mới, không phải một chỉnh sửa DRAFT thông thường. Chỉ OWNER/ADMIN có quyền này (qua `allKeys()`) — MANAGER dù có nhóm quyền "hành động nặng" (approve/override/cancel) cũng **không** có `product.activate`, vì đây là quyết định giá bán cấp doanh nghiệp, không cùng nhóm với các Business Action approve/override/cancel của từng chứng từ riêng lẻ.

**`export`** — xuất Excel thông tin sản phẩm, cùng pattern action `export` đã có ở Customer.

**Endpoint `/pricing-engine/calculate`** (module riêng, ngoài `ProductModule`) dùng chung permission `product.view` — đây là hàm tính giá dùng lại bởi cả trang Preview của Product lẫn form tạo Báo giá (Quotation), không mutate dữ liệu nên xếp vào `view`.

---

## Production Center

```text
view

create

update

delete
```

Tách khỏi resource `production` (vốn chỉ có `view/start/complete` — quyền theo dõi/thao tác ProductionOrder) vì CRUD xưởng sản xuất (`ProductionCenter`) là khái niệm khác: quản lý danh sách xưởng (master data), không phải vận hành một đơn sản xuất cụ thể.

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

## User & Role (Permission tự quản)

```text
user.view

user.create

user.update       // sửa tên hiển thị, isActive, roleId

role.view

role.create

role.update       // đổi tên, gán/gỡ Permission cho Role

role.disable
```

Không có `user.delete`/`role.delete` — chỉ có `update`/`disable` (xem "Quản lý User" và "Role" — không xoá, chỉ vô hiệu hoá).

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

**Dashboard không có permission riêng cho từng KPI.** Dashboard không sở hữu dữ liệu (Module Ownership — xem `dashboard.md`), nên cũng không sở hữu permission — chỉ hỏi lại đúng quyền `view` của module sở hữu dữ liệu tương ứng:

```text
Warehouse Overview   → hỏi quyền  warehouse.view
Debt Overview        → hỏi quyền  debt.view
Return Overview      → hỏi quyền  return.view
Production Overview  → hỏi quyền  production.view
```

Không có quyền `xxx.view` tương ứng → ẩn đúng phần KPI đó, không ẩn toàn bộ Dashboard. Không tạo thêm permission `dashboard.sales`/`dashboard.debt`/`dashboard.warehouse` nào — tránh nhân đôi permission cho cùng một khái niệm.

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

Mọi thay đổi Permission (gán/gỡ Permission khỏi Role, tạo Role mới, Disable Role) phải ghi Audit Log.

## PermissionAudit

```text
PermissionAudit

id

roleId

permissionId  // nullable — null khi action là ROLE_CREATED/ROLE_DISABLED/USER_*

userId        // nullable — target User cho USER_CREATED/USER_DISABLED/USER_ROLE_CHANGED,
              // bắt buộc có vì roleId một mình không định danh được User nào
              // (nhiều User có thể cùng Role). Redundant reference, không @relation.

action        // GRANT, REVOKE, ROLE_CREATED, ROLE_DISABLED, USER_CREATED, USER_DISABLED, USER_ROLE_CHANGED

changedBy

payload

createdAt
```

Append-only — cùng pattern đã dùng cho `SalesOrderTimeline`/`ProductionOrderTimeline`.

**`payload` chỉ lưu phần thay đổi (delta), không snapshot toàn bộ object.** Ví dụ khi đổi Role của một User:

```json
{ "fromRole": "SALES", "toRole": "MANAGER" }
```

Không lưu toàn bộ thông tin User/Role cũ-mới — giữ log nhẹ, cùng cách `SalesOrderTimeline` chỉ lưu `{fromStatus, toStatus}`.

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
- Dashboard hiển thị theo Permission của module sở hữu dữ liệu — không tạo permission `dashboard.xxx` riêng.
- Permission không có CRUD API — chỉ seed theo release, Owner chỉ được gán Permission có sẵn cho Role.
- Role không được Delete — chỉ Disable, và không Disable được nếu còn User đang dùng.
- Mọi thay đổi Permission đều ghi `PermissionAudit`, không cho xoá lịch sử.
- Permission phụ thuộc Authentication đã xác định User — không tự xử lý đăng nhập.
- Permission sở hữu CRUD User (`user.*`) — vì tạo User luôn đi kèm gán Role.
- Không xoá User — chỉ vô hiệu hoá (`isActive = false`), gọi hash mật khẩu tạm qua `AuthService`, không tự viết logic hash.
- Không được vô hiệu hoá tài khoản Owner cuối cùng đang hoạt động.
- Không cho User tự vô hiệu hoá chính mình (áp dụng mọi Role, độc lập với rule Owner cuối cùng ở trên).

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

Authentication (module riêng, làm trước) quyết định:

**"Anh là ai?"**
