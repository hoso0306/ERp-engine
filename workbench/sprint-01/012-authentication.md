# Sprint 01 — Module Authentication

> **Tên file:** `workbench/sprint-01/012-authentication.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Authentication theo kiến trúc đã thống nhất.

Module này chỉ trả lời: **"Anh là ai?"**

Không quyết định quyền hạn (đó là Module Permission — `013-permission.md`, làm ngay sau task này).

Đọc kỹ `knowledge/modules/authentication.md` trước khi bắt đầu — mọi quyết định thiết kế đã chốt ở đó.

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Authentication.

**Không tạo model mới** — chỉ bổ sung field vào `User` đã có sẵn.

---

## Field cần thêm vào User

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `passwordHash` | `String` | bcrypt, không bao giờ lưu plaintext |
| `isActive` | `Boolean` | `@default(true)` — vô hiệu hoá, không xoá |
| `lastLoginAt` | `DateTime?` | |
| `lastLoginIp` | `String?` | |
| `mustChangePassword` | `Boolean` | `@default(false)` — bật khi tạo mới/bị reset mật khẩu tạm, tắt khi tự đổi thành công. **Field này cần bổ sung vào `knowledge/modules/authentication.md`** — chưa được liệt kê ở đó, phát hiện khi triển khai (không có field này thì không có cách nào phân biệt "user mới, chưa đổi mật khẩu" với "user cũ, đã có mật khẩu thật" để enforce `forceChangePasswordOnFirstLogin` đúng theo từng User). |

**Không thêm `roleId` ở Task này.** `roleId` thuộc phạm vi Permission (`013-permission.md` Task 00) — Authentication chỉ đọc field này (khi đã tồn tại) để đưa vào JWT, không sở hữu.

---

## Definition of Done

- [x] `User` có đủ field: `passwordHash`, `isActive`, `lastLoginAt`, `lastLoginIp`, `mustChangePassword`.
- [x] Cập nhật `knowledge/modules/authentication.md` bổ sung field `mustChangePassword` vào Data Model.
- [x] Migration chạy thành công.
- [x] Prisma Schema đồng bộ.
- [x] ERD đồng bộ.

---

# Task 01 — Login Flow

## Mục tiêu

Triển khai đăng nhập bằng email + mật khẩu.

```http
POST /auth/login

{ "email": "...", "password": "..." }
```

---

## Business Flow

```text
Nhận email + password
    ↓
Tìm User theo email
    ↓
User tồn tại và isActive = true?
    ↓ Không          ↓ Có
  Từ chối      So khớp password với passwordHash (bcrypt.compare)
                    ↓ Sai        ↓ Đúng
                 Từ chối    Phát hành JWT
                                 ↓
                            Cập nhật lastLoginAt, lastLoginIp
                                 ↓
                            Trả về { accessToken, user, mustChangePassword }
```

**Không phân biệt lỗi "email không tồn tại" và "sai mật khẩu"** trong message trả về — cùng một thông báo chung chung (tránh lộ email nào đã đăng ký).

---

## Definition of Done

- [x] Đăng nhập đúng email/password → nhận JWT.
- [x] Sai email hoặc sai password → cùng một lỗi chung, không phân biệt.
- [x] `isActive = false` → không đăng nhập được.
- [x] `lastLoginAt`/`lastLoginIp` cập nhật đúng sau khi đăng nhập thành công.
- [x] Response có `mustChangePassword` để FE biết cần ép đổi mật khẩu ngay.

---

# Task 02 — Token & Guard

## Mục tiêu

Phát hành và xác thực JWT.

---

## Token

JWT chứa tối thiểu:

```text
sub    (userId)
exp    (thời điểm hết hạn)
```

**`roleId` sẽ được thêm vào payload khi `013-permission.md` hoàn thành field `User.roleId`.** Task này có thể để JWT chỉ có `sub`/`exp` trước, bổ sung `roleId` vào payload khi làm Task 013 — không chặn tiến độ Task 012.

**Không cần regenerate token đang tồn tại khi 013 thêm `roleId`.** Token phát hành trước đó (chỉ có `sub`/`exp`) đơn giản là không có `roleId` — không cần cơ chế migrate/refresh token phức tạp. Xử lý đơn giản nhất: yêu cầu đăng nhập lại sau khi 013 hoàn thành, token mới sẽ có đủ `roleId`.

**Thời hạn JWT đọc từ `Settings.Security.sessionTimeout`** (đã có sẵn — `SettingService`, xem `010-cai-dat.md`) — không hard-code số phút.

---

## Guard

Tạo `AuthGuard` (NestJS) — parse `Authorization: Bearer <token>`, xác thực JWT hợp lệ + chưa hết hạn, gắn `req.user` (userId, và roleId khi đã có).

```http
GET /auth/me
```

Trả về thông tin User hiện tại (dựa vào `req.user` do Guard gắn).

---

## Definition of Done

- [x] JWT phát hành đúng, thời hạn đọc từ `Settings.Security.sessionTimeout`.
- [x] `AuthGuard` chặn request không có/token sai/token hết hạn.
- [x] `GET /auth/me` hoạt động.

---

# Task 03 — Đổi mật khẩu

## Mục tiêu

Cho phép User tự đổi mật khẩu.

```http
POST /auth/change-password

