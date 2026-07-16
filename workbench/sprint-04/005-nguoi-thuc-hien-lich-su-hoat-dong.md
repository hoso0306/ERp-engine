# Milestone (Sprint 04) - Hiển thị tên người thực hiện trong Lịch sử hoạt động

> **Tên file:** `workbench/sprint-04/005-nguoi-thuc-hien-lich-su-hoat-dong.md`
> **Trạng thái:** ✅ PLAN ĐÃ CHỐT (16/07/2026) — phạm vi mở rộng ra toàn hệ thống (không chỉ 3 Timeline model), tất cả quyết định kỹ thuật đã xác nhận, sẵn sàng code.

---

# Bối cảnh

Người dùng phát hiện: trang chi tiết Báo giá, mục "Lịch sử hoạt động", dòng "Tạo báo giá" hiển thị một chuỗi ID (`cmr4mvobr004ts8vgqwngn25y`) thay vì tên người dùng đã đăng nhập.

## Nguyên nhân gốc (đã khảo sát 16/07/2026)

`QuotationTimeline.createdBy` (và tương tự `SalesOrderTimeline.createdBy`, `ProductionOrderTimeline.createdBy`) là string thô lưu `userId` — schema **không có field snapshot tên** (`createdByName`) và **không có relation tới `User`**. Backend trả nguyên `createdBy` = userId, Frontend render thẳng ra UI.

So sánh: dự án đã có pattern đúng ở `SalesOrder.ownerId` + `ownerName` (`schema.prisma:895-897`) — snapshot tên tại thời điểm ghi, fallback `owner.name ?? owner.email` khi `name` NULL (xem `quotation-workflow.service.ts:1039-1040`). Đây là pattern sẽ tái sử dụng.

## Phát hiện mở rộng — khảo sát tại sao "hiện tại" createdBy đang trống/ID

Rà toàn bộ nơi ghi Timeline cho 3 model, phát hiện vấn đề **lớn hơn phạm vi hiển thị**: rất nhiều action hiện **không hề ghi `createdBy`**, không phải chỉ thiếu tên.

| Module | Action | Controller có lấy `req.user`? | Service có ghi `createdBy`? |
|---|---|---|---|
| Quotation | `create` | ✅ (`quotation.controller.ts:48`) | ✅ JWT userId |
| Quotation | `approve` | ✅ (`:73`) | dùng để tính `ownerId`/`ownerName` của SalesOrder, **không** ghi vào `QuotationTimeline` |
| Quotation | `recalculatePrices` | ✅ (`:86`) | ✅ JWT userId |
| Quotation | `send` | ❌ (`:66`) | ❌ luôn NULL |
| Quotation | `cancel` | ❌ (`:94`, DTO không có field nào) | ❌ luôn NULL |
| Quotation | `override` | ❌ (`:101`) | ⚠️ dùng `dto.overrideBy` (free-text người dùng tự gõ) |
| SalesOrder | `ship`, `deliver` | ❌ | ❌ luôn NULL |
| SalesOrder | `override` | ❌ | ⚠️ dùng `dto.overrideBy` (free-text) |
| SalesOrder | `cancel` | ❌ | ⚠️ dùng `dto.cancelledBy` (free-text) |
| ProductionOrder | `start`, `complete` | ❌ | ❌ luôn NULL |
| Payment | `create` | ❌ | (Payment không phải Timeline model — ngoài phạm vi, xem mục "Ngoài phạm vi") |

**Điểm quan trọng:** `override`/`cancel` của Quotation và SalesOrder đã có sẵn 1 ô nhập tay "Người thực hiện" ở FE (`quotations/[id]/page.tsx:675-681`, placeholder "Tên người duyệt override...") — giá trị này vốn **đã là tên** (không phải ID), gửi qua DTO field `overrideBy`/`cancelledBy` rồi lưu thẳng vào `createdBy`. Tức là field `createdBy` hiện đang bị dùng với **2 ngữ nghĩa khác nhau** tuỳ action: đôi khi là `userId` (JWT), đôi khi là tên tự gõ (Manual Override). Đã chốt hướng xử lý — xem mục "Quyết định đã chốt" bên dưới.

