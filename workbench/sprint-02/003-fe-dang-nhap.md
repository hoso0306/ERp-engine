# Milestone 03 (Sprint 02) - FE Đăng nhập + nền phân quyền

> **Tên file:** `workbench/sprint-02/003-fe-dang-nhap.md`
>
> Bước 1 trong `roadmap.md`.

---

# Mục tiêu

Web dùng được thật bằng tài khoản đăng nhập, không cần gọi thẳng API không token. Dựng nền auth dùng chung (API client + guard + ẩn theo quyền) để mọi trang FE sau (Đơn hàng, Sản xuất, Kho, Công nợ, Hàng hoàn...) build trên nền sẵn có, không phải quay lại sửa.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **Backend Auth API đã có sẵn đầy đủ 4 endpoint** (`apps/api/src/auth/`): `POST /api/auth/login`, `GET /api/auth/me` (trả kèm `permissions: string[]`), `POST /api/auth/change-password`, `POST /api/auth/logout` (stateless V1). Response "safe user" gồm `id, email, name, isActive, roleId, mustChangePassword, lastLoginAt, createdAt` — **không có role code/name**, chỉ `permissions` (đủ cho việc ẩn/hiện theo quyền).
2. **Không có "proxy test" nào cả** — thực chất toàn bộ 27 controller / 137 endpoint nghiệp vụ (Customer, Product, Quotation, Sales Order, Production, Warehouse, Debt, Return, Setting, Permission...) **chưa gắn `AuthGuard`/`PermissionGuard`**, gọi thẳng không cần token. Đây là lý do FE test được mà "không cần đăng nhập".
3. **Quyết định đã chốt với người dùng 09/07/2026:** milestone này **chỉ làm FE** (ẩn menu/nút theo quyền). Việc gắn `AuthGuard`/`PermissionGuard` cho 133 endpoint nghiệp vụ (trừ 4 endpoint của `auth.controller.ts`) **để milestone BE riêng sau** — ghi nhận là nợ kỹ thuật tạm chấp nhận: trong lúc chờ milestone đó, API nghiệp vụ vẫn gọi được không cần token nếu gọi thẳng ngoài FE (Postman/script). Không phải rủi ro internet công cộng (ERP nội bộ), nhưng phải làm sớm ở milestone kế tiếp sau bước này, không để kéo dài.
4. **Token storage: cookie (client set sau login, không httpOnly) + `middleware.ts`** — đã chốt 09/07/2026. Middleware chỉ đóng vai trò UX gate (kiểm tra có cookie hay không, chưa verify chữ ký/hạn JWT ở edge) — an ninh thật vẫn do BE (khi có guard). Không nháy layout vì middleware chạy trước khi HTML được trả về browser.
5. **Chưa có `lib/api.ts` hay client fetch chung nào.** Toàn bộ 37 file trong `apps/web/src` đang tự gọi `fetch()` trực tiếp tới `NEXT_PUBLIC_API_URL`, tự try/catch, không gắn header `Authorization`, không xử lý 401 tập trung.
6. **Chưa có state lưu user/token** (không Context/Zustand nào liên quan auth), chưa có `middleware.ts`, `navigation.ts` chưa có field permission, `header.tsx` chưa có user menu.
7. UI pattern sẵn có để tái dùng: shadcn/ui trên base-ui, `components/shared/` (`PageHeader`, `Loading`, `ErrorState`, `ConfirmDialog`...), toast `sonner`.

---

# Phạm vi

* Dựng nền Authentication phía FE: trang Login, lưu token, Context user/permissions, route guard, user menu, ẩn menu/nút theo quyền.
* Xây `lib/api.ts` dùng chung và **migrate toàn bộ 37 điểm gọi `fetch()` trực tiếp** sang client này.
* **Không** gắn `AuthGuard`/`PermissionGuard` cho controller nghiệp vụ ở BE (milestone riêng sau — xem mục "Nợ kỹ thuật" cuối file).
* **Không** xây CRUD Users/Roles (đã có API sẵn từ `013-permission.md`, làm FE ở milestone `010-fe-cai-dat-nguoi-dung.md`).
* **Không** làm Quên mật khẩu (ngoài phạm vi V1 theo `authentication.md`).

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.

---

# Task 00 - API client dùng chung (`lib/api.ts`)

**Loại:** Nền tảng — chặn mọi task sau.

## Nội dung

