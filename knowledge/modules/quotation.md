# Module Báo giá

> **Tên file:** `knowledge/modules/quotation.md`

---

# Mục đích

Quản lý toàn bộ quy trình báo giá cho khách hàng.

Đây là điểm khởi đầu của quy trình bán hàng.

Sau khi khách hàng xác nhận báo giá, hệ thống sẽ tự động:

- Snapshot toàn bộ dữ liệu
- Sinh Đơn hàng
- Sinh Phiếu sản xuất theo từng xưởng
- Chuyển Đơn hàng sang "Đang sản xuất"

Toàn bộ các bước trên xảy ra trong **một transaction duy nhất**.

Nếu bất kỳ bước nào thất bại, toàn bộ rollback. Không để hệ thống ở trạng thái nửa vời.

---

# Vai trò trong ERP

Module Báo giá chịu trách nhiệm:

- Chọn khách hàng
- Chọn sản phẩm
- Cấu hình sản phẩm
- Tính giá bán
- Áp dụng chính sách giá
- Quản lý quá trình thương lượng
- Chuyển đổi thành Đơn hàng

Không chịu trách nhiệm:

- Quản lý sản xuất
- Quản lý kho
- Quản lý công nợ

Các nghiệp vụ trên được xử lý ở Module tương ứng.

---

# Business Flow

## Luồng thực tế

Kế toán nhận yêu cầu từ khách

↓

Tạo báo giá trong ERP → thêm sản phẩm → nhập thông số → Pricing Engine tính giá

↓

Áp dụng chiết khấu

↓

Xuất PDF → Gửi khách (qua Zalo hoặc trực tiếp)

↓

Khách xác nhận

↓

Kế toán bấm **"Khách đã duyệt"** trong ERP

↓

ERP tự động (atomic transaction):
  - Snapshot
  - Sinh Sales Order
  - Sinh Order BOM
  - Sinh Production Orders
  - Chuyển Sales Order sang "Đang sản xuất"
  - Gán salesOrderId
  - Ghi Timeline

---

# Trạng thái Báo giá

```text
               ┌──────────────► Cancelled (terminal)
               │
Draft → Sent → Approved
```

| Trạng thái | Mô tả | Được sửa? |
|---|---|---|
| Draft | Đang soạn | Có |
| Sent | Đã gửi khách | Có |
| Approved | Khách đã xác nhận | Không (readonly) |
| Cancelled | Huỷ | Không (terminal) |

**Ghi chú:**

- Không có trạng thái `Converted To Order`. Thay vào đó dùng field `salesOrderId`. Khi `salesOrderId` có giá trị, báo giá đã được chuyển thành đơn hàng.
- Cancelled chỉ đạt được từ **Draft hoặc Sent**. **Không Cancel báo giá Approved** — vì Approve luôn sinh Sales Order + gán `salesOrderId` trong cùng transaction, mọi báo giá Approved đều đã có đơn hàng kèm theo; huỷ báo giá lúc này sẽ để lại SalesOrder/ProductionOrder/Receivable không có nguồn gốc rõ ràng. Muốn dừng thương vụ → huỷ **Sales Order** theo rule của `order.md`; báo giá giữ nguyên Approved + `salesOrderId` để phục vụ lịch sử.
- Approved là readonly — muốn thay đổi nội dung, tạo báo giá mới (sau khi đã huỷ Sales Order, nếu `order.md` còn cho phép huỷ).

---

# Quy tắc chỉnh sửa

## Draft và Sent

Được phép:

- Thêm / sửa / xoá sản phẩm
- Sửa thông số sản phẩm
- Sửa số lượng
- Sửa chiết khấu
- Sửa ghi chú

Mỗi lần thay đổi thông số hoặc số lượng → giá hệ thống tự tính lại.

Chỉnh sửa ở trạng thái `Sent` **không làm thay đổi trạng thái** — vẫn giữ `Sent`. Sau khi sửa, export PDF lại và gửi khách.