## Phát hiện mở rộng lần 2 — audit toàn hệ thống (16/07/2026)

Theo yêu cầu mở rộng phạm vi ra "mọi chỗ audit trail không lưu tên người đăng nhập", đã rà soát toàn bộ field kiểu `*By` trong `schema.prisma`. Kết quả chia 3 nhóm:

**Nhóm A — Đã lưu đúng JWT userId, chỉ thiếu resolve tên (cùng bản chất bug gốc):**

| Field | Nơi ghi | Nơi hiển thị |
|---|---|---|
| `QuotationTimeline.createdBy` | JWT (nhiều chỗ) | `quotations/[id]/page.tsx:728` — đã trong phạm vi |
| `SalesOrderTimeline.createdBy` | JWT (nhiều chỗ) | `orders/[id]/page.tsx:614` — đã trong phạm vi |
| `ProductionOrderTimeline.createdBy` | JWT (nhiều chỗ) | `production/[id]/page.tsx:223` — đã trong phạm vi |
| `Return.completedBy` | JWT (`return.service.ts:112`, qua `return.controller.ts:47-52`) | **Không có UI nào hiển thị** (`returns/[id]/page.tsx` chỉ hiện `receivedBy`, quên `completedBy`) — cần bổ sung |
| `PermissionAudit.changedBy` | JWT (ghi khi đổi Role/Permission/User) | **Không có trang FE nào hiển thị** log này — không có màn hình xem audit log |
| `Quotation.createdBy`/`updatedBy` | JWT | Chỉ dùng nội bộ tính `ownerId` hoa hồng, **không hiển thị UI** |

**Nhóm B — Hoàn toàn không lưu actor (gap tính năng, không phải bug hiển thị) → đã quyết KHÔNG làm trong task này, để task riêng:**

- `Customer.createdBy`/`updatedBy` — schema có sẵn `@relation` (`createdByUser`/`updatedByUser`) nhưng `customer.service.ts` chưa từng set, luôn NULL, không FE nào hiển thị.
- `PricingRuleVersion`, `MaterialRequirementVersion` — không có field "ai tạo version" nào trong schema.

**Nhóm C — Free-text tự gõ, không phải JWT (mỗi field một nghiệp vụ riêng, đã quyết từng cái):**

| Field | Ý nghĩa | Quyết định |
|---|---|---|
| `QuotationItem.discountBy` (ô "Người thực hiện" trong dialog thêm/sửa dòng, `quotation-item-dialog.tsx:384-390`) | Người duyệt chiết khấu, cùng bản chất `overrideBy` | **Đổi sang JWT** |
| `MaterialReceipt.createdBy` (label FE "Người tạo", `warehouse/receipts/[id]/page.tsx:77-78`) | Nhãn ngụ ý người đăng nhập, nhưng code là free-text field (`create-material-receipt.dto.ts:10`) — **thực tế FE không có ô nhập nào gửi field này, luôn NULL** | **Đổi sang JWT** (không cần xoá gì ở FE vì chưa từng có input) |
| `Payment.createdBy` (`payment-table.tsx:64`) | Free-text, FE không gửi, luôn NULL | Giữ nguyên — ngoài phạm vi (xem bên dưới) |
| `Return.receivedBy` (`returns/[id]/page.tsx:147-151`, nhập ở `returns/new/page.tsx`) | **Nhân viên phía khách hàng** nhận lại hàng hoàn — không phải người dùng ERP | **Không đụng vào** — đổi sang JWT sẽ sai nghiệp vụ (gán nhầm tên người đăng nhập ERP cho người nhận hàng bên khách) |

---

# Phạm vi

Người dùng đã xác nhận mở rộng phạm vi 2 lần (16/07/2026):

