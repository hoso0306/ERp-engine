# Milestone 01 (Sprint 02) - Cập nhật theo Architecture Review 05/07/2026

> **Tên file:** `workbench/sprint-02/001-cap-nhat-kien-truc.md`

---

# Mục tiêu

Triển khai toàn bộ thay đổi đã chốt ở đợt Architecture Review 05/07/2026 — tập trung tại `knowledge/project/erd.md` mục 19.

Gồm: một đợt migration schema duy nhất (field snapshot/reference + index), sửa các luồng đã chốt lại (Cancel đơn đã cọc, Pricing Version check, cấm Cancel Quotation Approved), và Action mới cho Return.

Sau khi hoàn thành, schema và code khớp 100% với tài liệu thiết kế đã cập nhật — sẵn sàng cho Module Báo cáo (`014` cũ, sẽ lập milestone riêng theo `knowledge/modules/report.md`).

---

# Phạm vi

Chỉ thực hiện đúng các thay đổi liệt kê trong ERD mục 19 và các tài liệu module đã cập nhật ngày 05/07/2026.

**Không** làm trong milestone này:

* Module Báo cáo (chỉ chuẩn bị schema/index cho nó).
* Warranty (`warrantyUntil`), Partial Unique Index phone, `Quotation.totalAmount`, check Customer ACTIVE — thuộc nhóm "trước Go-Live", milestone sau.
* Expression Engine, Adjustment API kho — Technical Debt, chưa làm.

Nếu phát hiện nghiệp vụ chưa rõ hoặc xung đột, phải dừng và hỏi người dùng trước khi tiếp tục.

---

# Tham chiếu

Trước khi thực hiện cần đọc:

* `.claude/CLAUDE.md` (đặc biệt mục 13 — đã cập nhật ngoại lệ `remainingAmount`)
* `knowledge/project/erd.md` — **mục 19** (danh sách thay đổi tập trung)
* `knowledge/modules/quotation.md` — Snapshot 2 mốc, Pricing Version check, cấm Cancel Approved
* `knowledge/modules/order.md` — mục "Huỷ đơn đã thu cọc"
* `knowledge/modules/debt.md` — luồng Cancel mới, Snapshot Rule Payment đã sửa
* `knowledge/modules/return.md` — Trạng thái Return mới
* `knowledge/modules/report.md` — chỉ mục "Thay đổi schema cần TRƯỚC khi triển khai Report"

Chỉ đọc thêm tài liệu khác nếu thật sự cần thiết.

---

# Quy trình làm việc

* Mỗi lần chỉ thực hiện **01 Task**.
* Hoàn thành xong Task thì dừng.
* Tóm tắt những gì đã thực hiện.
* Liệt kê các file đã tạo hoặc chỉnh sửa.
* Đề xuất Commit Message.
* Chờ Task tiếp theo.

---

# Task 00 - Migration schema (một đợt duy nhất)

## Mục tiêu

Toàn bộ thay đổi schema của ERD mục 19 trong **một migration**, kèm backfill dữ liệu hiện có.

## Nội dung

**QuotationItem:**

* Thêm `productCode String`, `productName String` (snapshot).
* Backfill: join qua `productId` → `Product.code/name`, chạy một lần trong migration.

**Return:**

* Thêm enum `ReturnStatus` (`PROCESSING`, `COMPLETED`) + field `status ReturnStatus @default(PROCESSING)`.
* Backfill: bản ghi hiện có set `COMPLETED` (nghiệp vụ đã kết thúc trước khi có trạng thái).

**SalesOrderItem:**

* Thêm `productId String`, `productTypeId String`, `productTypeName String` (Redundant Reference + snapshot — xem `report.md`).
* Backfill: join theo `productCode` → `Product` một lần duy nhất trong migration (ghi chú rõ trong migration là backfill một lần, không phải logic runtime).

**SalesOrder:**

* Thêm `ownerId String?` (FK → `users`). `ownerName` giữ nguyên làm snapshot hiển thị.
* Không backfill `ownerId` (dữ liệu cũ không xác định được — để NULL).

**Index:**

* `SalesOrder @@index([createdAt])`
* `Payment @@index([paymentDate])`
* `Return @@index([returnDate])`
* `MaterialReceipt @@index([createdAt])`
* `SalesOrderItem @@index([productId])`, `@@index([productTypeId])`

### Definition of Done

* [x] `schema.prisma` cập nhật đủ các field/enum/index trên, đúng convention đặt tên hiện có (`@map`, snake_case cột).
* [x] Một migration duy nhất (`20260706044014_architecture_review_snapshots_return_status_indexes`), chạy thành công trên DB dev có dữ liệu.
* [x] Backfill kiểm chứng: không còn `QuotationItem` thiếu `productCode/productName`; không còn `SalesOrderItem` thiếu `productId/productTypeId`; Return cũ = `COMPLETED` (bảng hiện rỗng — backfill no-op hợp lệ).
* [x] Build thành công, seed chạy được (108/108 unit test pass).
* [x] Cập nhật sơ đồ mermaid trong `erd.md` (thêm field mới vào QuotationItem/SalesOrderItem/Return/SalesOrder).