## Approved

Readonly hoàn toàn.

Không huỷ trực tiếp báo giá Approved (đã có Sales Order kèm theo — xem Ghi chú ở mục "Trạng thái Báo giá").

Muốn thay đổi → huỷ Sales Order (theo rule của `order.md`, nếu còn được phép) → tạo báo giá mới.

---

# Dữ liệu quản lý

## Thông tin chung

- Mã báo giá
- Khách hàng
- Người phụ trách
- Ngày báo giá
- Ngày hết hạn
- Ghi chú
- `salesOrderId` (null nếu chưa chuyển thành đơn hàng)

## Danh sách sản phẩm

Mỗi dòng (QuotationItem) bao gồm:

- Sản phẩm
- Mã, tên sản phẩm — **snapshot** (`productCode`, `productName`) tại thời điểm thêm/sửa dòng. Sau khi Approve, hiển thị báo giá đọc từ snapshot này, **không đọc lại Product** — đúng CLAUDE.md mục 7 ("snapshot Tên, mã sản phẩm tại thời điểm tạo báo giá"). `productId` giữ lại làm reference điều hướng.
- Số lượng
- **QuotationItemParameter** — snapshot giá trị thông số tại thời điểm nhập (không phải FK)
- Giá hệ thống (tính từ Pricing Engine, lưu tại thời điểm thêm/sửa)
- Chiết khấu Khách hàng × Sản phẩm (%) — snapshot từ `CustomerProductDiscount` (xem mục Discount Engine)
- Giá bán cuối
- Thành tiền
- VAT (%) + tiền VAT — snapshot từ Pricing Rule Version, tính SAU Discount Engine
- Chú thích (ghi tay, tuỳ chọn)

**QuotationItemParameter là snapshot, không phải FK.**

Mỗi thông số sản phẩm được lưu thành một bản sao độc lập vào QuotationItem:

```text
QuotationItem
  └── QuotationItemParameter (snapshot)
        chieucao  = 2.00   (m)
        chieurong = 1.20   (m)
        color     = Trắng
```

Dù Product Parameter sau này bị sửa hoặc xoá, giá trị trong báo giá vẫn giữ nguyên.

---

# Ngày hết hạn

V1: Hệ thống chỉ **hiển thị cảnh báo** khi báo giá đã quá ngày hết hạn.

Không tự động huỷ.

Không chặn Approve.

Người dùng tự quyết định có tiếp tục hay không.

---

# Pricing Engine

Giá bán được tính hoàn toàn tự động.

Pricing Engine sử dụng:

- Product
- Product Parameters (do người dùng nhập)
- Pricing Rule Version (ACTIVE tại thời điểm tính)
- Pricing Round Rule

Người dùng không nhập giá bán thủ công.

## Quy tắc tính và khoá giá

```text
Người dùng nhập thông số
    ↓
Pricing Engine tính giá
    ↓
Giá hệ thống lưu vào QuotationItem.systemPrice
```

Giá được **tính lại** mỗi khi thông số hoặc số lượng thay đổi (trong Draft / Sent).

Giá **khoá cứng** khi Approve. Từ thời điểm đó trở đi, dù Pricing Rule có thay đổi, giá đã lưu không bị ảnh hưởng.

---

# Discount Engine

> Tái cấu trúc Sprint 04 (chốt 16/07/2026) — THAY THẾ HOÀN TOÀN cơ chế cũ
> (CK nhóm tự động + Giảm thêm %/số tiền cấp dòng sản phẩm). Xem
> `workbench/sprint-04/005-chiet-khau-khach-hang-vat-bao-gia.md`.

## Thứ tự tính giá (cấp dòng sản phẩm)

```text
systemPrice
    × (1 − discountPercent%)   ← Chiết khấu Khách hàng × Sản phẩm, snapshot
= finalPrice
    × quantity
= subtotal
    × vatRate%                 ← VAT, tính SAU Discount Engine
= vatAmount
```

