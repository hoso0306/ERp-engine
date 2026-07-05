# Sprint 01 — Module Cài đặt hệ thống

> **Tên file:** `workbench/sprint-01/010-cai-dat.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Settings theo kiến trúc đã thống nhất.

Module này không quản lý dữ liệu nghiệp vụ.

Module chỉ quản lý:

- Company Settings
- Running Number
- Dashboard Settings
- Notification Settings
- Document Settings
- Security Settings
- Backup Settings

Không triển khai Future Policies trong Sprint này.

Đọc kỹ `knowledge/modules/setting.md` trước khi bắt đầu — mọi quyết định thiết kế đã chốt ở đó.

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Settings.

Bao gồm:

- Tạo mới model `Company` (Singleton) — **model này chưa tồn tại trong schema hiện tại**, không phải bổ sung field.
- Tạo bảng `Setting`
- Thêm field `enabled` vào `RunningNumber` (đã tồn tại, chỉ thêm field mới)
- Đồng bộ Prisma Schema
- Đồng bộ ERD

---

## Models cần tạo

### Company (mới hoàn toàn)

```text
companyName
logo
address
phone
email
website
taxCode
currency
currencySymbol
timezone
```

Singleton — chỉ một bản ghi duy nhất.

**Seed 1 bản ghi mặc định ngay trong migration/seed** — không để FE tự tạo Company lần đầu.

### Setting

```text
module
key
value
defaultValue
valueType
description
```

Unique:

```text
(module, key)
```

---

## RunningNumber

Không tạo model mới — chỉ thêm field vào model đã có:

```text
enabled   Boolean   @default(true)
```

`enabled` chỉ ẩn/hiện loại chứng từ khỏi menu — không chặn tạo chứng từ (xem `setting.md`).

Đảm bảo các field hiện có vẫn nguyên vẹn:

```text
prefix
paddingLength
lastNumber
```

---

## Definition of Done

- [x] Tạo model `Company` (toàn bộ field ở trên).
- [x] Seed thành công 1 `Company` mặc định.
- [x] Tạo bảng `Setting`.
- [x] Unique(module, key).
- [x] Thêm field `enabled` vào `RunningNumber` (`@default(true)`).
- [x] Migration chạy thành công.
- [x] Prisma Schema đồng bộ.
- [x] ERD đồng bộ.

---

# Task 01 — Company Settings

## Mục tiêu

Quản lý thông tin doanh nghiệp.

Bao gồm:

- Xem
- Cập nhật

Không cho phép Create. Không cho phép Delete. Company là Singleton.

---

## API

```http
GET /settings/company
PUT /settings/company
```

---

## Definition of Done

- [x] GET Company — luôn trả về đúng 1 bản ghi (nhờ đã seed ở Task 00).
- [x] UPDATE Company.
- [x] Không Create.
- [x] Không Delete.
- [x] Singleton hoạt động đúng.

---

# Task 02 — Running Number

## Mục tiêu

Quản lý Running Number.

Cho phép sửa:

- Prefix
- Padding Length
- Enabled

Không cho phép sửa:

- Last Number

Không cho phép Reset.

---

## API

```http
GET /settings/running-numbers
PUT /settings/running-numbers/:type
```

---

## Definition of Done

- [x] Danh sách Running Number.
- [x] Sửa Prefix.
- [x] Sửa Padding.
- [x] Sửa Enabled.
- [x] Không sửa Last Number.
- [x] Không Reset Number.

---

# Task 03 — Settings Engine

## Mục tiêu

Xây dựng `SettingService` — engine đọc/ghi chung cho bảng `Setting` (key-value), phục vụ Dashboard/Notification/Document/Security Settings.

**Đây là task duy nhất tạo API mới cho nhóm key-value.** Task 04-07 chỉ seed dữ liệu và refactor module khác để gọi qua `SettingService` này — không tạo thêm API riêng.

Không tạo bảng riêng cho từng nhóm.

---

## API

```http
GET /settings
GET /settings/:module
PUT /settings/:module
```

---

## Definition of Done

- [x] `SettingService` hoạt động (CRUD key-value qua `GET`/`PUT`).
- [x] Unique(module, key) được validate.
- [x] **`SettingService` được dùng chung bởi toàn bộ module khác** — không để `DashboardService`/`DebtService`/trang Print tự query bảng `Setting` trực tiếp.
- [x] Lưu theo Key-Value đúng cấu trúc `module/key/value/defaultValue/valueType/description`.

---

# Task 04 — Dashboard Settings Integration

## Mục tiêu

**Không tạo API mới** (đã có ở Task 03). Chỉ seed dữ liệu và refactor các module đang hard-code để đọc qua `SettingService`.

Seed các key:

```text
topCustomers
topProducts
topMaterials
defaultDashboardPeriod
upcomingDueDays
```

**Đây là thay đổi chạm vào code Debt module đã ship** (cùng pattern đã dùng ở các sprint trước: Production sửa SalesOrder, Warehouse sửa Production, Debt sửa SalesOrder): `DebtService.getUpcomingDueReceivables(days = 7)` phải sửa để đọc `Settings.Dashboard.upcomingDueDays` qua `SettingService`, thay vì dùng tham số mặc định cứng `= 7`.

---

## Definition of Done

- [x] Seed đủ 5 key ở trên, đúng `valueType`/`defaultValue`.
- [x] Dashboard đọc qua `SettingService`, không hard-code.
- [x] **`DebtService.getUpcomingDueReceivables()` đọc `upcomingDueDays` từ `SettingService`** thay vì tham số mặc định cứng.
- [x] Không tạo API mới.

---

# Task 05 — Notification Settings Integration

## Mục tiêu

**Không tạo API mới.** Seed dữ liệu cho nhóm Notification.

Seed các key (V1 chỉ bật/tắt, chưa triển khai gửi thật):

```text
notifyOverdueDebt
notifyCreditLimitExceeded
notifyLowStock
notifyProductionCompleted
notifyOrderDelivered
```

---

## Definition of Done

- [x] Seed đủ 5 key ở trên, `valueType = BOOLEAN`.
- [x] Chỉ bật/tắt qua `SettingService`.
- [x] Không triển khai Provider gửi thông báo.
- [x] Không tạo API mới.

---

# Task 06 — Document Settings Integration

## Mục tiêu

**Không tạo API mới.** Seed `quotationDefaultTerms` và refactor trang in Báo giá.

**Đây là thay đổi chạm vào Quotation Print (frontend) đã ship**: `apps/web/src/app/quotations/[id]/print/page.tsx` hiện đang hard-code placeholder (`{/* Company info placeholder */}` — "CÔNG TY TNHH ERP ENGINE | Tel: 0900 000 000"). Phải sửa để đọc `Settings.Company.*` (Task 01) và `Settings.Document.quotationDefaultTerms` qua `SettingService`.

---

## Definition of Done

- [x] Seed `quotationDefaultTerms` (`valueType = TEXT`).
- [x] Trang in Báo giá đọc Company Settings + `quotationDefaultTerms` qua `SettingService`, không còn placeholder hard-code.
- [x] Không tạo API mới.

---

# Task 07 — Security & Backup Settings Integration

## Mục tiêu

**Không tạo API mới.** Seed cấu hình Security và Backup — V1 chỉ lưu cấu hình, không triển khai Backup Engine thật.

Security:

```text
sessionTimeout
forceChangePasswordOnFirstLogin
```

Backup:

```text
autoBackup
backupSchedule
retentionDays
backupProvider
```

---

## Definition of Done

- [x] Seed đủ Security Settings.
- [x] Seed đủ Backup Settings.
- [x] Không triển khai Backup Engine thật.
- [x] Không tạo API mới.

---

# Task 08 — Validation

## Mục tiêu

Kiểm tra toàn bộ Module.

Bao gồm:

- Singleton Company
- Running Number (bao gồm `enabled`)
- Setting Key-Value
- Validation

---

## Definition of Done

- [x] Company chỉ có một bản ghi.
- [x] Unique(module, key).
- [x] `enabled` chỉ ẩn UI, không chặn tạo chứng từ.
- [x] Không Delete Company.
- [x] Không Delete Running Number.
- [x] Không Delete Setting.
- [x] Validation đầy đủ.

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- API
- Validation
- Schema
- Prisma
- ERD
- Knowledge

Đảm bảo đồng bộ:

- knowledge/modules/setting.md
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

Không phụ thuộc module nghiệp vụ.

## Module bị ảnh hưởng

- Dashboard
- Debt (`DebtService.getUpcomingDueReceivables()`)
- Quotation Print (frontend, chưa có Sales Order Print — thêm sau nếu phát sinh)
- Notification
- Backup Script

Các module trên chỉ được **đọc** Settings qua `SettingService`. Không được ghi trực tiếp vào Settings, không tự query bảng `Setting`.

---

# Commit Message

```text
feat(settings): implement system settings foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Báo cáo.

Sau đó dừng và chờ Task tiếp theo.