**Commit**

```text
feat(schema): architecture review migration - snapshots, return status, date indexes
```

---

# Task 01 - Quotation snapshot mã/tên sản phẩm

## Mục tiêu

`QuotationItem` snapshot `productCode`/`productName` tại thời điểm thêm/sửa dòng; hiển thị và in báo giá đọc từ snapshot, không đọc lại Product.

## Nội dung

* API thêm/sửa dòng báo giá: copy `Product.code/name` vào `QuotationItem` (cùng chỗ đang tính `systemPrice`).
* Toàn bộ chỗ hiển thị dòng báo giá (danh sách, chi tiết, trang in `quotations/[id]/print`) đổi sang đọc snapshot — rà cả FE lẫn API response.
* `productId` giữ nguyên, chỉ dùng điều hướng.

### Definition of Done

* [x] Thêm/sửa dòng → snapshot ghi đúng (verify sống 06/07).
* [x] Đổi tên Product sau khi báo giá Approved → báo giá hiển thị/in vẫn giữ tên cũ (verify sống).
* [x] Build thành công (API + web).

**Commit**

```text
feat(quotation): snapshot product code/name on quotation item
```

---

# Task 02 - Pricing Version check khi Approve + Action "Tính lại giá"

## Mục tiêu

Approve bị chặn nếu giá của bất kỳ dòng nào được tính bằng Pricing Rule Version không còn ACTIVE. Người dùng chủ động tính lại — không recalc âm thầm. Xem `quotation.md` mục "Khi Pricing Rule đổi version giữa chừng".

## Nội dung

* `approve()`: thêm validation so sánh `QuotationItem.pricingRuleVersionId` với version ACTIVE hiện tại của từng Product. Lệch → throw lỗi liệt kê rõ các dòng bị lệch.
* Endpoint mới `POST /quotations/:id/recalculate-prices` (Action, đúng quy ước Workflow Engine): tính lại `systemPrice` toàn bộ dòng bằng version ACTIVE hiện tại, cập nhật `pricingRuleVersionId`, tính lại `finalPrice`/`subtotal`. Chỉ chạy được ở `Draft`/`Sent`.
* FE: khi Approve bị chặn vì lý do này, hiển thị thông báo + nút "Tính lại giá"; sau khi tính lại, hiển thị chênh lệch giá cũ/mới để người dùng quyết định gửi lại khách.
* Đồng thời enforce rule đã chốt: **không Cancel Quotation có `salesOrderId`** (kể cả Manual Override) — kiểm tra và chặn ở `cancel()`/override nếu code hiện tại chưa chặn.

### Definition of Done

* [x] Approve chặn đúng khi version lệch, thông báo nêu rõ dòng nào (`errorCode: PRICING_VERSION_STALE` + `staleItems`).
* [x] `recalculate-prices` hoạt động, ghi Timeline — đã hỏi và chốt với người dùng (06/07): dùng `QUOTATION_MANUAL_OVERRIDE` sẵn có + `payload.action = "RECALCULATE_PRICES"`, không thêm enum mới.
* [x] Approve lại thành công sau khi tính lại (verify sống).
* [x] Cancel Quotation Approved bị chặn (verify sống — chặn cả `cancel()` lẫn Manual Override).
* [x] Build thành công.

**Commit**

```text
feat(quotation): block approve on stale pricing version + recalculate action
```

---

# Task 03 - Snapshot mở rộng khi Approve (SalesOrderItem + ownerId)

## Mục tiêu

`Quotation.approve()` snapshot thêm các field mới vào Sales Order để phục vụ Báo cáo (xem `report.md`).

## Nội dung

* Khi sinh `SalesOrderItem`: set `productId`, `productTypeId`, `productTypeName` (copy từ Product đang duyệt — cùng chỗ đang copy `productCode`/`productName`).
* Khi sinh `SalesOrder`: set `ownerId` = **người tạo báo giá** (`Quotation.createdBy` — field đã có sẵn trong schema, được ghi tự động lúc tạo báo giá), `ownerName` = tên hiển thị của user đó.

**Quyết định đã chốt với người dùng (05/07/2026):** người lên báo giá là người phụ trách khách đó — đơn hàng tính doanh số cho người tạo báo giá, không phải người bấm Approve. Không cần field mới (`Quotation.createdBy` có sẵn).

* Đảm bảo `Quotation.createdBy` được set từ JWT ở API tạo báo giá (kiểm tra — nếu code hiện tại chưa set thì bổ sung trong task này).
* Fallback: nếu `createdBy` NULL (báo giá tạo trước khi có Auth) → dùng user bấm Approve.

### Definition of Done

* [x] Approve mới → SalesOrderItem/SalesOrder có đủ field mới, giá trị đúng (verify sống: `ownerId` = người tạo báo giá, `ownerName`, `productTypeId/Name`).
* [x] Không đọc lại Master Data sau khi tạo (chỉ copy trong transaction Approve).
* [x] Build thành công.

**Commit**

```text
feat(order): snapshot product/type refs and owner on approve
```

