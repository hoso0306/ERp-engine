# Module Authentication

> **Tên file:** `knowledge/modules/authentication.md`

---

# Mục đích

Xác thực danh tính người dùng khi đăng nhập vào ERP.

Authentication chỉ trả lời:

```text
Anh là ai?
```

Authentication **không** trả lời:

```text
Anh được làm gì?
```

Đó là việc của Module Permission (xem `permission.md`).

Module này giúp doanh nghiệp:

- Đăng nhập bằng email + mật khẩu.
- Duy trì phiên đăng nhập (session).
- Đổi mật khẩu.

**Không quản lý CRUD User (tạo/sửa/vô hiệu hoá) — đó là việc của Permission module.** Xem "Quan hệ với Permission" bên dưới.

**Email là Username, không hỗ trợ Username riêng.** Nhân viên đăng nhập bằng đúng email công ty (vd Gmail) đã được Owner nhập khi tạo tài khoản — không có khái niệm "tên đăng nhập" khác email.

---

# Vai trò trong ERP

Authentication là module nền tảng, chạy **trước** Permission trong pipeline:

```text
Request
    ↓
Authentication   ("Anh là ai?")
    ↓
Permission       ("Anh được làm gì?")
    ↓
Controller
    ↓
Business Service
    ↓
Database
```

Mọi module nghiệp vụ (Customer, Quotation, Sales Order, Production, Warehouse, Debt, Return, Dashboard, Settings) đều gián tiếp phụ thuộc Authentication — thông qua Permission Guard chạy sau nó.

**Authentication không quyết định quyền hạn, không chứa Business Logic nghiệp vụ.** Chỉ xác định "request này đến từ User nào, User đó còn hợp lệ không".

---

# Triết lý thiết kế

Tách biệt hoàn toàn với Permission (xem lý do ở `permission.md` mục "Phụ thuộc Module Authentication"):

```text
Authentication  →  Ai đang gọi request này?
Permission      →  Người đó được làm gì?
```

Lợi ích: đổi cơ chế đăng nhập sau này (JWT → Google Login, Microsoft Login, SSO) chỉ sửa Authentication, không đụng Permission.

V1 chỉ triển khai đăng nhập bằng **email + mật khẩu**, phát hành **JWT**. Không có đăng ký công khai (self-signup) — đây là ERP nội bộ, chỉ Admin/Owner tạo User cho nhân viên.

---

# Data Model

`User` đã tồn tại (tạo ở giai đoạn đầu dự án), Authentication bổ sung thêm field:

```text
User

email          (đã có)
name           (đã có)
passwordHash        (mới — bcrypt, không bao giờ lưu plaintext)
isActive            (mới — vô hiệu hoá, không xoá)
lastLoginAt         (mới — DateTime?, tiện theo dõi)
lastLoginIp         (mới — String?, phục vụ Owner theo dõi bảo mật)
mustChangePassword  (mới — Boolean, @default(false))
```

**`mustChangePassword`** — bật thành `true` mỗi khi `AuthService.setTemporaryPassword()` chạy (tạo User mới hoặc reset mật khẩu), tắt lại (`false`) khi User tự đổi mật khẩu thành công qua `POST /auth/change-password`. Đây là field **theo từng User**, cần thiết vì `Settings.Security.forceChangePasswordOnFirstLogin` chỉ là công tắc chung toàn hệ thống — không tự phân biệt được "User này đã đổi mật khẩu thật hay chưa", phải có field riêng trên từng User mới enforce đúng được.

**`roleId` không thuộc phạm vi Authentication** — đã được định nghĩa ở `permission.md` (Data Model của Permission). Authentication chỉ **đọc** `roleId` để đưa vào payload JWT, không sở hữu field này.

**Không tạo bảng `RefreshToken`/session riêng ở V1** — JWT tự chứa thời hạn (`exp`), hết hạn thì phải đăng nhập lại. Xem "Không làm trong V1".

---

# Login Flow

```http
POST /auth/login

{ "email": "...", "password": "..." }
```

