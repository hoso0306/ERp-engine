# Milestone (Sprint 04) - Địa chỉ giao hàng trên Đơn hàng + In Phiếu Sản Xuất kiêm Phiếu Giao Hàng (A5)

> **Tên file:** `workbench/sprint-04/009-in-phieu-san-xuat.md`
> **Trạng thái:** 📝 KẾ HOẠCH — CHỜ XÁC NHẬN (chưa code)

---

# Bối cảnh

Luồng hiện tại: Báo giá (nhiều sản phẩm, nhiều xưởng) → gửi khách duyệt → ERP sinh Đơn hàng (Sales Order) → ERP chia thành các Phiếu sản xuất (Production Order) theo từng xưởng, quản lý ở tab "Chờ SX" (`/production`, tab `pending`).

Nhu cầu mới từ doanh nghiệp: in Phiếu sản xuất ra giấy khổ **A5** để phát tay cho từng xưởng làm hàng. Cùng một tờ giấy đó, khi hàng xong, được dùng luôn làm **phiếu giao hàng/xuất kho cho xe tải** — không làm phiếu giao hàng riêng.

## Vòng 1 (chốt 18/07/2026) — thiết kế in

1. **In theo Production Order, không theo Sales Order.** Một PO chỉ thuộc đúng 1 xưởng (`production.md`) — mỗi xưởng nhận đúng 1 tờ A5 cho phần việc của mình. Nếu 1 đơn hàng có nhiều xưởng, in nhiều tờ riêng, tài xế cầm đủ các tờ khi gom hàng đi giao.
2. **Cách in:** trang Next.js render HTML thuần + `window.print()`, tái dùng đúng pattern đã có ở `/quotations/[id]/print` (chỉ đổi `@page { size: A5 }`). Không dùng `PdfService`/`pdfmake` (module đó chỉ phục vụ export bảng cho Report, không hợp layout chứng từ có chữ ký).
3. **In hàng loạt:** ngoài nút "In phiếu" ở trang chi tiết PO, bảng danh sách "Chờ SX" có checkbox chọn nhiều dòng + nút "In đã chọn" để in gộp nhiều phiếu (mỗi phiếu 1 trang A5) trong một lần thao tác.
4. **Ghi vết:** mỗi lần bấm in (đơn hoặc hàng loạt) ghi 1 dòng `ProductionOrderTimeline` mới, action `PRINTED`, actorType `USER` — biết đã in lúc nào, ai in.

## Vòng 2 (chốt 18/07/2026, sau review) — địa chỉ giao hàng

Thiết kế ban đầu ở Vòng 1 định đọc trực tiếp `Customer` hiện tại lúc in. Bị bác bỏ sau review: một `Customer` (đặc biệt khách doanh nghiệp) có thể có **nhiều địa chỉ giao khác nhau cho từng đơn** (ví dụ mỗi đơn giao một công trình khác nhau — Times City, Royal City, Ecopark…). `Customer.address` chỉ là địa chỉ mặc định, không đủ biểu diễn việc này. Chốt lại theo đúng triết lý Section 7 CLAUDE.md (đã áp dụng cho giá bán): **snapshot tại thời điểm tạo, cho sửa qua Action riêng, không đọc lại Master Data**.

1. **`SalesOrder` có nhóm field địa chỉ giao hàng riêng** (`deliveryName`, `deliveryPhone`, `deliveryAddress`, `deliveryProvince`, `deliveryDistrict`, `deliveryWard`) — **auto copy từ `Customer`** tại thời điểm Approve (cùng lúc snapshot `customerName`/`customerPhone` hiện có). Từ đó về sau, đây là nguồn dữ liệu địa chỉ giao hàng duy nhất cho đơn — **không đọc lại `Customer`**.
2. **Cho sửa sau khi tạo** — khác với các field tài chính/BOM/thông số bị khoá cứng ở `order.md` (mục "Khi cập nhật"). Lý do: địa chỉ giao là dữ liệu vận hành/logistics, không phải dữ liệu đã tính toán/chốt giá — bản chất khác nhóm bị khoá. Action riêng `update-delivery-address`, **không bắt buộc lý do** (khác Manual Override — đây không phải đổi trạng thái, không cần giải trình), **sửa được ở bất kỳ trạng thái nào** của đơn (kể cả sau SHIPPED/DELIVERED — để còn sửa lại hồ sơ nếu cần), dùng chung permission `sales-order.view` (không thêm permission mới). Mọi lần sửa ghi vào `SalesOrderTimeline` (action mới `DELIVERY_ADDRESS_UPDATED`) — giá trị cũ, giá trị mới, ai sửa, lúc nào. Không sửa data âm thầm.
3. **Customer không bao giờ bị đổi bởi thao tác này** — sửa địa chỉ giao hàng chỉ tác động `SalesOrder` hiện tại, hoàn toàn tách biệt khỏi `Customer.address` (địa chỉ mặc định cho các đơn *sau này*).
4. Phiếu sản xuất/giao hàng A5 đọc `SalesOrder.delivery*` — không đọc `Customer` nữa.

