# Milestone 10 (Sprint 03) - FE Cài đặt + Người dùng/Phân quyền

> **Tên file:** `workbench/sprint-03/010-fe-cai-dat-nguoi-dung.md`
>
> Bước 8 trong `roadmap.md`. Lập kế hoạch sớm hơn thứ tự gốc (trước Bước 5/6/7 — Hàng hoàn/Báo cáo/Dashboard) theo yêu cầu người dùng 10/07/2026; module này không phụ thuộc dữ liệu của 3 bước đó nên không bị chặn kỹ thuật.

---

# Mục tiêu

Owner/Admin cấu hình hệ thống (công ty, bộ số chứng từ, cấu hình theo module) và quản lý User/Role. Theo `knowledge/modules/setting.md` + `knowledge/modules/permission.md`.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **BE Settings đã có sẵn, chỉ Update (không Create/Delete)** (`apps/api/src/setting/`):
   * `GET/PUT /settings/company` — Company Settings (singleton, 1 dòng duy nhất).
   * `GET /settings/running-numbers`, `PUT /settings/running-numbers/:type` — chỉ sửa `prefix`/`paddingLength`/`enabled`, **không sửa `lastNumber`** (không có Reset).
   * `GET /settings`, `GET /settings/:module`, `PUT /settings/:module` (`{values: {key: value}}`) — key-value engine dùng chung cho Dashboard/Notification/Document/Security/Backup. Model `Setting` có sẵn `defaultValue` — "Khôi phục mặc định" chỉ cần FE gửi lại `value = defaultValue` qua đúng API này, **không cần API riêng**.
   * Toàn bộ đã gắn `AuthGuard`+`PermissionGuard`, quyền `settings.view`/`settings.update`.
   * **Thiết kế FE không hardcode danh sách module** — `GET /settings` trả về tất cả, FE tự nhóm theo field `module` thành tab động. Module `Backup` cũng hiện ra bình thường (seed đã có `autoBackup`/`backupSchedule`) dù theo `setting.md` mới "chuẩn bị cấu trúc cho V2" — expose cấu hình không sai, chỉ cơ chế backup thật chưa chạy, không phải lý do để giấu tab.
2. **`quotations/[id]/print/page.tsx` đã đọc Company Settings + `Document.quotationDefaultTerms` thật** (`GET /settings/company`, `GET /settings/Document`) — **khảo sát ban đầu tưởng đây còn placeholder hard-code theo ghi chú cũ trong `setting.md`, nhưng kiểm tra lại code hiện tại thì việc này đã được làm xong (ngoài phạm vi milestone này, không rõ từ commit nào)**. Không cần task sửa trang in ở milestone này nữa.
3. **BE Permission (User/Role) đã có** (`apps/api/src/permission/`):
   * `GET/POST /users`, `GET/PATCH /users/:id` — quyền `user.view`/`user.create`/`user.update`. Tạo User tự sinh mật khẩu tạm qua `AuthService.setTemporaryPassword()`, trả `temporaryPassword` (chỉ 1 lần trong response, không lưu plaintext).
   * `GET/POST /roles`, `GET/PATCH /roles/:id`, `POST /roles/:id/disable` — quyền `role.view`/`role.create`/`role.update`/`role.disable`. `PATCH /roles/:id` nhận `permissionIds` (mảng đầy đủ) — thay thế toàn bộ tập quyền hiện tại, BE tự diff để ghi `PermissionAudit` GRANT/REVOKE từng permission.
   * Business Rule đã enforce ở BE (không cần FE làm lại, chỉ hiển thị lỗi): không tự vô hiệu hoá chính mình, không vô hiệu hoá Owner cuối cùng, không Disable Role còn User đang dùng, `Role.code` bất biến sau khi tạo.
4. **Thiếu 2 chỗ nhỏ ở BE — đã xác nhận với người dùng, thêm vào Task 00/01:**
   * **Không có endpoint liệt kê toàn bộ Permission catalog.** `GET /roles/:id` chỉ trả permission **đã gán** cho role đó — không đủ để dựng UI checkbox "chọn quyền" (cần biết toàn bộ quyền có thể gán). Quyết định: thêm `GET /permissions` (đọc-only, trả `{id, resource, action, key}[]`), gắn quyền `role.view` (không tạo permission key mới, chỉ dùng để dựng màn hình sửa Role).
   * **`PATCH /users/:id` chưa hỗ trợ "cấp lại mật khẩu tạm"** dù `authentication.md` (dòng 202) đã ghi trước đúng thiết kế này ("Admin/Owner reset thủ công cho User qua `PATCH /users/:id`") nhưng chưa code. Quyết định: thêm field `resetPassword?: boolean` vào `UpdateUserDto`; khi `true`, `UserService.update()` gọi lại `authService.setTemporaryPassword(id)` và trả `temporaryPassword` trong response (giống hệt `create()`) — không tạo route mới, không thêm `PermissionAuditAction` mới (reset mật khẩu không nằm trong danh sách hành vi bắt buộc ghi Audit của `permission.md`, giữ đúng phạm vi tài liệu đã định nghĩa).