```text
Nhận email + password
    ↓
Tìm User theo email
    ↓
User có tồn tại và isActive = true?
    ↓ Không                     ↓ Có
Từ chối                    So khớp password với passwordHash (bcrypt.compare)
                                 ↓ Sai                    ↓ Đúng
                            Từ chối              Phát hành JWT
                                                       ↓
                                                  Cập nhật lastLoginAt, lastLoginIp
                                                       ↓
                                                  Trả về { accessToken, user }
```

Không phân biệt lỗi "email không tồn tại" và "sai mật khẩu" trong thông báo trả về (tránh lộ thông tin email nào đã đăng ký).

---

# Token

JWT chứa tối thiểu:

```text
sub       (userId)
roleId
exp       (thời điểm hết hạn)
```

**Thời hạn JWT đọc từ `Settings.Security.sessionTimeout`** (đã có sẵn trong `setting.md`) — không hard-code số phút. Đây là điểm Authentication phụ thuộc Settings module.

Client gửi kèm mỗi request sau:

```http
Authorization: Bearer <accessToken>
```

**Không có Refresh Token ở V1.** Hết hạn thì phải đăng nhập lại — đơn giản, đủ dùng cho V1. Xem "Không làm trong V1" nếu cần trải nghiệm mượt hơn ở V2.

---

# Logout

V1: **stateless** — không có danh sách token bị thu hồi (blacklist) ở server. Client tự xoá token đang lưu (localStorage/cookie). Token cũ vẫn "hợp lệ về mặt kỹ thuật" cho tới khi hết hạn tự nhiên, nhưng không còn được client gửi kèm nữa.

Nếu sau này cần thu hồi tức thời (vd nhân viên nghỉ việc giữa ca), đó là nhu cầu Loại 2 — cần bảng blacklist/refresh token, để dành V2 (xem "Không làm trong V1").

---

# Đổi mật khẩu

```http
POST /auth/change-password

{ "oldPassword": "...", "newPassword": "..." }
```

Yêu cầu: `oldPassword` phải khớp `passwordHash` hiện tại. Không cho đổi mật khẩu người khác qua API này (chỉ tự đổi cho chính mình). Đổi thành công → `mustChangePassword = false`.

## Bắt buộc đổi mật khẩu lần đầu

`Settings.Security.forceChangePasswordOnFirstLogin` (đã có sẵn trong `setting.md`) là công tắc **toàn hệ thống**, quyết định: khi tạo User mới/reset mật khẩu (`AuthService.setTemporaryPassword()`), có set `mustChangePassword = true` hay không. `mustChangePassword` mới là field **theo từng User** thực sự được kiểm tra ở Login Flow/FE để ép đổi mật khẩu ngay sau lần đăng nhập đầu tiên, trước khi dùng được các chức năng khác.

---

# Quan hệ với Permission — ai tạo User, mật khẩu từ đâu

**CRUD User (`POST /users`, `GET /users`, `PATCH /users/:id`...) không thuộc Authentication — thuộc Permission module** (nơi đã sở hữu `Role`, việc tạo User luôn đi kèm gán `roleId` nên hai việc này nằm chung một chỗ hợp lý hơn). Xem `permission.md` mục "Quản lý User".

**Luồng đặt mật khẩu — nhân viên tự đặt mật khẩu thật, Owner không biết:**

```text
Owner tạo User (qua Permission module)
    ↓ nhập: email, tên hiển thị, gán Role
    ↓ hệ thống tự sinh mật khẩu tạm (hoặc Owner đặt 1 mật khẩu tạm chung, báo miệng cho nhân viên)
    ↓
Nhân viên đăng nhập lần đầu bằng mật khẩu tạm
    ↓
forceChangePasswordOnFirstLogin = true → bắt buộc đổi mật khẩu ngay
    ↓
Nhân viên tự đặt mật khẩu thật — chỉ nhân viên đó biết, Owner không còn biết nữa
```

Việc tạo User (ở Permission module) khi cần đặt mật khẩu tạm sẽ **gọi qua một method của Authentication** (vd `AuthService.setTemporaryPassword(userId)`) để xử lý hash — không tự viết lại logic hash mật khẩu ở Permission, đúng pattern Module Ownership đã dùng nhất quán trong dự án.