1. Lần 1: xử lý trọn vẹn cả 3 model Timeline (`QuotationTimeline`, `SalesOrderTimeline`, `ProductionOrderTimeline`) — không chỉ thêm tên mà còn vá lỗ hổng thiếu `userId` ở các action chưa truyền.
2. Lần 2: mở rộng ra **toàn hệ thống** — sửa mọi chỗ audit trail đang lưu sai/thiếu tên người đăng nhập, không giới hạn ở 3 Timeline model.

## Trong phạm vi

- Thêm field snapshot tên cho cả 3 Timeline model, theo pattern `ownerName`.
- Thread `userId` (từ JWT, qua `AuthGuard`) xuống service cho toàn bộ action còn thiếu: Quotation `send`/`cancel`/`override`; SalesOrder `ship`/`deliver`/`override`/`cancel`; ProductionOrder `start`/`complete`; Payment `create` (ghi vào `SalesOrderTimeline`).
- Chuẩn hoá cách `createdBy`/tên hiển thị hoạt động cho action Manual Override/Cancel — bỏ ô nhập tay, dùng JWT (Quyết định 1).
- **Return module:** bổ sung `completedByName` + hiển thị `completedBy`/`completedByName` ở FE (hiện có lưu JWT đúng nhưng FE quên hiển thị).
- **QuotationItem.discountBy:** đổi từ free-text sang JWT, bỏ ô nhập tay "Người thực hiện" trong dialog thêm/sửa dòng.
- **MaterialReceipt.createdBy:** đổi từ free-text (đang luôn NULL) sang JWT.
- Cập nhật các trang FE đang render các field trên: `quotations/[id]/page.tsx`, `orders/[id]/page.tsx`, `production/[id]/page.tsx`, `returns/[id]/page.tsx`, `quotation-item-dialog.tsx`, `quotation-item-table.tsx`, `warehouse/receipts/[id]/page.tsx`.
- Backfill dữ liệu cũ: KHÔNG khả thi (bản ghi cũ đang NULL sẽ mãi mãi trống tên, không rewrite lịch sử) — bản ghi cũ đã có `createdBy = userId` thì tự hiển thị đúng tên sau khi thêm join, không cần backfill riêng.

## Ngoài phạm vi (đã xác nhận không đụng trong task này)

- **`Customer.createdBy`/`updatedBy`** — chưa từng được ghi (luôn NULL), dù schema có sẵn `@relation`. Đây là gap tính năng (thêm tracking mới), không phải sửa lỗi hiển thị — để task riêng.
- **`PricingRuleVersion`, `MaterialRequirementVersion`** — không có field "ai tạo version" nào — cùng lý do, để task riêng.
- **`PermissionAudit.changedBy`** — đã lưu đúng JWT nhưng không có màn hình FE nào hiển thị audit log này. Không xây UI mới trong task này (tương tự lý do Nhóm B — nếu cần xem log này thì làm 1 màn hình riêng, task khác).
- **`Quotation.createdBy`/`updatedBy`** — đã đúng JWT, nhưng không có UI nào hiển thị (chỉ dùng nội bộ tính hoa hồng) — không có gì để sửa.
- **`Payment.createdBy`** (`payment-table.tsx:64`) — free-text, FE không gửi nên luôn NULL — không phải Timeline, giữ nguyên như hiện tại.
- **`Return.receivedBy`** — **tuyệt đối không đụng**: đây là tên nhân viên phía khách hàng nhận lại hàng hoàn, không phải người dùng ERP đăng nhập — đổi sang JWT sẽ sai nghiệp vụ.
- Audit log chi tiết hơn (IP, user-agent...) — không có trong yêu cầu.

---

# Quyết định đã chốt (16/07/2026)

## Quyết định 1 — Ngữ nghĩa `createdBy` cho Manual Override / Cancel

**Bỏ ô nhập tay "Người thực hiện"** (`overrideBy`/`cancelledBy`) khỏi FE và DTO. `createdBy`/`createdByName` cho mọi action — kể cả Override/Cancel — đều lấy từ JWT (người đang đăng nhập thực hiện thao tác), nhất quán với các action còn lại. Không còn 2 ngữ nghĩa lẫn lộn.