5. **UI component `Checkbox` đã có sẵn** (`components/ui/checkbox.tsx`, dựng base-ui) — dùng thẳng cho màn gán quyền theo nhóm resource, không cần tạo mới.
6. **Không có FE nào cho Cài đặt/Người dùng/Vai trò hiện tại** — menu "Cài đặt" (`/settings`) đang `disabled: true`, đã khai báo `requiredPermission: "settings.view"`. Chưa có mục menu "Người dùng"/"Vai trò".
7. UI pattern tái dùng: CRUD đơn giản kiểu `product-types`/`units` (bảng + dialog, không có trang `[id]` riêng) cho Users; riêng Role cần trang `[id]` riêng (giống `material-requirement/versions/[versionId]`) vì khối gán quyền theo nhóm resource là nội dung lớn, không hợp dồn vào Dialog.

---

# Phạm vi

* **BE nhỏ:** `GET /permissions` (catalog); `resetPassword` trong `UpdateUserDto`/`UserService.update()`.
* `/settings`: Công ty, Bộ số chứng từ, Cấu hình hệ thống (Dashboard/Notification/Document/Security/Backup theo tab động).
* `/settings/users`: CRUD User (tạo, sửa tên/role/isActive, cấp lại mật khẩu tạm, vô hiệu hoá).
* `/settings/roles` + `/settings/roles/[id]`: CRUD Role (tạo, sửa tên, gán/gỡ quyền theo nhóm resource, Disable).
* Bật menu Cài đặt + thêm menu Người dùng + Vai trò.
* **Không** sửa trang in báo giá (đã xong từ trước, ngoài phạm vi công việc của milestone này).
* **Không** làm Reset `lastNumber`/resetPolicy cho Running Number (BE không hỗ trợ, có chủ đích — xem `setting.md`).
* **Không** làm Backup thật (V1 chỉ chuẩn bị cấu trúc, không triển khai lịch backup/provider thật).
* **Không** đổi Business Rule của Permission/Settings — chỉ thêm 2 chỗ đọc/ghi nhỏ đã liệt kê ở mục khảo sát 4.

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.

---

# Task 00 — BE: `GET /permissions` (Permission catalog)

## Nội dung

* Thêm endpoint mới `GET /permissions` — đặt trong `permission/role.controller.ts` (cùng module sở hữu) hoặc file controller mới, gắn `@RequirePermission('role.view')`. Service: `this.prisma.permission.findMany({ orderBy: [{resource: 'asc'}, {action: 'asc'}] })`, trả `{id, resource, action, key}[]`.

### Definition of Done

* [x] `GET /permissions` trả đúng toàn bộ danh mục Permission đã seed, sắp xếp theo resource (verify sống: trả đúng 39 permission).
* [x] User không có `role.view` bị 403 (verify code — `@RequirePermission('role.view')` áp dụng nhất quán như các endpoint khác trong dự án).
* [x] Build API thành công.

**Commit**

```text
feat(api): add GET /permissions catalog endpoint for role assignment UI
```

---

# Task 01 — BE: Cấp lại mật khẩu tạm qua `PATCH /users/:id`

## Nội dung

* Thêm `resetPassword?: boolean` vào `UpdateUserDto`.
* `UserService.update()`: nếu `dto.resetPassword === true`, gọi `this.authService.setTemporaryPassword(id)` (trong cùng luồng xử lý, sau khi áp các thay đổi name/isActive/roleId khác nếu có), gộp `temporaryPassword` vào response trả về (giống `create()`).

### Definition of Done

* [x] Gọi `PATCH /users/:id` với `resetPassword: true` → nhận về `temporaryPassword` mới, `mustChangePassword` bật lại theo `Settings.Security.forceChangePasswordOnFirstLogin` (verify sống qua UI, dialog mật khẩu tạm hiện đúng).
* [x] Không truyền `resetPassword` → hành vi cũ không đổi (verify code — nhánh `if (dto.resetPassword === true)` tách biệt, các field khác vẫn qua `data` object như cũ).
* [x] Build API thành công.

**Commit**

```text
feat(api): support temporary password reset via PATCH /users/:id
```

---

# Task 02 — `/settings` Công ty + Bộ số chứng từ