**Không xoá User — chỉ vô hiệu hoá (`isActive = false`)**, thực hiện ở Permission module. Cùng nguyên tắc "không xoá, chỉ chuyển trạng thái" đã áp dụng xuyên suốt dự án (Role, Payment, RecoveryInventory...) — `User.id` còn được tham chiếu ở rất nhiều nơi (`createdBy`, `receivedBy`, actor của các Timeline...), xoá sẽ phá vỡ lịch sử.

User bị `isActive = false` không đăng nhập được (chặn ngay ở Login Flow, do Authentication kiểm tra).

---

# Quên mật khẩu

**Không triển khai ở V1.** Gửi email reset cần có Email Provider thật — hiện `Notification Settings` (V1) chỉ dừng ở bật/tắt, chưa triển khai gửi thật (xem `setting.md`). Nếu quên mật khẩu, Admin/Owner reset thủ công cho User qua `PATCH /users/:id` (đặt mật khẩu tạm mới, kèm `forceChangePasswordOnFirstLogin`).

Để V2 khi có Notification Provider thật.

---

# Validation

- Email unique (đã ràng buộc sẵn ở `User.email`).
- Password tối thiểu độ dài (vd 6 ký tự) — V1 không yêu cầu policy phức tạp (chữ hoa/số/ký tự đặc biệt).
- Không đăng nhập được nếu `isActive = false`.
- Không đổi mật khẩu nếu `oldPassword` sai.

---

# Business Rule

- Authentication không quyết định quyền hạn — đó là việc của Permission.
- Password luôn lưu dạng hash (bcrypt), không bao giờ lưu/trả về plaintext, không log ra ngoài.
- JWT hết hạn theo `Settings.Security.sessionTimeout`, không hard-code.
- Không có đăng ký công khai — chỉ Admin/Owner tạo User (qua Permission module).
- Email là Username duy nhất — không hỗ trợ Username riêng.
- Không xoá User — chỉ `isActive = false` (thực hiện ở Permission module).
- User bị vô hiệu hoá không đăng nhập được.
- CRUD User thuộc Permission module, không thuộc Authentication.
- `mustChangePassword` (theo từng User) bật khi đặt mật khẩu tạm, tắt khi tự đổi thành công — quyết định ban đầu tuân theo `Settings.Security.forceChangePasswordOnFirstLogin`.
- Không triển khai Quên mật khẩu qua email ở V1 — Admin reset thủ công.

---

# Không làm trong V1

Không triển khai:

- Refresh Token / Token Revoke List (thu hồi token tức thời)
- Quên mật khẩu qua Email
- OAuth / Google Login / Microsoft Login / SSO
- 2FA
- Rate limiting / khoá tài khoản sau N lần đăng nhập sai
- Quản lý nhiều phiên đăng nhập đồng thời (multi-device session)
- Password History (chưa cấm đổi mật khẩu quay lại giá trị cũ)

Đây sẽ là V2 — nhất quán với "Future Policies" đã liệt ở `setting.md` (Security Settings mục V2: 2FA, IP Whitelist, OAuth, SSO).

---

# Module Dependencies

## Phụ thuộc

- Settings (đọc `sessionTimeout`, `forceChangePasswordOnFirstLogin`)

## Module bị ảnh hưởng

- `User` model (thêm `passwordHash`, `isActive`, `lastLoginAt`, `lastLoginIp`)
- Permission — theo 2 chiều:
  - Permission chạy ngay sau Authentication trong pipeline, đọc `roleId` đã có trong JWT.
  - Permission gọi ngược lại `AuthService.setTemporaryPassword()` khi tạo User mới (CRUD User thuộc Permission — xem "Quan hệ với Permission").
- Toàn bộ module nghiệp vụ khác — gián tiếp, thông qua Guard chạy trên mọi request

Không được thay đổi Business Rule của Permission hay bất kỳ module nghiệp vụ nào ngoài phạm vi đã thống nhất ở đây.

---

# Mục tiêu của Module

Authentication trả lời đúng một câu hỏi:

**"Anh là ai?"**

Permission (module riêng, chạy ngay sau) trả lời:

**"Anh được làm gì?"**

Business Module quyết định:

**"Có được thực hiện nghiệp vụ hay không?"**
