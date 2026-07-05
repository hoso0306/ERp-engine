# Module Cấu hình hệ thống (Settings)

> **Tên file:** `knowledge/modules/setting.md`

---

# Mục đích

Quản lý toàn bộ cấu hình dùng chung của hệ thống ERP.

Module này không chứa dữ liệu nghiệp vụ.

Module chỉ quản lý:

- Thông tin doanh nghiệp
- Running Number (prefix/padding, không có reset policy ở V1)
- Cấu hình Dashboard
- Cấu hình tài liệu in ấn (điều khoản mặc định)
- Cấu hình Notification
- Security cơ bản
- Backup (chuẩn bị cấu trúc, chi tiết để V2)

Mục tiêu:

Cho phép thay đổi cách vận hành ERP mà không cần sửa code — **chỉ với các giá trị không ảnh hưởng kiến trúc**. Xem "Phân loại cấu hình" bên dưới để biết ranh giới.

---

# Vai trò trong ERP

Settings là trung tâm cấu hình của toàn bộ hệ thống.

Tất cả Module khác đều có thể đọc Settings.

Ví dụ:

- Debt đọc số ngày sắp đến hạn (`upcomingDueDays`)
- Dashboard đọc số lượng Top hiển thị
- Quotation/SalesOrder đọc thông tin công ty + điều khoản mặc định khi in

Settings không được gọi ngược vào các Module nghiệp vụ.

---

# Triết lý thiết kế

Settings chỉ lưu:

- Cấu hình
- Chính sách hiển thị/thông báo
- Giá trị mặc định (số, chuỗi, bật/tắt)

Không lưu:

- Dữ liệu nghiệp vụ
- Báo cáo
- Chứng từ
- Transaction

---

# Phân loại cấu hình — ranh giới quan trọng nhất của Module này

Có 2 loại giá trị nhìn giống nhau là "cấu hình có thể đổi", nhưng bản chất khác hẳn nhau:

## Loại 1 — Chính sách doanh nghiệp (đưa vào Settings)

Giá trị đơn thuần, đổi được mà **không ảnh hưởng Transaction Boundary / Snapshot / Workflow / Validation** của module khác.

Ví dụ: số ngày cảnh báo công nợ, Top khách hàng hiển thị trên Dashboard, nội dung điều khoản mặc định khi in báo giá, bật/tắt một loại thông báo, prefix chứng từ.

## Loại 2 — Kiến trúc hệ thống (KHÔNG đưa vào Settings)

Nhìn giống "bật/tắt được", nhưng thực chất là **quyết định kiến trúc đã thống nhất và đã ship** — nếu cho phép bật/tắt runtime sẽ phá vỡ Transaction Boundary, Snapshot, hoặc Workflow đã xây dựng cẩn thận ở module khác.

Ví dụ: cho phép âm kho, cho phép Start Production khi thiếu vật tư, chính sách chặn/không chặn khi vượt hạn mức công nợ.

**V1 không triển khai bất kỳ giá trị Loại 2 nào** — chỉ ghi nhận định hướng ở mục "Future Policies (V2)" cuối tài liệu. Nếu phát hiện thêm một giá trị đang hard-code có khả năng thay đổi theo doanh nghiệp, phải xác định nó thuộc Loại 1 hay Loại 2 rồi mới quyết định có đưa vào Settings hay không — không mặc định đưa hết vào.

---

# Nhóm cấu hình (V1)

## 1. Company Settings

Thông tin doanh nghiệp — dùng cho Báo giá, Đơn hàng, Phiếu nhập, Phiếu xuất, in ấn.

```text
companyName
logo
address
phone
email
website
taxCode
currency          // vd "VND" — chỉ là nhãn hiển thị
currencySymbol    // vd "₫"
timezone          // vd "Asia/Ho_Chi_Minh"
```

**`currency`/`currencySymbol` chỉ là nhãn hiển thị (label), không phải công tắc chức năng đa tiền tệ.** Toàn bộ field tiền trong schema hiện là `Decimal(15, 0)` — không có phần thập phân, hệ thống đã cam kết kiến trúc chỉ dùng VND. Hai field này chỉ để tránh hard-code chuỗi "₫"/"VND" rải rác ở PDF/Report/Dashboard, không cho phép tự quy đổi tỷ giá hay tính toán đa tiền tệ.