`finalPrice` phải ≥ 0. Hệ thống không cho lưu nếu kết quả âm.

## Chiết khấu Khách hàng × Sản phẩm

Master Data riêng — `CustomerProductDiscount(customerId, productId, discountPercent)`,
quản lý qua `/customers/:id/product-discounts` (module Customer). Cấu hình
theo từng cặp khách hàng × sản phẩm, không theo nhóm khách. Mặc định 0% nếu
chưa cấu hình.

Khi thêm/sửa dòng báo giá, hệ thống lookup và **snapshot** % này vào
`QuotationItem.discountPercent` tại thời điểm thêm dòng — sửa cấu hình Master
Data sau đó không ảnh hưởng báo giá đã tạo. Sửa dòng (không đổi sản phẩm)
**không** lookup lại, dùng nguyên snapshot cũ.

Không dùng %/số tiền hỗn hợp, không có "giảm thêm" ở cấp dòng sản phẩm nữa
(dời lên cấp toàn báo giá — xem mục dưới).

## Giảm thêm (cấp toàn báo giá)

Không còn ở cấp dòng sản phẩm. Chỉ giảm bằng **số tiền mặt**, áp trên **Tổng
thanh toán** (= Tổng tiền hàng + Tổng VAT của toàn báo giá).

Action: `POST /quotations/:id/discount` `{ amount, reason }` — chỉ thực hiện
được khi báo giá đang DRAFT/SENT.

Validate:

- `amount ≥ 0`
- `amount ≤ Tổng tiền hàng + Tổng VAT`
- Bắt buộc `reason` khi `amount > 0`

Hệ thống lưu vào `Quotation.discountAmount/discountReason/discountBy` (người
thực hiện lấy từ JWT). Không ghi Timeline riêng — audit đã có sẵn trong 3
field này.

Không cho phép sửa trực tiếp `Giá bán cuối`/`Tổng thanh toán`.

---

# Workflow Engine

ERP được thiết kế theo Action. Không thiết kế theo CRUD.

## Quy ước API (bắt buộc)

```http
POST /quotations/:id/send
POST /quotations/:id/approve
POST /quotations/:id/cancel
```

Không dùng:

```http
PATCH /quotations/:id   { "status": "Approved" }
```

Người dùng không thay đổi Status trực tiếp.

## Ví dụ

Gửi báo giá

↓

ERP → Status = Sent

---

Khách xác nhận

↓

ERP (atomic transaction):

1. Snapshot toàn bộ dữ liệu liên quan
2. Sinh Sales Order
3. Sinh Order BOM
4. Sinh Production Orders theo Production Center của từng Product
5. Chuyển Order → "Đang sản xuất"
6. Gán `quotation.salesOrderId`
7. Gán `quotation.status = Approved`

**Nếu bất kỳ bước nào thất bại → rollback toàn bộ transaction.**

Không được tồn tại trạng thái dở dang: không có Order mà không có Snapshot, không có Production Order mà không có Order.

---

# Manual Override

Trong trường hợp đặc biệt cho phép điều chỉnh trạng thái.

Bắt buộc:

- Chọn trạng thái mới
- Nhập lý do
- Lưu người thực hiện
- Lưu thời gian
- Lưu trạng thái cũ
- Lưu trạng thái mới

Mọi thay đổi đều xuất hiện trong Timeline. Không cần bảng audit riêng.

**Giới hạn:** Manual Override không được dùng để Cancel báo giá đã có `salesOrderId` (tức mọi báo giá Approved) — xem Ghi chú ở mục "Trạng thái Báo giá". Muốn dừng thương vụ, xử lý ở Sales Order.

---

# Snapshot Rule

Có **hai thời điểm snapshot**, không gộp làm một:

**1. Tại thời điểm thêm/sửa dòng (Draft/Sent):**

- `productCode`, `productName` (danh tính sản phẩm trên chứng từ gửi khách)
- QuotationItemParameter (giá trị thông số)
- `systemPrice` (kèm `pricingRuleVersionId` đã dùng để tính)