---

# Task 04 - Cho phép huỷ đơn đã thu cọc

## Mục tiêu

Sửa `SalesOrderService.cancel()` theo quyết định đã chốt (xem `order.md` mục "Huỷ đơn đã thu cọc" + `debt.md`).

## Nội dung

* Bỏ điều kiện chặn `Receivable.paidAmount > 0`. Điều kiện còn lại giữ nguyên: mọi PO `PENDING`, đơn chưa `CANCELLED`/`DELIVERED`.
* API cancel trả về (hoặc API detail cung cấp sẵn) số tiền cọc đã thu để FE hiển thị cảnh báo xác nhận: *"Đơn hàng đã thu cọc. ERP sẽ đóng công nợ. Việc hoàn tiền thực hiện ngoài hệ thống."*
* Timeline `CANCELLED` payload mở rộng: `{ reason, paidAmount, refundNote: "Refund handled outside ERP" }` — chỉ thêm `paidAmount`/`refundNote` khi `paidAmount > 0`.
* Không đụng Payment, không đụng Receivable (rule lọc `status != CANCELLED` sẵn có tự xử lý phần công nợ mở).

### Definition of Done

* [x] Huỷ đơn đã cọc (PO đều PENDING) thành công; PO cascade `CANCELLED` như cũ (verify sống).
* [x] Công nợ mở không còn tính đơn này (verify delta trên `/receivables/dashboard`); Payment giữ nguyên (verify sống).
* [x] Timeline payload đúng quy ước (`paidAmount`/`refundNote` chỉ khi có cọc).
* [ ] FE hiển thị dialog cảnh báo khi đơn có cọc — **hoãn (đã chốt 06/07/2026)**: FE chưa có trang Sales Order; API detail đã trả sẵn `receivable.paidAmount` để dùng khi dựng FE Order.
* [x] Huỷ đơn chưa cọc: hành vi như cũ, payload không có `paidAmount`/`refundNote` (verify sống).
* [x] Build thành công.

**Commit**

```text
feat(order): allow cancel with deposit - refund handled outside erp
```

---

# Task 05 - Return: trạng thái xử lý + Action complete

## Mục tiêu

Triển khai `ReturnStatus` theo `return.md` mục "Trạng thái Return" (schema đã có từ Task 00).

## Nội dung

* Endpoint `POST /returns/:id/complete` — chỉ chạy khi `status = PROCESSING`, một chiều, ghi người thực hiện + thời gian.
* `GET /returns` bổ sung filter theo `status`.
* FE: badge trạng thái trên danh sách/chi tiết Return + nút "Hoàn tất xử lý".

**Quyết định đã chốt với người dùng (05/07/2026):** dùng lại permission `return.update` cho Action này — không seed key mới.

### Definition of Done

* [x] `complete` hoạt động (ghi `completedBy`/`completedAt` — 2 field bổ sung đã chốt 06/07/2026, migration `20260706052711`), chặn đúng khi đã `COMPLETED` (verify sống).
* [x] Filter status hoạt động (verify sống).
* [ ] FE hiển thị và thao tác được — **hoãn (đã chốt 06/07/2026)**: FE chưa có trang Return.
* [x] Build thành công.

**Commit**

```text
feat(return): return processing status + complete action
```

---

# Task 06 - Hoàn thiện Milestone

## Mục tiêu

Rà soát toàn bộ, khớp tài liệu, đóng milestone.

### Definition of Done

* [x] Toàn bộ Task 00–05 hoàn thành (phần FE Task 04/05 hoãn theo chốt 06/07/2026 — FE mới có đến module Quotation), verify sống 45 check PASS trên API + PostgreSQL thật: tạo báo giá → đổi tên Product → hiển thị/in giữ tên cũ; đổi version giá → Approve bị chặn → tính lại (+chênh lệch đúng) → Approve; huỷ đơn đã cọc/chưa cọc; complete Return một chiều + filter.
* [x] `erd.md` mục 19: đánh dấu ✅ từng hạng mục đã xử lý.
* [x] Không còn lỗi TypeScript / Runtime. Build thành công (API + web), 108/108 unit test pass.
* [x] Đã tự review.
* [x] Dừng.

**Commit**

```text
chore(architecture): complete architecture review fixes milestone
```

---

# Tiêu chí hoàn thành

Milestone được xem là hoàn thành khi:

* [x] Hoàn thành toàn bộ Task (2 mục FE của Task 04/05 hoãn theo chốt 06/07/2026 — chờ module FE Order/Return).
* [x] Đã Commit theo từng Task.
* [ ] Đã Push GitHub — chờ lệnh người dùng.
* [x] `erd.md` mục 19 khớp trạng thái thực tế.
* [x] Sẵn sàng cho Milestone tiếp theo (`002-bao-cao.md`).

---

# Milestone tiếp theo

Sau khi hoàn thành sẽ chuyển sang:

**002-bao-cao.md** (Module Báo cáo — thiết kế đã có sẵn tại `knowledge/modules/report.md`; schema/index tiền đề đã xong ở milestone này)