`timezone` dùng chung cho Notification, Backup schedule, và các cron job sau này — không phải hệ thống đa múi giờ, chỉ để tránh hard-code `GMT+7` rải rác.

## 2. Running Number

Quản lý mã chứng từ.

```text
BG000001  (Quotation)
SO000001  (SalesOrder)
PO000001  (ProductionOrder)
PN000001  (MaterialReceipt)
PT000001  (Payment)
```

Mỗi loại gồm:

```text
prefix
padding
currentNumber
enabled     // chỉ ẩn/hiện khỏi menu — không chặn tạo chứng từ
```

**`enabled` chỉ có tác dụng ẩn loại chứng từ khỏi menu/UI.** Không dùng để chặn tạo chứng từ, vì một số chứng từ (vd `Receivable`) được ERP sinh tự động, vô điều kiện từ module khác (`Quotation.approve()`) — tắt `enabled` của `PT` (Payment) không ngăn được Receivable phát sinh, nên không thể dùng field này để "tắt hẳn một module nghiệp vụ". Muốn tắt cả một module là quyết định Loại 2 — xem "Future Policies".

**Không có `resetPolicy` ở V1** (reset theo năm/tháng). Lý do: hiện mỗi module đang tự inline `runningNumber.update({ lastNumber: increment: 1 })` rải rác ở nhiều file (Quotation, SalesOrder, ProductionOrder, Payment, Customer, Material...) — muốn có reset-theo-kỳ phải gom về một `NumberService` dùng chung trước, rồi sửa lại toàn bộ các nơi đó. Đây là refactor cross-cutting lớn hơn nhiều so với một field cấu hình đơn thuần — để dành khi thật sự cần.

## 3. Dashboard Settings

Cấu hình hiển thị Dashboard.

```text
topCustomers
topMaterials
topProducts
defaultDashboardPeriod
upcomingDueDays
```

`upcomingDueDays` dùng chung cho cả Dashboard lẫn `DebtService.getUpcomingDueReceivables()` — chỉ khai báo **một nơi duy nhất** ở đây (không lặp lại ở nhóm khác).

Dashboard chỉ đọc các giá trị này, không lưu dữ liệu Dashboard.

## 4. Notification Settings

Bật/Tắt thông báo. V1 chỉ bật/tắt, chưa cấu hình kênh gửi (email/SMS/Zalo... xem "Future Policies").

```text
notifyOverdueDebt
notifyCreditLimitExceeded
notifyLowStock
notifyProductionCompleted
notifyOrderDelivered
```

## 5. Document Settings (in ấn)

**Chỉ một giá trị mới ở V1:**

```text
quotationDefaultTerms   // Điều khoản mặc định, in cuối Báo giá
```

**Không lưu trùng Logo/tên công ty/địa chỉ/SĐT ở đây** — khi in (Báo giá, Đơn hàng, Phiếu nhập, Phiếu xuất), Header/Footer đọc thẳng từ **Company Settings** (mục 1), không tạo bản sao dữ liệu riêng cho "PDF Settings".

**Ghi chú xác nhận nhu cầu thật:** trang in báo giá hiện tại (`apps/web/src/app/quotations/[id]/print/page.tsx`) đang hard-code `{/* Company info placeholder */}` với nội dung giả `CÔNG TY TNHH ERP ENGINE | Tel: 0900 000 000` — khi Settings module hoàn thành, trang này cần sửa để đọc Company Settings thật (xem "Module Dependencies").

Màu thương hiệu, Font, và các tuỳ biến hiển thị khác — chưa có nhu cầu cụ thể (V1 chỉ có một mẫu in đơn giản, không phải hệ thống theming đa khách hàng) — để ở "Future Policies".

## 6. Security Settings

Quản lý bảo mật cơ bản.

```text
sessionTimeout
forceChangePasswordOnFirstLogin
```

V2 sẽ mở rộng: 2FA, IP Whitelist, OAuth, SSO.

## 7. Backup Settings

Chuẩn bị cấu trúc cho V2, chưa triển khai chi tiết ở V1.

```text
autoBackup
backupSchedule
retentionDays
backupProvider   // Google Drive / NAS / S3
```

---