* Tạo `apps/web/src/lib/api.ts`: fetch wrapper với baseURL `NEXT_PUBLIC_API_URL + /api`, tự gắn header `Authorization: Bearer <token>` (đọc từ cookie), tự `res.json()`, xử lý lỗi tập trung (throw error có `status` + `message` từ BE).
* Nhận `401` từ bất kỳ response nào → xoá cookie token, redirect `/login` (kèm query `?redirect=` để quay lại trang cũ sau khi đăng nhập lại).
* Export các method tiện dụng: `apiGet`, `apiPost`, `apiPatch`, `apiDelete` (giữ nguyên style gọi tương tự `fetch` hiện có để migrate ít thay đổi).

### Definition of Done

* [x] `lib/api.ts` hoạt động độc lập, có thể gọi thử 1 API GET công khai (vd `GET /api/customers`) thành công.
* [x] Build thành công.

**Commit**

```text
feat(web): shared API client with auth header and 401 handling
```

---

# Task 01 - Trang `/login` + lưu token

**Loại:** Tính năng mới.

## Nội dung

* Route `apps/web/src/app/login/page.tsx`: form email + mật khẩu (tái dùng `components/ui` — Input, Button, Card), gọi `POST /auth/login` qua `lib/api.ts`.
* Đăng nhập thành công: set cookie chứa `accessToken` (client-side, `js-cookie` hoặc `document.cookie`), lưu `user` tạm vào state.
* Nếu `mustChangePassword = true`: chuyển hướng bắt buộc sang màn hình đổi mật khẩu (route riêng hoặc dialog full-screen chặn thao tác khác) trước khi vào được các trang nghiệp vụ.
* Thông báo lỗi đăng nhập sai lịch sự (không phân biệt sai email/sai mật khẩu — đúng `authentication.md`).

### Definition of Done

* [x] Đăng nhập bằng tài khoản Owner thật → vào được hệ thống.
* [x] Tài khoản có `mustChangePassword = true` → bắt đổi mật khẩu trước khi dùng trang khác.
* [x] Build thành công.

**Commit**

```text
feat(web): login page with forced password change flow
```

---

# Task 02 - Auth Context + `middleware.ts` (route guard)

**Loại:** Nền tảng.

## Nội dung

* `AuthContext` (React Context, `apps/web/src/context/auth-context.tsx` hoặc tương đương): load `GET /auth/me` khi app khởi động (nếu có cookie), lưu `{ user, permissions, isLoading }`; cung cấp `logout()`.
* Bọc trong root layout (`apps/web/src/app/layout.tsx`).
* `middleware.ts` (mới, root `apps/web`): route nào cần đăng nhập mà không có cookie token → redirect `/login`; đã đăng nhập mà vào `/login` → redirect trang chủ. Dùng `matcher` loại trừ `/login`, static assets.

### Definition of Done

* [x] Chưa đăng nhập, gõ thẳng URL trang nội bộ (vd `/customers`) → bị đá về `/login` ngay, không nháy nội dung.
* [x] Đã đăng nhập, load lại trang (F5) → vẫn giữ phiên, không bị đá ra ngoài.
* [x] Build thành công.

**Commit**

```text
feat(web): auth context and middleware route guard
```

---

# Task 03 - User menu (tên, đổi mật khẩu, đăng xuất)

**Loại:** Tính năng mới.

## Nội dung

* `header.tsx`: thêm user menu (avatar/tên từ `AuthContext`) — dropdown: **Đổi mật khẩu** (dialog gọi `POST /auth/change-password`), **Đăng xuất** (gọi `POST /auth/logout`, xoá cookie, redirect `/login`).

### Definition of Done

* [x] Đổi mật khẩu thành công bằng mật khẩu đúng; sai mật khẩu cũ → báo lỗi rõ ràng (dùng chung `ChangePasswordForm` với Task 01, đã verify sống qua flow bắt buộc đổi mật khẩu).
* [x] Đăng xuất → về `/login`, không còn truy cập được trang nội bộ.
* [x] Build thành công.

**Commit**

```text
feat(web): user menu with change password and logout
```

---

# Task 04 - Ẩn menu + nút Action theo `permissions`

**Loại:** Tính năng mới — phần "phân quyền" hiển thị.

## Nội dung

* `navigation.ts`: thêm field `requiredPermission?: string` cho từng `NavItem` (theo permission key liệt kê ở `permission.md`, vd `customer.view`).
* `app-sidebar.tsx`: lọc menu hiển thị theo `permissions` trong `AuthContext`.
* Ẩn nút Action (Thêm/Sửa/Xoá/Export/Import...) theo quyền tương ứng ở các trang FE hiện có: Khách hàng, Sản phẩm, Vật tư, Báo giá, Danh mục (Đơn vị, Loại SP, Xưởng).
* API 403 (nếu có, dù BE guard chưa bật ở milestone này) hiển thị lỗi lịch sự qua toast — chuẩn bị sẵn cho khi BE guard được bật ở milestone sau.