## Nội dung

* Route `apps/web/src/app/settings/page.tsx`, layout dạng Tabs (mở rộng dần ở Task 03).
* Tab "Công ty": form sửa `companyName, logo, address, phone, email, website, taxCode, currency, currencySymbol, timezone` → `PUT /settings/company`.
* Tab "Bộ số chứng từ": bảng `RunningNumber` (type, prefix, lastNumber — chỉ đọc, paddingLength, enabled) + dialog sửa `prefix`/`paddingLength`/`enabled` cho từng dòng → `PUT /settings/running-numbers/:type`.

### Definition of Done

* [x] Sửa thông tin công ty thành công, phản ánh đúng ngay và đúng trang in báo giá đọc lại giá trị mới (verify sống: đổi tên công ty + SĐT, mở lại `/quotations/[id]/print` thấy đúng giá trị mới).
* [x] Sửa prefix/padding một loại chứng từ thành công, không sửa được `lastNumber` (verify sống: đổi padding CUSTOMER 6→7, `lastNumber` không đổi vì UI/DTO không có field này).
* [x] Build thành công.

**Commit**

```text
feat(web): company settings and running number configuration
```

---

# Task 03 — `/settings` Cấu hình hệ thống (Dashboard/Notification/Document/Security/Backup)

## Nội dung

* Thêm tab "Cấu hình hệ thống" (hoặc nhóm tab con theo từng `module`, dựng động từ `GET /settings` — không hardcode danh sách module).
* Renderer chung theo `valueType`: `BOOLEAN` → Switch/Checkbox, `NUMBER` → input number, `STRING` → input text, `TEXT` → textarea. Hiển thị `description` làm label phụ.
* Nút "Khôi phục mặc định" từng field → set giá trị input về `defaultValue` (chưa gọi API, chờ Lưu) hoặc lưu ngay — thống nhất theo hành vi nút "Lưu" chung của form (lưu theo module, không lưu từng field riêng lẻ, đúng API `PUT /settings/:module` nhận nhiều `values` một lần).

### Definition of Done

* [x] Sửa 1 giá trị NUMBER thành công, phản ánh đúng (verify sống: `Backup.retentionDays` 30→15, đối chiếu qua API `GET /settings/Backup`).
* [x] Khôi phục mặc định 1 field hoạt động đúng (verify code — nút chỉ hiện khi giá trị khác `defaultValue`, set lại đúng field rồi chờ Lưu chung form).
* [x] Build thành công.

**Commit**

```text
feat(web): generic settings form for dashboard, notification, document, security, backup
```

---

# Task 04 — `/settings/users` CRUD User

## Nội dung

* Bảng Users: email, tên, Role, trạng thái (Đang hoạt động/Đã vô hiệu hoá), lần đăng nhập gần nhất, badge "Chưa đổi mật khẩu" nếu `mustChangePassword=true`.
* Dialog **Tạo User** (quyền `user.create`): email, tên, chọn Role (chỉ Role `isActive`) → `POST /users`; sau khi tạo, hiển thị `temporaryPassword` trong dialog kết quả (chỉ hiện một lần, có nút Copy, cảnh báo không hiển thị lại được).
* Dialog **Sửa User** (quyền `user.update`): tên, Role, `isActive` (ẩn tuỳ chọn tự vô hiệu hoá chính mình phía FE, dù BE đã chặn) → `PATCH /users/:id`.
* Action **"Cấp lại mật khẩu tạm"** (quyền `user.update`): confirm → `PATCH /users/:id` với `resetPassword: true` → hiện `temporaryPassword` mới cùng kiểu dialog kết quả như lúc tạo.

### Definition of Done

* [x] Tạo User mới thành công, thấy đúng mật khẩu tạm một lần (verify sống: tạo tài khoản test, dialog cảnh báo hiện đúng email + mật khẩu).
* [x] Sửa Role/trạng thái User thành công; nút "Cấp lại mật khẩu tạm" tự ẩn với chính tài khoản đang đăng nhập (chặn phía FE, không cần thử vi phạm để thấy lỗi BE).
* [x] Cấp lại mật khẩu tạm thành công, thấy mật khẩu mới (verify sống).
* [x] Build thành công.

**Commit**

```text
feat(web): user management with create, update, and password reset
```

---

# Task 05 — `/settings/roles` + `/settings/roles/[id]` CRUD Role

## Nội dung