# Dữ liệu quản lý

## Company

```text
companyName
logo
address
phone
email
website
taxCode
```

Một dòng duy nhất (singleton).

## RunningNumber

Đã tồn tại từ trước (dùng chung bởi mọi module tạo mã chứng từ):

```text
type
prefix
lastNumber
paddingLength
```

**Mỗi `RunningNumberType` chỉ tồn tại đúng một bản ghi** (singleton theo `type` — đã ràng buộc sẵn bằng `type String @unique` trong schema hiện tại):

```text
QUOTATION
    prefix = BG
    lastNumber = 126

SALES_ORDER
    prefix = SO
    lastNumber = 45
```

Không tạo nhiều record cho cùng một loại chứng từ.

Không cần schema mới — Settings chỉ cung cấp giao diện đọc/sửa `prefix`/`paddingLength` cho bảng đã có.

## Setting (key-value, cho các nhóm còn lại)

Dùng một bảng key-value chung cho Dashboard/Notification/Document/Security Settings — tránh tạo nhiều bảng nhỏ lẻ cho từng nhóm khi số lượng giá trị còn ít:

```text
module        // "Dashboard" | "Notification" | "Document" | "Security"
key           // "upcomingDueDays", "notifyLowStock", "quotationDefaultTerms"...
value
defaultValue  // giá trị gốc, phục vụ "Restore Default"
valueType     // BOOLEAN | NUMBER | STRING | TEXT — để FE render đúng input, không phải đoán
description
```

**`Unique(module, key)`** — mỗi cặp module+key chỉ tồn tại đúng một dòng (vd `Dashboard.upcomingDueDays` chỉ có một bản ghi duy nhất). Phải khai báo ngay từ migration đầu tiên — nếu không, code đọc Settings sẽ phải dùng `findFirst()` thay vì `findUnique()`, dễ sinh lỗi trùng dòng khó phát hiện về sau.

Ví dụ:

```text
module: Dashboard
key: upcomingDueDays
value: 7
defaultValue: 7
valueType: NUMBER
```

```text
module: Notification
key: notifyLowStock
value: true
defaultValue: true
valueType: BOOLEAN
```

```text
module: Document
key: quotationDefaultTerms
value: "Báo giá có hiệu lực trong thời gian ghi trên phiếu..."
defaultValue: ""
valueType: TEXT
```

---

# Quy tắc sử dụng

Các Module chỉ được đọc **giá trị Loại 1** từ Settings, không hard-code.

Ví dụ:

```text
Debt.getUpcomingDueReceivables()
    ↓
Settings.Dashboard.upcomingDueDays  (thay vì mặc định cứng = 7 trong code)
```

```text
Quotation/SalesOrder print
    ↓
Settings.Company.*  +  Settings.Document.quotationDefaultTerms
```

**Không áp dụng quy tắc này cho giá trị Loại 2** (xem "Future Policies") — các giá trị đó vẫn giữ nguyên hard-code như đã ship, không đọc từ Settings.

---

# Validation

Không cho phép:

- Xoá Company Settings
- Xoá Running Number (chỉ sửa `prefix`/`paddingLength`)
- Xoá Setting (key-value) đã tồn tại

Chỉ cho phép:

- Cập nhật giá trị

---

# Dashboard Rule

Dashboard chỉ đọc:

```text
topCustomers
topProducts
topMaterials
defaultDashboardPeriod
upcomingDueDays
```

Không lưu dữ liệu Dashboard trong Settings.

---

# Module Dependencies

## Phụ thuộc

Settings không phụ thuộc Module nghiệp vụ nào.

## Module bị ảnh hưởng (cần sửa để đọc Settings thay vì hard-code)

- **Debt module**: `DebtService.getUpcomingDueReceivables(days = 7)` — sửa để đọc `Settings.Dashboard.upcomingDueDays` thay vì tham số mặc định cứng.
- **Quotation/SalesOrder (frontend print)**: `apps/web/.../quotations/[id]/print/page.tsx` — sửa để đọc `Settings.Company.*` và `Settings.Document.quotationDefaultTerms` thay vì placeholder hard-code.
- Dashboard, Notification — đọc các giá trị tương ứng ở mục "Nhóm cấu hình".
- **Script Backup** (`scripts/backup/` — đã có sẵn trong repo, không phải business module trong `03-danh-sach-module.md`): đọc `backupProvider`/`retentionDays`/`backupSchedule` từ nhóm "Backup Settings".