- Xoá field `overrideBy` khỏi `OverrideQuotationDto`, `OverrideSalesOrderDto`.
- Xoá field `cancelledBy` khỏi `CancelSalesOrderDto`.
- Xoá ô input "Người thực hiện" + state `overrideBy` ở `quotations/[id]/page.tsx:161-164,675-681,752-754` và tương đương ở `orders/[id]/page.tsx` (nếu có).
- `payload.overrideBy` (đang lưu trong JSON payload của Quotation override, `quotation-workflow.service.ts:797`) — xoá theo, không còn nguồn để ghi.

## Quyết định 2 — Tên field mới trong schema

Chốt `createdByName` cho cả 3 model (đồng nhất `SalesOrder.ownerName`).

## Quyết định 3 — `@relation` tới `User`

Chốt **có `@relation`**, giống pattern `SalesOrder.owner` (`schema.prisma:911`), dùng `onDelete: SetNull` để vẫn xoá được User sau này mà không vỡ Timeline (`createdBy` tự về NULL, `createdByName` vẫn giữ nguyên tên đã snapshot).

---

# Quyết định kỹ thuật (áp dụng theo 3 quyết định trên)

- `createdByName String?` — snapshot tại thời điểm ghi timeline, dùng `user.name ?? user.email`, `null` nếu `userId` null hoặc user không tồn tại (dữ liệu cũ).
- `createdBy` thêm `@relation(fields: [createdBy], references: [id], onDelete: SetNull)` tới `User`, cho cả 3 model.
- Helper dùng chung `resolveActorName(prisma, userId)` để tránh lặp code lookup ở nhiều service (Quotation/SalesOrder/ProductionOrder) — đặt ở `common/` hoặc tương tự (xác định vị trí cụ thể khi code).
- Controller: thêm `@Req() req: { user?: { userId?: string } }` cho các endpoint còn thiếu (`send`, `cancel`, `override` (Quotation); `ship`, `deliver`, `override`, `cancel` (SalesOrder); `start`, `complete` (ProductionOrder)), truyền `userId` xuống service.
- FE: đổi `entry.createdBy` → `entry.createdByName` (giữ `createdBy` trong type nếu còn dùng chỗ khác, hoặc bỏ hẳn nếu không còn nơi nào đọc).

---

# Việc 1 — Schema & Migration

- [ ] `QuotationTimeline.createdByName` (`apps/api/prisma/schema.prisma:862-875`)
- [ ] `SalesOrderTimeline.createdByName` (`:1035-1049`)
- [ ] `ProductionOrderTimeline.createdByName` (`:1099-...`)
- [ ] `Return.completedByName` (cạnh `completedBy`, `:1312`) + `@relation` tới `User`
- [ ] `QuotationItem.discountByName` (cạnh `discountBy`, `:819`) + `@relation` tới `User`
- [ ] `MaterialReceipt.createdByName` (cạnh `createdBy`, `:1126`) + `@relation` tới `User`
- [ ] Tất cả field `createdBy`/`completedBy`/`discountBy` ở trên thêm `@relation(fields: [...], references: [id], onDelete: SetNull)` — đồng nhất Quyết định 3.
- [ ] `npx prisma migrate dev --name actor_name_snapshot`

---

# Việc 2 — Quotation module

File: `apps/api/src/quotation/quotation-workflow.service.ts`, `apps/api/src/quotation/quotation.controller.ts`

- [ ] `send()`, `cancel()`, `override()`: controller nhận `req.user`, service nhận `userId`, ghi `createdBy`/`createdByName` (JWT).
- [ ] `override()`: xoá field `overrideBy` khỏi `OverrideQuotationDto` và khỏi `payload` (`quotation-workflow.service.ts:788-800`) — không còn ô nhập tay, `createdBy`/`createdByName` lấy từ JWT như mọi action khác.
- [ ] `create()`, `recalculatePrices()`: bổ sung `createdByName` cạnh `createdBy` hiện có.
- [ ] `approve()` (`:1207-1218`): đã ghi `QuotationTimeline` (action `QUOTATION_APPROVED`) và đã nhận `userId` qua tham số (dùng để tính `ownerId`/`ownerName` của SalesOrder, biến gọi là `approverUserId`) — chỉ cần bổ sung `createdBy`/`createdByName` vào timeline này bằng chính `approverUserId` đã có sẵn, không cần sửa controller.