* `/settings/roles`: bảng Roles (code, tên, số User đang dùng, trạng thái) + dialog **Tạo Role** (quyền `role.create`): `code` (bất biến, chỉ nhập lúc tạo), `name` → `POST /roles`.
* `/settings/roles/[id]`: sửa `name` (quyền `role.update`); khối gán quyền — danh sách `GET /permissions` nhóm theo `resource` thành từng nhóm collapsible, mỗi quyền một `Checkbox` (dùng component có sẵn), trạng thái ban đầu theo `role.rolePermissions`; nút Lưu gửi toàn bộ `permissionIds` đã tick → `PATCH /roles/:id`. Action **"Vô hiệu hoá Role"** (quyền `role.disable`, ẩn nếu Role đang có User dùng — kiểm tra qua field số User ở danh sách, dù BE vẫn là nguồn chặn chính) → `POST /roles/:id/disable`.

### Definition of Done

* [x] Tạo Role mới, gán quyền, lưu thành công (verify sống: tạo Role, tick quyền `customer.create`, Lưu → đối chiếu qua API `GET /roles/:id` thấy đúng permission vừa gán).
* [x] Vô hiệu hoá Role không còn User dùng → thành công (verify sống 2 Role test, cả hai đều 0 User nên Disable thành công đúng theo rule).
* [x] Build thành công.

**Commit**

```text
feat(web): role management with permission assignment
```

---

# Task 06 — Bật menu Cài đặt + Người dùng + Vai trò

## Nội dung

* `config/navigation.ts`: bỏ `disabled: true` ở "Cài đặt"; thêm 2 mục mới "Người dùng" (`/settings/users`, quyền `user.view`) và "Vai trò" (`/settings/roles`, quyền `role.view`) trong nhóm "Hệ thống".

### Definition of Done

* [x] 3 menu bấm được, không còn badge "Đang phát triển" ở Cài đặt (verify sống — menu text sạch: "Cài đặt", "Người dùng", "Vai trò").
* [x] User thiếu quyền tương ứng không thấy menu (verify code — nhất quán `requiredPermission` + logic filter menu đã dùng cho mọi milestone trước).
* [x] Build thành công.

**Commit**

```text
feat(web): enable settings menu and add users/roles navigation
```

---

# Task 07 — Hoàn thiện Milestone

* [x] Toàn bộ Task 00–06 xong, build API + web xanh (`tsc --noEmit` cả 2 app + `next build` production đều pass; route `/settings`, `/settings/users`, `/settings/roles`, `/settings/roles/[id]` build thành công).
* [x] Verify sống luồng chính bằng Playwright headless thật (đăng nhập `owner@erp.local` thật):
  * Menu "Cài đặt"/"Người dùng"/"Vai trò" hiển thị sạch, không còn badge "Đang phát triển".
  * Sửa Company Settings (tên công ty + SĐT) → mở lại trang in báo giá (`/quotations/[id]/print`) thấy đúng giá trị mới — verify chéo thành công.
  * Sửa Bộ số chứng từ (padding CUSTOMER 6→7) → đối chiếu API đúng, `lastNumber` không đổi.
  * Sửa Cấu hình hệ thống (`Backup.retentionDays` 30→15) → đối chiếu API đúng.
  * Tạo User mới → dialog mật khẩu tạm hiện đúng 1 lần; Cấp lại mật khẩu tạm cho User đó → dialog hiện mật khẩu mới.
  * Tạo Role mới → gán quyền `customer.create` qua checkbox → Lưu → đối chiếu `GET /roles/:id` thấy đúng permission đã gán (phát hiện và fix ngay: phải click trực tiếp vào ô checkbox hiển thị, không phải label — hành vi bình thường với thao tác chuột thật của người dùng).
  * Vô hiệu hoá 2 Role test (không còn User dùng) → thành công.
  * 0 lỗi console/page trong toàn bộ phiên verify.
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Lưu ý vận hành phát sinh khi verify (không phải thay đổi nghiệp vụ):** dữ liệu dev đổi thật do verify sống thật: Company Settings (tên công ty, SĐT), `RunningNumber.CUSTOMER.paddingLength` (6→7), `Setting.Backup.retentionDays` (30→15); tạo 1 User test (`verify.*@erp.local`) và 2 Role test (đã Disable ngay sau khi verify, không xoá được theo thiết kế). Tất cả là dữ liệu demo hợp lệ, không cần revert.

**Commit**

```text
chore(web): complete settings and user/role management milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07.

---

# Milestone tiếp theo

Theo thứ tự gốc của roadmap, các milestone `007-fe-hang-hoan.md`, `008-bao-cao.md`, `009-fe-dashboard.md` vẫn đang chờ (xem mục Tiến độ trong `roadmap.md`) — cân nhắc quay lại đúng thứ tự sau milestone này nếu không có lý do nghiệp vụ khác để tiếp tục nhảy bước.
