# Milestone 04 - Module Báo giá

> **Tên file:** `workbench/sprint-01/004-bao-gia.md`

---

## Mục tiêu

Hoàn thành Module Quản lý Báo giá theo đúng tài liệu nghiệp vụ.

Đây là Module trung tâm của quy trình bán hàng.

Sau khi hoàn thành, Module phải có khả năng:

- Quản lý báo giá
- Tính giá tự động
- Áp dụng chính sách giá
- Sinh Đơn hàng
- Sinh Phiếu sản xuất
- Snapshot dữ liệu
- Khởi động quy trình sản xuất

---

## Phạm vi

Chỉ phát triển Module Báo giá.

Không sửa Module khác.

Nếu phát hiện nghiệp vụ chưa rõ hoặc xung đột phải dừng và hỏi người dùng trước khi tiếp tục.

---

## Tham chiếu

Trước khi thực hiện cần đọc:

- `.claude/CLAUDE.md`
- `knowledge/project/05-coding-convention.md`
- `knowledge/modules/product.md`
- `knowledge/modules/customer.md`
- `knowledge/modules/quotation.md`

Chỉ đọc thêm tài liệu khác khi thật sự cần.

---

## Quy trình làm việc

- Mỗi lần chỉ thực hiện **01 Task**.
- Hoàn thành Task thì dừng.
- Tóm tắt những gì đã làm.
- Liệt kê các file đã tạo hoặc chỉnh sửa.
- Đề xuất Commit Message.
- Chờ Task tiếp theo.

---

## Task 01 - Thiết kế Data Model

Thiết kế toàn bộ Data Model cho Module Báo giá.

Bao gồm: Quotation, QuotationItem, QuotationItemParameter, QuotationTimeline, Snapshot Reference.

Đề xuất: Quan hệ dữ liệu, Index, Enum, Validation.

### Quyết định kiến trúc bắt buộc làm rõ trong Task này

#### 1. salesOrderId thay thế status "Converted To Order"

Không có trạng thái `Converted To Order`.

Dùng field `salesOrderId` (nullable FK → SalesOrder).

Khi `salesOrderId IS NOT NULL` → báo giá đã được chuyển thành đơn hàng.

#### 2. QuotationItemParameter là snapshot, không phải FK

```
QuotationItem
  └── QuotationItemParameter (snapshot)
        name  = "chieucao"
        value = "200"
```

Không FK về ProductParameter. Dù ProductParameter bị sửa hay xoá, giá trị trong báo giá vẫn giữ nguyên.

#### 3. productionCenterId: đọc từ Product, không cho Sales nhập

`productionCenterId` không nằm trong Quotation hay QuotationItem.

Khi Approve, hệ thống tự đọc `product.productionCenterId` để sinh Production Order.

Sales không được chọn hay thay đổi Production Center.

#### 4. Application Service pattern

Toàn bộ logic nghiệp vụ đi qua `QuotationWorkflowService` — xem chi tiết kiến trúc trong `.claude/CLAUDE.md`.

#### 5. QuotationTimeline schema

Thiết kế schema cho `QuotationTimeline` (id, quotationId, action, payload, createdBy, createdAt).

V1 chỉ log 5 action chính: `QuotationCreated`, `QuotationSent`, `QuotationApproved`, `QuotationCancelled`, `QuotationManualOverride`.

Timeline được ghi trực tiếp trong `QuotationWorkflowService` khi Action xảy ra. Không cần event bus.

Definition of Done

- [x] Đề xuất Data Model đầy đủ (Quotation, QuotationItem, QuotationItemParameter, QuotationTimeline).
- [x] Đề xuất Quan hệ dữ liệu.
- [x] Đề xuất Enum (QuotationStatus: Draft, Sent, Approved, Cancelled).
- [x] Đề xuất Index.
- [x] Làm rõ `salesOrderId` thay thế "Converted To Order" status.
- [x] Làm rõ `QuotationItemParameter` là snapshot, không phải FK.
- [x] Làm rõ `productionCenterId` đọc từ Product khi Approve, không cho Sales nhập.
- [x] Quyết định Application Service pattern (Controller → QuotationWorkflowService).
- [x] Thiết kế `QuotationTimeline` schema + 5 action types cần log.
- [x] Chờ người dùng xác nhận trước khi code.

Commit

```text
docs(quotation): design quotation data model
```

---

## Task 02 - Pricing Engine

Xây dựng Pricing Engine như một service độc lập.

Pricing Engine phải:

- Đọc Product
- Đọc Product Parameters (do người dùng nhập)
- Đọc Pricing Rule Version (ACTIVE tại thời điểm tính)
- Áp dụng Pricing Round Rule
- Sinh `systemPrice`

Không cho phép nhập giá bán thủ công.

Pricing Engine là service độc lập, sẵn sàng được gọi từ: Quotation CRUD, Đơn hàng, Tính nhanh trên Product, API bên ngoài.