**2. Thực hiện tại thời điểm Approve (trong cùng transaction):**

- Product
- Product Parameters
- Pricing Rule Version
- Material Requirement Version
- Material Price
- Giá bán (systemPrice đã khoá)
- Giá vốn kế hoạch
- Chiết khấu
- Production Center

Sau khi Snapshot được tạo:

Mọi thay đổi của dữ liệu gốc không được làm thay đổi các chứng từ đã xác nhận.

---

# Production Rule

Ngay khi Approve:

ERP tự động:

- Sinh Sales Order
- Sinh Order BOM
- Sinh Production Order theo từng Production Center
- Chuyển trạng thái Đơn hàng sang "Đang sản xuất"

Không cần người dùng tự tạo Phiếu sản xuất.

## Production Center

**Production Center là thuộc tính bắt buộc (NOT NULL) của Product.**

V1: Một Product thuộc đúng **một** Production Center.

Khi Approve, hệ thống đọc `product.productionCenterId` để sinh Production Order — không để Sales chọn.

Multi-center (một sản phẩm sản xuất ở nhiều xưởng) là scope V2.

---

# Dashboard Rule

Module Báo giá không code logic Dashboard.

Khi Approve, hệ thống đưa `SalesOrder.status = "Đang sản xuất"` — đó là đủ.

Dashboard Module (triển khai sau) tự query từ SalesOrder để tính doanh thu kế hoạch, giá vốn kế hoạch, lợi nhuận kế hoạch.

---

# PDF Export

V1: Chỉ hỗ trợ tải xuống (download).

Không gửi email.

Không gửi Zalo.

---

# Timeline

Mọi Action đều sinh Timeline.

## V1 — Log 5 Action chính

```text
09:00  Tạo báo giá BG000012
09:15  Gửi báo giá (Sent)
10:30  Khách đã duyệt → Sinh SO000023 + 1 Production Order [Xưởng A]
16:00  Manual Override: Sent → Cancelled — Lý do: Khách đổi ý [Trần Thị B]
```

V1 chỉ log:

- **Tạo báo giá**
- **Gửi báo giá**
- **Khách đã duyệt** (kèm salesOrderId, danh sách Production Order đã sinh)
- **Huỷ báo giá**
- **Manual Override** (kèm trạng thái cũ → mới + lý do + người thực hiện)

Giảm giá thêm đã có audit riêng trong Discount Engine — không cần log vào Timeline.

Sửa thông số sản phẩm trong quá trình soạn thảo: không log trong V1.

## V2 — Field-level diff cho mọi thay đổi

Hiển thị diff từng field: `width: 1200 → 1500`. Scope V2.

---

Timeline là nguồn dữ liệu lịch sử. Cũng là audit log cho Manual Override.

Status chỉ phản ánh trạng thái hiện tại.

---

# Validation

## Bắt buộc khi tạo / sửa

- Khách hàng
- Ít nhất một sản phẩm
- Số lượng
- Product Parameters đầy đủ

## Kiểm tra khi Approve

- Product phải còn hoạt động (ACTIVE)
- Product phải có Pricing Rule Version ACTIVE
- Product phải có Material Requirement Version ACTIVE
- **Pricing Version còn khớp:** `QuotationItem.pricingRuleVersionId` của từng dòng phải đúng là Pricing Rule Version đang ACTIVE của Product tại thời điểm Approve — xem mục "Khi Pricing Rule đổi version giữa chừng"
- `finalPrice` ≥ 0 cho tất cả các dòng
- Chưa có `salesOrderId` (chưa từng được approve)

## Khi Pricing Rule đổi version giữa chừng

Kịch bản: giá được tính bằng version 3 lúc soạn báo giá → gửi khách → Product kích hoạt version 4 → khách xác nhận → kế toán bấm Approve.

Xử lý: **chặn Approve, không tính lại âm thầm.**