{ "oldPassword": "...", "newPassword": "..." }
```

---

## Validation

- `oldPassword` phải khớp `passwordHash` hiện tại.
- Chỉ tự đổi cho chính mình (dựa vào `req.user` từ Guard) — không có tham số đổi mật khẩu người khác qua API này.
- `newPassword` tối thiểu độ dài (vd 6 ký tự).

Sau khi đổi thành công: `mustChangePassword = false`.

---

## Definition of Done

- [x] Đổi mật khẩu thành công khi `oldPassword` đúng.
- [x] Từ chối khi `oldPassword` sai.
- [x] `mustChangePassword` chuyển về `false` sau khi đổi thành công.
- [x] Không đổi được mật khẩu của User khác qua API này.

---

# Task 04 — Logout

## Mục tiêu

```http
POST /auth/logout
```

**V1 stateless** — không có blacklist token ở server. Endpoint chỉ mang tính hình thức (trả `200 OK`) để FE gọi đồng bộ và tự xoá token đang lưu (localStorage/cookie).

---

## Definition of Done

- [x] `POST /auth/logout` trả về thành công.
- [x] Không xây blacklist/revoke token (đúng phạm vi V1).

---

# Task 05 — Đặt mật khẩu tạm (dùng nội bộ cho Permission)

## Mục tiêu

Cung cấp method dùng chung cho Permission module gọi khi tạo User mới hoặc reset mật khẩu — **không có HTTP endpoint riêng**, chỉ là method nội bộ (`AuthService.setTemporaryPassword(userId)`).

```text
AuthService.setTemporaryPassword(userId)
    ↓
Sinh mật khẩu tạm ngẫu nhiên
    ↓
Hash (bcrypt), lưu vào passwordHash
    ↓
mustChangePassword = true  (nếu Settings.Security.forceChangePasswordOnFirstLogin bật)
    ↓
Trả về mật khẩu tạm (dạng plaintext, một lần duy nhất) để Owner báo cho nhân viên
```

**Đây là method export, không phải API** — `013-permission.md` sẽ gọi trực tiếp method này khi tạo/reset User, không tự viết lại logic hash.

---

## Definition of Done

- [x] `AuthService.setTemporaryPassword()` hoạt động, export được cho module khác gọi.
- [x] Đọc đúng `Settings.Security.forceChangePasswordOnFirstLogin` để quyết định `mustChangePassword`.
- [x] Mật khẩu tạm chỉ trả về plaintext đúng một lần lúc tạo (không lưu plaintext ở đâu khác).

---

# Task 06 — Validation

## Mục tiêu

Kiểm tra toàn bộ Business Rule.

Bao gồm:

- Email unique (đã ràng buộc sẵn ở `User.email`).
- Password không bao giờ trả về/log plaintext.
- Không cho Login bằng Email đã bị Disable (`isActive = false`) — dù đã enforce ở Task 01, liệt lại ở đây vì Task 06 là bước tổng hợp/soát lại toàn bộ Business Rule, không chỉ rule mới.
- Không có đăng ký công khai (không có API tự tạo tài khoản).

---

## Definition of Done

- [x] Validation đầy đủ.
- [x] Pass Review.

---

# Task 07 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Login Flow
- Token/Guard
- Đổi mật khẩu
- Logout
- Validation
- API

Đảm bảo đồng bộ:

- knowledge/modules/authentication.md
- schema.prisma
- ERD

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge (bao gồm bổ sung `mustChangePassword` — xem Task 00).
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Settings (đọc `sessionTimeout`, `forceChangePasswordOnFirstLogin`)

## Module bị ảnh hưởng

- `User` model (thêm `passwordHash`, `isActive`, `lastLoginAt`, `lastLoginIp`, `mustChangePassword`)
- Permission (`013-permission.md`) — đọc `roleId` trong JWT (khi đã có), gọi `AuthService.setTemporaryPassword()` khi tạo/reset User. **`PermissionGuard` phụ thuộc `AuthGuard` chạy trước nó** — pipeline đúng thứ tự: `AuthGuard → PermissionGuard → Business`.

**Việc ai được phép Disable User (kể cả chặn Disable Owner cuối cùng/tự Disable chính mình) thuộc phạm vi `013-permission.md`** (nơi sở hữu CRUD User) — 012 chỉ enforce "isActive = false thì không login được" ở Login Flow, không tự xử lý điều kiện được/không được Disable.

Không được thay đổi Business Rule của Permission hay bất kỳ module nghiệp vụ nào ngoài phạm vi đã thống nhất ở đây.

---

# Commit Message

```text
feat(auth): implement authentication foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Permission (`013-permission.md`).

Sau đó dừng và chờ Task tiếp theo.