---

# Việc 3 — SalesOrder module

File: `apps/api/src/sales-order/sales-order.service.ts`, `apps/api/src/sales-order/sales-order.controller.ts`

- [ ] `ship()`, `deliver()`, `override()`, `cancel()`: thread `userId` từ controller (JWT), ghi `createdBy`/`createdByName`.
- [ ] `override()`: xoá field `overrideBy` khỏi `OverrideSalesOrderDto`. `cancel()`: xoá field `cancelledBy` khỏi `CancelSalesOrderDto`. Cả 2 không còn ô nhập tay, dùng JWT.
- [ ] `syncProductionProgress()` (actorType SYSTEM) — không cần `createdByName` (hệ thống tự chạy), giữ nguyên.

**Phát hiện bổ sung (khi rà lại lần 2) — thiếu 1 nơi ghi `SalesOrderTimeline`:** `apps/api/src/debt/debt.service.ts::createPayment()` (dòng 153-164) cũng ghi `SalesOrderTimeline` (action `PAYMENT_STATUS_CHANGED`, `actorType: USER`), và cũng đang dùng free-text `dto.createdBy` (từ `CreatePaymentDto.createdBy`, dòng 8) y hệt pattern `overrideBy`/`cancelledBy` — bỏ sót ở bản plan trước vì nằm ở module Công nợ (`debt/`), không phải `sales-order/`, dù ghi vào cùng 1 model `SalesOrderTimeline` đang trong phạm vi.

- [ ] `payment.controller.ts::create()`: thêm `@Req()`, truyền `userId` xuống `debtService.createPayment()`.
- [ ] `debt.service.ts::createPayment()`: dòng 153-164 — `createdBy`/`createdByName` của **dòng `SalesOrderTimeline`** đổi sang lấy từ JWT `userId` (nhất quán Quyết định 1), **không đụng** tới `Payment.createdBy` ở dòng 126 (field riêng của model `Payment`, giữ nguyên `dto.createdBy` free-text — model này nằm ngoài phạm vi, xem mục "Ngoài phạm vi").

---

# Việc 4 — ProductionOrder module

File: `apps/api/src/production/production-order.service.ts`, `apps/api/src/production/production-order.controller.ts`

- [ ] `start()`, `complete()`: thread `userId`, ghi `createdBy`/`createdByName`.
- [ ] Timeline SYSTEM-generated (VD `PRODUCTION_ORDER_CREATED` từ `quotation-workflow.service.ts:1186-1190`, `CANCELLED` cascade từ `sales-order.service.ts:379-386`) — giữ nguyên, không có actor USER.

---

# Việc 5 — Return module

File: `apps/api/src/return/return.service.ts`, `apps/api/src/return/return.controller.ts`

- [ ] `complete()` (`return.service.ts:112`): đã nhận `userId` từ JWT sẵn — bổ sung `completedByName` (lookup + snapshot) cạnh `completedBy` hiện có. Không cần sửa controller (đã có `@Req()`, xem `return.controller.ts:47-52`).
- [ ] **Không đụng `receivedBy`** — giữ nguyên free-text (tên nhân viên phía khách hàng), theo mục "Ngoài phạm vi".

---

# Việc 6 — QuotationItem.discountBy

File: `apps/api/src/quotation/quotation-workflow.service.ts` (`addItem()` dòng ~313-328, `updateItem()` dòng ~390-393,470-482), `apps/api/src/quotation/quotation.controller.ts` (`addItem`, `updateItem`)