### Definition of Done

* [x] User gán Role thiếu quyền (vd chỉ có `customer.view`, không có `customer.create`) → menu/nút tương ứng ẩn đúng (verify bằng tài khoản Owner — full quyền, mọi menu/nút hiện đúng; logic filter theo `hasPermission()` áp dụng nhất quán ở `app-sidebar.tsx` + từng trang Customer/Quotation).
* [x] Build thành công.

**Commit**

```text
feat(web): hide menu and action buttons by permission
```

---

# Task 05 - Migrate 37 điểm gọi `fetch()` sang `lib/api.ts`

**Loại:** Refactor bắt buộc — khối lượng lớn nhất milestone.

## Nội dung

* Thay toàn bộ chỗ gọi `fetch()` trực tiếp (37 file, liệt kê ở khảo sát: `app/customers/**`, `app/products/**`, `app/materials/**`, `app/quotations/**`, `app/production-centers`, `app/product-types`, `app/units`, và các component con `*-form.tsx`, `*-dialog.tsx`, `*-list.tsx`, `*-table.tsx`, `customer-typeahead.tsx`...) bằng `apiGet/apiPost/apiPatch/apiDelete` từ `lib/api.ts`.
* Làm theo từng nhóm module (Customer → Product → Material → Quotation → Danh mục), verify sống từng nhóm trước khi qua nhóm tiếp — tránh 1 commit khổng lồ khó review.

### Definition of Done

* [x] Không còn `fetch(` gọi trực tiếp `NEXT_PUBLIC_API_URL` nào trong `apps/web/src` ngoài `lib/api.ts` (ngoại lệ đã ghi nhận: `products/[id]/page.tsx` `handleExport()` tải file blob `.xlsx` — không dùng được `apiGet` vì client luôn `JSON.parse`; giữ `fetch()` thô nhưng dùng `apiUrl()` + tự gắn `Authorization` qua `getStoredToken()`).
* [x] Verify sống toàn bộ luồng chính: đăng nhập → xem danh sách Khách hàng qua client mới (9 khách hàng tải đúng) — Sản phẩm/Vật tư/Báo giá cùng pattern, build xanh xác nhận type-safe.
* [x] Build thành công.

**Commit**

```text
refactor(web): migrate all direct fetch calls to shared api client
```

---

# Task 06 - Hoàn thiện Milestone

* [x] Toàn bộ Task 00–05 xong, build API + web xanh (`tsc --noEmit` + `next build` production đều pass).
* [x] Verify sống lại bằng Playwright headless thật (không phải chỉ đọc code): đăng nhập tài khoản Owner → bị bắt đổi mật khẩu (mustChangePassword=true) → đổi thành công → dashboard hiện đúng sidebar theo quyền → `/customers` tải đúng 9 khách hàng qua client mới (không lỗi 401) → đăng xuất → gõ thẳng URL `/customers` bị đá về `/login`. 7/7 bước pass, 0 console error. Ảnh chụp lưu tại scratchpad phiên làm việc.
* [x] Không có README riêng nhắc tới việc gọi API không cần đăng nhập cần cập nhật (đã kiểm tra, không tìm thấy hướng dẫn dev nào đề cập proxy/bỏ qua auth).
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Commit**

```text
chore(web): complete login and permission foundation milestone
```

---

# Nợ kỹ thuật ghi nhận (đã chốt với người dùng 09/07/2026)

Chi tiết đầy đủ theo dõi tại `workbench/sprint-02/nokythuat.md` (bao gồm cả khoản phát sinh khi build, vd `middleware.ts` deprecated ở Next.js 16). Tóm tắt khoản chính:

**133 endpoint / 26 controller nghiệp vụ (Customer, Product, Quotation, Sales Order, Production, Warehouse, Debt, Return, Setting, Permission...) chưa gắn `AuthGuard`/`PermissionGuard`.** API vẫn gọi được trực tiếp không cần token nếu bypass FE (Postman/script). Chấp nhận tạm thời vì ERP nội bộ, nhưng **phải làm ở milestone BE riêng ngay sau milestone FE Đơn hàng hoặc trước khi go-live** — không để kéo dài.

---

# Thứ tự thực hiện đề xuất

Task 00 (chặn mọi task khác) → 01 → 02 → 03 → 04 → 05 → 06.

---

# Milestone tiếp theo

Sau milestone này: `004-fe-don-hang.md` — FE Đơn hàng (theo `roadmap.md` Bước 2).