---

# Mục tiêu

Kế toán/quản đốc in được Phiếu sản xuất khổ A5 ngay từ ERP, đủ thông tin để: (a) xưởng biết làm gì, thông số nào, số lượng bao nhiêu; (b) tài xế biết giao cho ai, ở đâu, khi nào — kể cả khi cùng 1 khách hàng nhưng mỗi đơn giao một địa điểm khác nhau — mà không cần thêm module Giao hàng/Logistics riêng, không tạo thêm chứng từ mới.

---

# Phạm vi

## Trong phạm vi

- Migration: thêm 6 field `delivery*` vào `SalesOrder`; thêm `DELIVERY_ADDRESS_UPDATED` vào `SalesOrderTimelineAction`; thêm `PRINTED` vào `ProductionOrderTimelineAction`.
- BE: snapshot 6 field `delivery*` (auto copy từ `Customer`) tại đúng chỗ Sales Order được sinh từ Quotation Approved.
- BE: action `POST /sales-orders/:id/update-delivery-address` — sửa 6 field, ghi Timeline, không giới hạn status, không bắt buộc lý do, permission `sales-order.view`.
- BE: `GET /production-orders/:id` trả thêm `salesOrder.delivery*` + `expectedDeliveryDate` (mở rộng `select`, không cần join `Customer` nữa).
- BE: endpoint mới `POST /production-orders/print` (`{ ids: string[] }`) — ghi Timeline `PRINTED` cho từng PO, trả dữ liệu đầy đủ để FE render.
- FE: trang chi tiết Đơn hàng (`/orders/[id]`) — khối "Địa chỉ giao hàng" hiển thị + dialog sửa (gọi action mới).
- FE: trang in `/production/print?ids=...` (khổ A5), dùng chung cho in 1 phiếu lẫn in nhiều phiếu.
- FE: nút "In phiếu" ở trang chi tiết PO (`/production/[id]`).
- FE: checkbox chọn dòng + nút "In đã chọn" ở bảng "Chờ SX" (`ProductionTable`/`/production`).
- FE: nhãn Timeline mới — `PRINTED` (trang PO), `DELIVERY_ADDRESS_UPDATED` (trang Đơn hàng).
- Tài liệu: cập nhật `order.md` — thêm mục dữ liệu `delivery*`, action `update-delivery-address`, và ghi rõ ràng ranh giới với "Immutable Document" (địa chỉ giao hàng là ngoại lệ có chủ đích, không phải lỗ hổng).

## Ngoài phạm vi

- Không tạo module Giao hàng/Logistics riêng, không thêm bảng chứng từ giao hàng mới — tận dụng đúng `SalesOrder`/Production Order sẵn có.
- Không thêm trạng thái mới cho `ProductionOrder` hay `SalesOrder` (in và sửa địa chỉ đều không phải Action đổi Status — chỉ ghi Timeline).
- Không cho sửa địa chỉ giao hàng ở Quotation (chỉ ở Sales Order — báo giá chưa chốt, chưa cần).
- Không đụng tới Kho — Kho đang tạm gỡ khỏi triển khai (`warehouse.md`), phiếu này không liên quan tồn kho/xuất kho nguyên liệu.
- Không hiện giá bán/giá vốn trên phiếu (đúng ranh giới "Production không quan tâm giá" — `production.md`).
- Không thêm permission mới cho cả 2 action (`update-delivery-address` dùng `sales-order.view`, in PO dùng `production.view`).

---

# Trình tự thực hiện

## Việc 1 — Backend: địa chỉ giao hàng trên Sales Order

- [ ] Migration: thêm `deliveryName`, `deliveryPhone`, `deliveryAddress`, `deliveryProvince`, `deliveryDistrict`, `deliveryWard` (String, nullable trừ name/phone) vào `SalesOrder`; thêm `DELIVERY_ADDRESS_UPDATED` vào enum `SalesOrderTimelineAction`.
- [ ] Nơi tạo `SalesOrder` từ Quotation Approved: auto-copy 6 field trên từ `Customer` tại thời điểm đó (cùng chỗ đang copy `customerName`/`customerPhone`).
- [ ] DTO `UpdateDeliveryAddressDto` (validate `deliveryName`/`deliveryPhone` bắt buộc, còn lại optional).
- [ ] `sales-order.service.ts`: method `updateDeliveryAddress(id, dto, userId)` — update field, ghi `SalesOrderTimeline` (`DELIVERY_ADDRESS_UPDATED`, actorType `USER`, payload `{ old: {...}, new: {...} }`), không kiểm tra status.
- [ ] `sales-order.controller.ts`: `POST /sales-orders/:id/update-delivery-address`, permission `sales-order.view`.
- [ ] Cập nhật `knowledge/modules/order.md`: thêm field vào "Dữ liệu quản lý", thêm action vào "Workflow Engine", nói rõ ngoại lệ trong "Immutable Document".