Definition of Done

- [x] `PricingEngine` service được thiết kế độc lập, không phụ thuộc vào Quotation.
- [x] API/service nhận input (productId + parameters) → trả về `systemPrice`.
- [x] Xử lý đúng trường hợp không có Pricing Rule Version ACTIVE → trả về lỗi rõ ràng.
- [x] Có unit test cho các trường hợp: tính đúng giá, thiếu rule, rule không ACTIVE.
- [x] Chưa cần UI hoàn chỉnh — chỉ cần sẵn sàng tích hợp vào Task 03.
- [x] Build thành công.

Commit

```text
feat(quotation): pricing engine
```

---

## Task 03 - Quotation CRUD

Hoàn thành chức năng quản lý Báo giá.

Bao gồm: Danh sách, Thêm mới, Chi tiết, Chỉnh sửa, Thêm / sửa / xoá QuotationItem, Nhập Product Parameters → gọi Pricing Engine → hiển thị `systemPrice`.

### Quy tắc chỉnh sửa

- `Draft` và `Sent`: được phép thêm / sửa / xoá sản phẩm, sửa thông số, sửa số lượng.
- `Approved`: readonly hoàn toàn.
- `Cancelled`: readonly hoàn toàn.
- Mỗi lần thay đổi thông số hoặc số lượng → gọi Pricing Engine tính lại `systemPrice`.

Definition of Done

- [x] API hoạt động (Quotation + QuotationItem).
- [x] UI hoạt động.
- [x] Search, Filter, Pagination.
- [x] Thêm / sửa QuotationItem: nhập thông số → `systemPrice` tự động tính từ Pricing Engine.
- [x] `QuotationItemParameter` được lưu dưới dạng snapshot (không FK).
- [x] Trường `expiryDate` (tuỳ chọn): UI hiển thị badge cảnh báo "Đã quá hạn" nếu `expiryDate < hôm nay`. Không chặn Approve dù đã quá hạn.
- [x] Approved / Cancelled hiển thị readonly, không cho sửa.
- [x] Không cho phép xoá QuotationItem nếu Quotation đang ở trạng thái Approved hoặc Cancelled — API phải trả lỗi rõ ràng.
- [x] Build thành công.

Commit

```text
feat(quotation): quotation crud
```

---

## Task 04 - Discount Engine

Hoàn thành cơ chế giảm giá.

Công thức:

```
systemPrice
    × (1 − groupDiscount%)
    × (1 − additionalDiscountPercent%)
    − additionalDiscountAmount
= finalPrice
```

Bao gồm: Group Discount (tự động từ Customer Group), Additional Discount (%), Additional Discount (Amount). Cho phép dùng đồng thời cả hai. `finalPrice` phải ≥ 0.

Definition of Done

- [x] Group Discount tự động lấy từ Customer Group khi tạo báo giá.
- [x] Giảm thêm (% và/hoặc số tiền) hoạt động, có thể dùng đồng thời.
- [x] `finalPrice` không được âm — hệ thống báo lỗi nếu kết quả âm.
- [x] Không cho phép sửa trực tiếp `finalPrice`.
- [x] Lưu đầy đủ audit khi giảm thêm: lý do (`reason`), người thực hiện (`createdBy`), thời gian (`createdAt`), giá trị giảm theo % (`discountPercent`), giá trị giảm theo số tiền (`discountAmount`).
- [x] Build thành công.

Commit

```text
feat(quotation): discount engine
```

---

## Task 05 - Workflow Engine

Thực hiện Action Send và Cancel của Báo giá.

(Approve được tách riêng ở Task 06 vì phức tạp hơn.)

Không cho phép sửa Status trực tiếp. Action phải dùng API riêng:

```
POST /quotations/:id/send
POST /quotations/:id/cancel
```

Toàn bộ Action đi qua `QuotationWorkflowService`, không để Controller gọi trực tiếp Repository.

Definition of Done

- [x] `POST /quotations/:id/send` hoạt động: Draft → Sent, ghi Timeline.
- [x] `POST /quotations/:id/cancel` hoạt động: huỷ từ bất kỳ trạng thái nào, bắt buộc nhập lý do, ghi Timeline.
- [x] Không dùng `PATCH { status: "..." }`.
- [x] Toàn bộ Action đi qua `QuotationWorkflowService`.
- [x] Build thành công.

Commit

```text
feat(quotation): workflow engine
```

---

## Task 06 - Approve & Snapshot

`QuotationWorkflowService.approve()` thực hiện toàn bộ trong **một Database Transaction**:

1. Validate (product ACTIVE, có Pricing Rule Version ACTIVE, có Material Requirement Version ACTIVE, `finalPrice ≥ 0`, `salesOrderId IS NULL`)
2. Snapshot toàn bộ dữ liệu liên quan
3. Sinh Sales Order
4. Sinh Order BOM
5. Sinh Production Orders theo `product.productionCenterId`
6. Chuyển Sales Order → "Đang sản xuất"
7. Gán `quotation.salesOrderId`
8. Ghi Timeline (QuotationApproved)

Về Dashboard: không cần push data trong transaction. Chỉ cần `SalesOrder.status = "Đang sản xuất"` là đủ — Dashboard Module (sau này) tự query.

Nếu bất kỳ bước nào lỗi → rollback toàn bộ.

Definition of Done

- [x] `POST /quotations/:id/approve` đi qua `QuotationWorkflowService.approve()`.
- [x] Snapshot hoạt động (Product, Pricing Rule Version, Material Requirement Version, giá bán, giá vốn, chiết khấu, Production Center).
- [x] Sales Order sinh thành công.
- [x] Order BOM sinh thành công.
- [x] Production Orders sinh đúng theo `productionCenterId` của từng Product.
- [x] `salesOrderId` được gán vào Quotation.
- [x] Test case: Production Order sinh lỗi → Order + Snapshot đều bị rollback.
- [x] Test case: Approve 2 lần c��ng một báo giá → lần 2 bị reject (`salesOrderId IS NOT NULL`).
- [x] Test case: Product không có Pricing Rule Version ACTIVE ��� Approve reject ở bước validate.
- [x] Ghi Timeline (QuotationApproved) kèm salesOrderId và danh sách Production Order đã sinh.
- [x] Build thành công.

Commit

```text
feat(quotation): approve quotation
```

---

## Task 07 - PDF Export

V1: Chỉ hỗ trợ Download. Không Email. Không Zalo API.

PDF có thể download từ trạng thái Draft, Sent, Approved.

Definition of Done

- [x] PDF đúng mẫu.
- [x] Download hoạt động.
- [x] Hiển thị đúng dữ liệu (thông tin khách hàng, danh s��ch sản phẩm, thông số, giá, chiết kh��u, tổng tiền).
- [x] Tên file PDF theo format: `BG000001 - Tên Công ty.pdf`.
- [x] Build thành công.

Commit

```text
feat(quotation): export pdf
```

---

## Task 08 - Timeline & Manual Override

Hoàn thiện Timeline hiển thị trên UI và implement Manual Override.

Schema `QuotationTimeline` đã thiết kế ở Task 01. Timeline được ghi trực tiếp trong `QuotationWorkflowService` — V1 không dùng event bus.

Manual Override bắt buộc: chọn trạng thái mới, nhập lý do, lưu người thực hiện, lưu thời gian, lưu trạng thái cũ → mới, hiển thị trong Timeline.

Definition of Done

- [x] 5 Action chính đều có bản ghi Timeline: Tạo, Gửi, Khách đã duyệt, Huỷ, Manual Override.
- [x] Manual Override: nhập lý do bắt buộc, lưu đủ thông tin audit.
- [x] Timeline hiển thị trên UI theo thứ tự thời gian.
- [x] Timeline là Audit Log — không được sửa hay xoá.
- [x] Build thành công.

Commit

```text
feat(quotation): timeline
```

---

## Task 09 - Hoàn thiện Module

Kiểm tra toàn bộ Module theo end-to-end flow.

### Acceptance Criteria

Flow chính phải chạy đúng đầu cuối:

1. Tạo báo giá → chọn khách hàng → thêm sản phẩm → nhập thông số → `systemPrice` tự tính
2. Áp dụng giảm giá → `finalPrice` đúng công thức
3. Gửi báo giá → trạng thái chuyển sang `Sent`
4. **Khách yêu cầu sửa** → edit QuotationItem ở trạng thái `Sent` → Pricing Engine tính lại `systemPrice` → export PDF mới → trạng thái vẫn giữ `Sent`
5. Approve → sinh Sales Order + Production Orders + Snapshot → `salesOrderId` được gán
6. Download PDF
7. Timeline hiển thị đủ các bước
8. Huỷ báo giá ở trạng thái `Approved` qua Manual Override → lưu lý do

Definition of Done

- [x] Toàn bộ Acceptance Criteria pass.
- [x] Không còn lỗi TypeScript.
- [x] Không còn lỗi Runtime.
- [x] Build thành công.
- [x] Đã Self Review.
- [x] Đề xuất Commit Message.
- [x] Dừng.

Commit

```text
chore(quotation): complete quotation module
```

---

## Tiêu chí hoàn thành

Module được xem là hoàn thành khi:

- [ X] Hoàn thành toàn bộ Task.
- [ X] Đã Commit.
- [ X] Đã Push GitHub.
- [ X] Sẵn sàng cho Module tiếp theo.

---

## Module tiếp theo

Sau khi hoàn thành Module Báo giá sẽ chuyển sang:

**005-don-hang.md**