Settings **không được thay đổi** Business Rule, Data Model, hay Workflow của các Module trên ngoài việc đọc giá trị Loại 1 đã liệt kê.

---

# Business Rule

- Settings là nguồn cấu hình duy nhất cho **giá trị Loại 1**.
- Không đưa giá trị Loại 2 (Business Architecture) vào Settings — xem "Phân loại cấu hình".
- Mỗi cấu hình phải có đúng một nơi quản lý (vd `upcomingDueDays` chỉ khai báo ở nhóm Dashboard, không lặp lại ở nơi khác).
- Module chỉ được đọc Settings, không tự lưu bản sao (vd trang in không lưu riêng tên công ty).
- Thay đổi Settings chỉ ảnh hưởng nghiệp vụ phát sinh sau đó, không làm thay đổi dữ liệu Snapshot đã tạo trước đó.
- **Settings chỉ ảnh hưởng các nghiệp vụ phát sinh sau thời điểm thay đổi.** Không hồi tố về trước.

---

# Quan hệ dữ liệu

```text
                Settings (Loại 1)
                     │
      ┌──────────────┼──────────────┐
      │              │              │
  Quotation/SO    Dashboard        Debt
  (print)
```

---

# Future Policies (V2)

Các ý tưởng "Business Rule" từng được đề xuất đưa vào Settings, nhưng đã xác định là **Loại 2 (Kiến trúc hệ thống)** — không triển khai ở V1 vì sẽ phá vỡ Transaction Boundary/Snapshot/Workflow/Validation đã ổn định ở Warehouse, Production, Quotation, Debt. Giữ lại ở đây để **ghi nhớ định hướng**, không phải để triển khai ngay, nhóm theo module ảnh hưởng:

**Sales / Quotation**
- `quotationExpiryDays` — số ngày hiệu lực mặc định của báo giá.
- `allowEditQuotationAfterSent` — bật/tắt cho sửa báo giá đã gửi.
- `allowApproveExpiredQuotation` — bật/tắt cho duyệt báo giá đã hết hạn.

**Warehouse**
- `allowNegativeStock` — đối lập trực tiếp với rule "không cho phép âm kho, thực thi bằng transaction boundary" đã ship.

**Production**
- `allowStartWithoutMaterial`, `allowCompleteWithoutMaterial` — đối lập trực tiếp với Transaction Boundary Start Production ↔ Warehouse đã ship.
- `allowManualProductionOrder` — đối lập với rule "Production Order chỉ được sinh từ Sales Order".

**Debt**
- `creditLimitPolicy` (WARNING / BLOCK_ORDER / BLOCK_APPROVE) — nơi tự nhiên nhất để hiện thực hoá "V2" đã chừa sẵn trong `debt.md`.

**Chưa gắn với module cụ thể**
- Chính sách Workflow tổng quát (chưa xác định cụ thể).
- **File Storage Settings** (Local/S3/Cloudflare R2/Google Drive) — hiện toàn bộ hệ thống chưa có bất kỳ tính năng upload/lưu file nào (kể cả ảnh sản phẩm), chưa có nhu cầu thật.
- **PDF theming** (màu thương hiệu, font tuỳ biến) — chưa có nhu cầu cụ thể, khác với "Điều khoản mặc định" đã đưa vào V1 (mục 5).
- **Integrations** (Telegram, Zalo, Email, Webhook) — chuẩn bị tích hợp, không triển khai V1.

Khi có nhu cầu thực tế phát sinh cho bất kỳ mục nào ở trên, quay lại thiết kế riêng cho mục đó — không bật một cấu hình chung chung cho tất cả.

---

# Ghi chú

Settings là trung tâm cấu hình của ERP, nhưng chỉ cho **giá trị Loại 1**.

Nếu phát hiện một giá trị đang hard-code có khả năng thay đổi theo doanh nghiệp, phải dừng và xác định: đây là Loại 1 (đưa vào Settings) hay Loại 2 (ghi vào "Future Policies", không triển khai) — trước khi quyết định có đưa vào Settings hay không.