```text
Approve
    ↓
So sánh pricingRuleVersionId từng dòng với version ACTIVE hiện tại
    ↓ khớp                          ↓ lệch
Tiếp tục Approve            Chặn + báo rõ dòng nào tính bằng version cũ
                                    ↓
                            Người dùng bấm "Tính lại giá" (Action)
                                    ↓
                            systemPrice tính lại bằng version ACTIVE,
                            pricingRuleVersionId cập nhật theo
                                    ↓
                            Nếu giá đổi so với bản đã gửi → gửi lại khách xác nhận
                                    ↓
                            Approve lại
```

Lý do không tự tính lại: giá đã gửi khách là cam kết thương mại — hệ thống không được lặng lẽ đổi con số khách đã đồng ý. Người dùng phải nhìn thấy chênh lệch và tự quyết định.

**Không cần kiểm tra tương tự cho Material Requirement Version:** giá vốn/BOM luôn được tính **tại Approve** bằng version ACTIVE hiện tại (chưa từng gửi khách, chưa chốt trước đó) — không tồn tại trạng thái "đã tính bằng version cũ" để mà lệch.

---

# Business Rule

- Một Báo giá thuộc một Khách hàng.
- Một Báo giá có nhiều dòng sản phẩm.
- Một dòng sản phẩm sử dụng đúng một Product.
- Giá bán luôn được tính từ Pricing Engine. Không nhập giá bán thủ công.
- Giá tính lại mỗi khi thông số thay đổi (Draft/Sent). Khóa cứng khi Approve.
- QuotationItem snapshot `productCode`/`productName` tại thời điểm thêm/sửa dòng — sau Approve không đọc lại Product để hiển thị.
- Approve bị chặn nếu `pricingRuleVersionId` của bất kỳ dòng nào không còn là version ACTIVE — người dùng phải chủ động "Tính lại giá", không tính lại âm thầm.
- Chiết khấu Khách hàng × Sản phẩm snapshot tự động khi thêm dòng (mặc định 0% nếu chưa cấu hình).
- Giảm thêm cấp toàn báo giá (số tiền mặt, trên Tổng thanh toán) phải lưu lý do.
- `finalPrice` không được âm.
- Báo giá chỉ được chuyển thành Đơn hàng một lần (kiểm tra `salesOrderId IS NULL`).
- Approve là atomic: snapshot + order + production trong một transaction. Dashboard Module đọc dữ liệu sau.
- ERP tự sinh Phiếu sản xuất. Người dùng không tạo thủ công.
- Dashboard lấy dữ liệu từ Đơn hàng đã chuyển sang "Đang sản xuất".
- Draft và Sent có thể chỉnh sửa. Approved là readonly.
- Không Cancel báo giá đã có `salesOrderId` (mọi báo giá Approved) — kể cả qua Manual Override. Muốn dừng thương vụ, huỷ Sales Order; báo giá giữ Approved phục vụ lịch sử.
- Muốn sửa sau Approved → huỷ Sales Order (nếu còn được phép) → tạo báo giá mới.

---

# Quan hệ dữ liệu

```text
Customer
    │
    ▼
Quotation (salesOrderId → SalesOrder)
    │
    ▼
QuotationItem
    ├── Product
    ├── Product Parameters (snapshot)
    ├── systemPrice (khoá tại Approve)
    ├── discountPercent (snapshot từ CustomerProductDiscount)
    ├── finalPrice
    ├── vatRate% / vatAmount
    └── note
    │
    ▼
SalesOrder (totalVatAmount, discountAmount, grandTotal)
    │
    ├── OrderBOM
    │
    └── ProductionOrder (per Production Center)
            │
            ▼
        Dashboard
```

---

# Ghi chú

Module Báo giá là trung tâm của toàn bộ quy trình bán hàng.

Các Module:

- Đơn hàng
- Sản xuất
- Kho
- Công nợ
- Dashboard

đều sử dụng dữ liệu được sinh ra từ Module này.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