## Việc 2 — Frontend: hiển thị + sửa địa chỉ giao hàng

- [ ] `/orders/[id]/page.tsx`: khối "Địa chỉ giao hàng" (tên/SĐT/địa chỉ) + nút "Sửa".
- [ ] Dialog sửa 6 field, gọi `POST .../update-delivery-address`, refetch sau khi lưu.
- [ ] Nhãn Timeline `DELIVERY_ADDRESS_UPDATED`: "Cập nhật địa chỉ giao hàng" (hiện giá trị cũ → mới từ payload).

## Việc 3 — Backend: nền dữ liệu + Timeline PRINTED cho Phiếu sản xuất

- [ ] Migration: thêm giá trị `PRINTED` vào enum `ProductionOrderTimelineAction`.
- [ ] `production-order.service.ts`: mở rộng `PRODUCTION_ORDER_INCLUDE.salesOrder.select` thêm `deliveryName`, `deliveryPhone`, `deliveryAddress`, `deliveryProvince`, `deliveryDistrict`, `deliveryWard`, `expectedDeliveryDate`.

## Việc 4 — Backend: endpoint in

- [ ] `POST /production-orders/print`, DTO `{ ids: string[] }`, permission `production.view`.
- [ ] Với từng `id`: validate tồn tại, ghi 1 dòng `ProductionOrderTimeline` (`PRINTED`, actorType `USER`, payload rỗng).
- [ ] Trả về mảng dữ liệu đầy đủ từng PO (items + parameters + `salesOrder.delivery*`) để FE render nhiều trang A5 từ đúng 1 lần gọi API.
- [ ] Cập nhật `TIMELINE_LABEL` phía FE (`/production/[id]/page.tsx`) thêm `PRINTED: "Đã in phiếu"`.

## Việc 5 — Frontend: trang in A5

- [ ] Trang mới `/production/print/page.tsx`, đọc `ids` từ query string (`?ids=a,b,c`).
- [ ] Gọi `POST /production-orders/print` khi bấm nút "In / Tải PDF" (ghi Timeline trước, rồi `window.print()`) — không tự ghi Timeline khi chỉ mở trang xem trước.
- [ ] Mỗi PO 1 khối nội dung riêng, ngắt trang bằng `page-break-after: always`; `@page { size: A5; margin: ... }`.
- [ ] Nội dung mỗi trang: mã PO / mã SO / xưởng / ngày in — khách hàng (`deliveryName`, `deliveryPhone`, `deliveryAddress`/`deliveryDistrict`/`deliveryProvince`, ngày giao dự kiến) — bảng sản phẩm (tên, mã, thông số kỹ thuật, số lượng, ghi chú dòng từ `SalesOrderItem.note`) — 3 ô ký: Xưởng giao / Tài xế nhận / Khách hàng nhận.
- [ ] Không hiện giá bán/giá vốn.

## Việc 6 — Frontend: nút in đơn + in hàng loạt

- [ ] Trang chi tiết PO (`/production/[id]/page.tsx`): thêm nút "In phiếu" → mở tab mới `/production/print?ids=<id>`.
- [ ] `ProductionTable`: thêm cột checkbox, state chọn dòng (giữ ở component cha `/production/page.tsx`).
- [ ] Thanh hành động khi có dòng được chọn: nút "In đã chọn (n)" → mở `/production/print?ids=<...>`.

## Việc 7 — Test + Verify

- [ ] Unit test `sales-order.service.spec.ts`: `updateDeliveryAddress` ghi đúng Timeline (old/new), không đổi status, sửa được ở mọi status.
- [ ] Unit test `production-order.service.spec.ts`: endpoint `print` ghi đúng Timeline, không đổi `status`.
- [ ] `tsc --noEmit` + `nest build` + `next build` sạch.
- [ ] Verify sống: duyệt báo giá → kiểm tra `SalesOrder` có đủ `delivery*` đúng bằng `Customer` tại thời điểm đó; sửa địa chỉ giao hàng trên đơn → Timeline ghi đúng cũ/mới; in 1 phiếu từ trang chi tiết; in nhiều phiếu từ danh sách "Chờ SX" (đơn hàng có ≥2 xưởng); kiểm tra Timeline PO ghi đúng `PRINTED` sau mỗi lần in; bản in A5 hiển thị đúng địa chỉ giao đã sửa (không phải địa chỉ mặc định của Customer nếu 2 cái khác nhau), đúng thông số/số lượng, không lộ giá.

---

# Ghi chú thực hiện

Khối lượng nhỏ — 1 milestone, không cần chia cụm dừng giữa chừng như Báo cáo (008). Thực hiện tuần tự Việc 1 → 7, xong thì báo cáo tổng kết theo đúng mục 11 CLAUDE.md.

**Đang dừng ở đây, chờ lệnh bắt đầu code.**