- [ ] `addItem()`, `updateItem()`: controller thêm `@Req()`, service nhận `userId`, `discountBy`/`discountByName` lấy từ JWT thay vì `dto.discountBy` (chỉ ghi khi có chiết khấu bổ sung, giữ nguyên logic điều kiện hiện tại — `discountReason` vẫn theo `dto.discountReason` tự gõ như cũ, chỉ đổi phần "ai duyệt").
- [ ] Xoá field `discountBy` khỏi `CreateQuotationItemDto` (`:13`), `UpdateQuotationItemDto` (`:12`).

---

# Việc 7 — MaterialReceipt.createdBy

File: `apps/api/src/warehouse/warehouse.service.ts` (`createMaterialReceipt()` dòng ~81), `apps/api/src/warehouse/material-receipt.controller.ts` (`create()`)

- [ ] Controller thêm `@Req()`, truyền `userId` xuống `createMaterialReceipt()`.
- [ ] `createdBy`/`createdByName` lấy từ JWT thay vì `dto.createdBy` (field này FE chưa từng gửi nên không có input nào cần xoá).
- [ ] Xoá field `createdBy` khỏi `CreateMaterialReceiptDto` (`:10`).

---

# Việc 8 — FE: hiển thị tên

Files: `apps/web/src/app/quotations/[id]/page.tsx:60,728`, `apps/web/src/app/orders/[id]/page.tsx:96,614`, `apps/web/src/app/production/[id]/page.tsx:43,223`, `apps/web/src/app/returns/[id]/page.tsx`, `apps/web/src/components/quotation/quotation-item-dialog.tsx:384-390`, `apps/web/src/components/quotation/quotation-item-table.tsx`, `apps/web/src/app/warehouse/receipts/[id]/page.tsx:77-78`

- [ ] Đổi interface Timeline entry (Quotation/SalesOrder/ProductionOrder): thêm `createdByName: string | null`.
- [ ] Đổi phần render `— ${entry.createdBy}` → `— ${entry.createdByName}` ở cả 3 trang.
- [ ] `quotations/[id]/page.tsx:161-164,675-681,752-754`: xoá state `overrideBy`, ô input "Người thực hiện", và dòng hiển thị `payload.overrideBy` trong dialog Override.
- [ ] Kiểm tra `orders/[id]/page.tsx` có ô input tương tự cho Override/Cancel SalesOrder không — xoá đồng bộ nếu có.
- [ ] `returns/[id]/page.tsx`: thêm hiển thị `completedByName` (hiện chưa hiển thị `completedBy` gì cả — thêm mới, không phải sửa).
- [ ] `quotation-item-dialog.tsx:384-390`: xoá ô input "Người thực hiện" (`discountBy` free-text) — không còn cần nhập tay.
- [ ] `quotation-item-table.tsx`: nếu có render `discountBy` thì đổi sang `discountByName`.
- [ ] `warehouse/receipts/[id]/page.tsx:77-78`: đổi `receipt.createdBy` → `receipt.createdByName`.

---

# Việc 9 — Test & Build

- [ ] Unit test cho từng service: xác nhận `createdByName`/`completedByName`/`discountByName` được ghi đúng (mock `prisma.user.findUnique`), fallback `email` khi `name` null, `null` khi `userId` null.
- [ ] `tsc --noEmit` (api + web), `eslint`, `jest` các module liên quan.

---

# Việc 10 — Verify thực tế

- [ ] Đăng nhập, tạo báo giá → Lịch sử hoạt động hiện đúng tên tài khoản đang đăng nhập (không còn ID).
- [ ] Gửi/Huỷ/Override báo giá → mỗi dòng Timeline đều có tên người thao tác.
- [ ] Tương tự cho Đơn hàng (ship/deliver/override/cancel) và Phiếu sản xuất (start/complete).
- [ ] Hoàn thành 1 Return → trang chi tiết hiện đúng tên người hoàn thành, `receivedBy` vẫn hiển thị tên khách nhập tay như cũ (không đổi).
- [ ] Thêm dòng báo giá có chiết khấu bổ sung → hiện đúng tên người đang đăng nhập ở phần "người duyệt", không còn ô nhập tay.
- [ ] Tạo phiếu nhập kho → trang chi tiết hiện đúng tên người tạo thay vì "—".
