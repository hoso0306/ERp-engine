# Milestone (Sprint 04) - In Phiếu Sản Xuất (A5) + mẫu riêng theo xưởng

> **Tên file:** `workbench/sprint-04/009-in-phieu-san-xuat.md`
> **Trạng thái:** ✅ ĐÃ CODE — build/test sạch, đã verify một phần bằng in thật (Playwright `page.pdf()`); chưa verify qua trình duyệt có đăng nhập thật (không có credential Owner)

> **Ghi chú gộp file (19/07/2026):** File này gộp lại toàn bộ `009` → `019` (11 file) của cùng 1 mạch việc — tính năng in Phiếu sản xuất khổ A5. Các file cũ đã xoá vì phần lớn chỉ là các bước đi/quay đầu trung gian (nhiều file đè hoặc revert lẫn nhau), lịch sử chi tiết từng bước đã có trong git log. Nội dung dưới đây phản ánh **trạng thái thiết kế cuối cùng**, kèm 1 mục "Lịch sử thay đổi" tóm tắt các lần chỉnh/sửa lỗi quan trọng để không mất bài học.

---

# Bối cảnh

Luồng hiện tại: Báo giá (nhiều sản phẩm, nhiều xưởng) → gửi khách duyệt → ERP sinh Đơn hàng (Sales Order) → ERP chia thành các Phiếu sản xuất (Production Order) theo từng xưởng, quản lý ở tab "Chờ SX" (`/production`, tab `pending`).

Nhu cầu: in Phiếu sản xuất ra giấy khổ **A5** để phát tay cho từng xưởng làm hàng. Cùng một tờ giấy đó, khi hàng xong, được dùng luôn làm **phiếu giao hàng/xuất kho cho xe tải** — không làm phiếu giao hàng riêng. Sau đó phát sinh thêm nhu cầu: 2 xưởng (Cầu Vồng, Cửa Lưới) có mẫu giấy in riêng đang dùng thủ công, khác hẳn mẫu chung — cần làm đúng theo mẫu giấy thật của từng xưởng.

---

# Mục tiêu

Kế toán/quản đốc in được Phiếu sản xuất khổ A5 ngay từ ERP, đủ thông tin để: (a) xưởng biết làm gì, thông số nào, số lượng bao nhiêu; (b) tài xế biết giao cho ai, ở đâu, khi nào — kể cả khi cùng 1 khách hàng nhưng mỗi đơn giao một địa điểm khác nhau — mà không cần thêm module Giao hàng/Logistics riêng, không tạo thêm chứng từ mới. Với 2 xưởng có mẫu giấy riêng (Cầu Vồng, Cửa Lưới), bản in phải đúng theo mẫu giấy thật đang dùng ở xưởng.

---

# Thiết kế cuối cùng

## 1. Địa chỉ giao hàng trên Sales Order

Thiết kế ban đầu định đọc trực tiếp `Customer` hiện tại lúc in. Bị bác bỏ sau review: một `Customer` (đặc biệt khách doanh nghiệp) có thể có **nhiều địa chỉ giao khác nhau cho từng đơn**. Chốt theo đúng triết lý Section 7 CLAUDE.md: **snapshot tại thời điểm tạo, cho sửa qua Action riêng, không đọc lại Master Data**.

- `SalesOrder` có nhóm field riêng (`deliveryName`, `deliveryPhone`, `deliveryAddress`, `deliveryProvince`, `deliveryDistrict`, `deliveryWard`) — **auto copy từ `Customer`** tại thời điểm Approve. Từ đó về sau, đây là nguồn dữ liệu địa chỉ giao hàng duy nhất — **không đọc lại `Customer`**.
- **Cho sửa sau khi tạo** (khác các field tài chính/BOM bị khoá cứng) — địa chỉ giao là dữ liệu vận hành/logistics. Action riêng `POST /sales-orders/:id/update-delivery-address`, **không bắt buộc lý do**, **sửa được ở bất kỳ trạng thái nào**, dùng chung permission `sales-order.view`. Mọi lần sửa ghi `SalesOrderTimeline` (`DELIVERY_ADDRESS_UPDATED`) — giá trị cũ/mới, ai sửa, lúc nào.
- `Customer` không bao giờ bị đổi bởi thao tác này.
- Component dùng chung `apps/web/src/components/sales-order/delivery-address-dialog.tsx` — dùng ở cả `/orders/[id]`, `/production/[id]`, và `/production/print` (nút "Sửa" bọc `no-print`, không xuất hiện trên giấy in).

## 2. Cơ chế in chung (mọi xưởng)

- In theo **Production Order**, không theo Sales Order — 1 PO chỉ thuộc đúng 1 xưởng, mỗi xưởng nhận đúng 1 tờ A5. Đơn nhiều xưởng → in nhiều tờ riêng.
- Trang Next.js render HTML thuần + `window.print()` — không dùng `PdfService`/`pdfmake` (module đó chỉ phục vụ export bảng Report).
- Trang `/production/print?ids=a,b,c` — dùng chung cho in 1 phiếu lẫn in hàng loạt (checkbox chọn dòng ở bảng "Chờ SX" + nút "In đã chọn"; nút "In phiếu" ở trang chi tiết PO).
- Bấm "In / Tải PDF" → gọi `POST /production-orders/print` (ghi Timeline `PRINTED`, actorType `USER`) rồi mới `window.print()`. Chỉ xem trước (mở trang, chưa bấm in) thì **không** ghi Timeline.
- Không hiện giá bán/giá vốn trên phiếu (ranh giới "Production không quan tâm giá" — `production.md`).

## 3. Mẫu chung — `GenericOrderContent` (các xưởng KHÔNG có mẫu riêng)

- Khổ A5 dọc, viền mảnh xám, header bảng nền navy chữ trắng.
- Mỗi dòng sản phẩm: tên + mã + danh sách `parameters` dạng `label: valueLabel ?? value unit`, ghi chú dòng (`SalesOrderItem.note`).
- Cuối phiếu có 3 ô ký: "Xưởng giao / Tài xế nhận / Khách hàng nhận".

## 4. Mẫu riêng theo xưởng — `WorkshopOrderContent` (Cầu Vồng + Cửa Lưới)

### Nhận diện xưởng

`ProductionOrder` chỉ lưu snapshot `productionCenterId`/`productionCenterName`, không có quan hệ tới `ProductionCenter`. BE (`findOne()`/`print()`) tra thêm `ProductionCenter.code` theo `productionCenterId`, trả về field `productionCenterCode`. FE chọn `WorkshopOrderContent` khi:

- `productionCenterCode === 'XW004'` → Xưởng Cầu Vồng
- `productionCenterCode === 'XW001'` → Xưởng Cửa Lưới

Đây là rule đặc thù theo đúng 2 xưởng cụ thể của doanh nghiệp — không xây dựng cơ chế "mẫu in cấu hình được" cho N xưởng (chưa có nhu cầu, tránh tối ưu sớm).

⚠️ **Mã xưởng thật KHÔNG phải `XL01`/`XL02`/`XL03`** như ví dụ minh hoạ trong `knowledge/modules/production.md` — đó chỉ là ví dụ, không phải dữ liệu thật. Mã thật tra trực tiếp từ DB dev: `XW001` (Cửa Lưới), `XW004` (Cầu Vồng), `XW005` (Bạt), `XW006` (Hàng thuê gia công).

### Bố cục (không dựng cả phiếu bằng 1 bảng HTML — chỉ bảng sản phẩm mới dùng `<table>`)

1. **Header** (`display:grid`, 3 cột `1fr 2fr 1fr`, cân đối tuyệt đối):
   - Trái (9px, màu `#555`, chỉ để tra cứu): "Mã đơn hàng", "Mã phiếu SX".
   - Giữa: tiêu đề "PHIẾU SX - XUẤT KHO" (30px, 800) + phụ đề tên xưởng (15px = 50% tiêu đề, 700).
   - Phải (9px, `#555`): "Ngày đặt hàng", "Hạn giao hàng", "Xưởng".
2. **2 khung thông tin** (viền mảnh `0.75px solid #000`, không nền xám đầy, không bo góc/đổ bóng):
   - "Thông tin khách hàng": Tên KH **20px/800** (điểm nhấn lớn nhất khung), Địa chỉ/SĐT 11px thường. Đọc `SalesOrder.delivery*` — không đọc `Customer`.
   - "Thông tin giao hàng": Tên nhà xe **16px/700** (để trống, chưa lưu DB), SĐT/Ghi chú 11px (để trống) — 3 dòng chấm chấm cho xưởng ghi tay.
3. **Bảng sản phẩm** (`<table>` + `<colgroup>` width %): STT (5%) | Tên sản phẩm (39%) | RỘNG (11%) | CAO (11%) | SL (6%) | NHÔM (6%) | VẢI (6%) | ĐÓNG GÓI (7%) | GHI CHÚ (9%).
   - Header cột chỉ ghi "RỘNG"/"CAO" — **không** kèm "(mm)".
   - **Gộp dòng:** chỉ merge (`rowSpan`) cột "Tên sản phẩm"; STT/RỘNG/CAO/SL luôn hiển thị riêng từng dòng, không merge.
   - **Điều kiện gộp khác nhau theo xưởng** (`groupKeyFor(productionCenterCode)`):
     - Cầu Vồng: gộp khi cùng `productCode`.
     - Cửa Lưới: gộp khi cùng **cả** `productCode` **lẫn** toàn bộ thông số khác Rộng/Cao (dùng chính `otherParamsText()` làm 1 phần khoá gộp — đảm bảo dòng mô tả hiển thị luôn đúng cho mọi dòng trong nhóm).
   - Ô "Tên sản phẩm" (khi gộp, hiển thị 1 lần cho cả nhóm): dòng 1 = tên sản phẩm (9.5px/500, màu `#444`, nhạt); dòng 2 = mô tả ngắn (13px/700, đậm, nổi bật hơn tên) — tối đa 1 dòng (`white-space:nowrap` + `text-overflow:ellipsis`), không in cả đoạn cấu hình dài, không hiện `productCode` hay "(N bộ)".
   - RỘNG/CAO: `paramValue(item, "chieurong"/"chieucao")` — số **rất lớn** (15px/800, ~36% to hơn ô thường 11px), lấy nguyên giá trị mét đã lưu, **không quy đổi mm, không kèm đơn vị**.
   - NHÔM/VẢI/ĐÓNG GÓI: **luôn để trống** — chỉ là ô checklist cho xưởng tự ghi tay/tick, không đọc từ bất kỳ dữ liệu nào (không phải BOM/Material).
   - GHI CHÚ: `SalesOrderItem.note` của từng dòng.
   - Dòng "TỔNG CỘNG": tổng `quantity` toàn bộ dòng.
4. **Footer**: dòng "Lưu ý" cố định (8px, in nghiêng) — **không có ô ký tên** (khác mẫu chung).

### `otherParamsText()` — dòng mô tả dưới tên sản phẩm

```ts
function otherParamsText(item) {
  return item.parameters
    .filter(p => p.name !== "chieurong" && p.name !== "chieucao")
    .map(p => {
      const display = p.valueLabel ?? p.value; // ưu tiên nhãn ENUM, rơi về mã gốc
      return p.unit ? `${display} ${p.unit}` : display;
    })
    .join(", ");
}
```

Chỉ hiện **giá trị** (+ đơn vị nếu có), **không kèm nhãn tham số** (bỏ "Loại cửa:", "Số cánh:", "Màu khung:"...). Nếu sản phẩm không có thông số nào khác Rộng/Cao (vd Rèm ở Cầu Vồng) → để trống hẳn, không có fallback giả.

### Phong cách hiển thị

Giống phiếu in laser của xưởng, không giống website: viền mảnh `0.75px solid #000` (không phải viền đậm), không card, không bo góc, không đổ bóng, header bảng nền xám nhạt (`#f0f0f0`) chữ đen đậm (không phải navy/trắng như mẫu chung), khoảng trắng đều, phân cấp cỡ chữ rõ ràng — tối ưu đọc từ 1-2 mét (đặc biệt Rộng/Cao và Tên khách hàng).

### Khổ giấy A5 ngang

CSS "named page" (`@page <tên> {...}` + `page: <tên>` gán theo class) **không hoạt động** trên Chromium thật (verify bằng Playwright `page.pdf()`, kể cả với `preferCSSPageSize: true`). Thay bằng: tính **1 khổ giấy duy nhất cho cả lượt in**, ngay trong `ProductionOrderPrintContent`, dựa theo danh sách phiếu đang in — có ít nhất 1 phiếu thuộc mẫu xưởng (Cầu Vồng/Cửa Lưới) → cả lượt in dùng A5 **ngang** (`210 x 148mm`); ngược lại giữ A5 **dọc** như mẫu chung.

```ts
const anyWorkshopTicket = orders.some(o => o.productionCenterCode === 'XW004' || o.productionCenterCode === 'XW001');
const pageCss = anyWorkshopTicket
  ? "@page { size: A5 landscape; margin: 8mm 10mm; }"
  : "@page { size: A5; margin: 10mm 9mm 10mm 9mm; }";
```

**Đánh đổi đã biết:** in gộp trong CÙNG 1 lượt vừa có phiếu mẫu xưởng vừa có phiếu xưởng khác sẽ dùng chung 1 khổ giấy (ưu tiên ngang) — không tách khổ theo từng trang được (browser không hỗ trợ đáng tin cậy).

## 5. Sidebar/Header không hiện khi in

Bug hệ thống có sẵn (ảnh hưởng cả `/quotations/[id]/print` đã có từ trước, không phải do milestone này gây ra, chỉ mới lộ ra khi lần đầu verify bằng in thật): `AppLayout` chỉ bỏ qua sidebar cho route `/login`, khiến sidebar luôn in kèm, đẩy nội dung phiếu bị cắt bên phải. Đã sửa:

```tsx
// apps/web/src/components/layout/app-layout.tsx
if (pathname === "/login" || pathname.endsWith("/print")) {
  return <>{children}</>;
}
```

## 6. Thông tin nhà xe — sửa được ở khối "Thông tin giao hàng"

Bổ sung sau khi khối "Thông tin khách hàng" đã có nút "Sửa" (`DeliveryAddressDialog`) — người dùng yêu cầu thêm nút tương tự cho "Thông tin giao hàng" (nhà xe). Trước đó 3 dòng Tên nhà xe/SĐT/Ghi chú chỉ để trống in ra giấy, không lưu DB (quyết định cũ ở mục "Mẫu riêng theo xưởng"). Nay đảo lại quyết định đó: thêm 3 field thật.

- `SalesOrder` có thêm `carrierName`, `carrierPhone`, `carrierNote` (tất cả nullable) — **KHÁC nhóm `delivery*`**: đây là nhà xe/tài xế chở hàng, không phải người/nơi nhận hàng. Không có nguồn Master Data nào để auto-copy (khác `delivery*` copy từ `Customer` lúc Approve) — mặc định `NULL`, nhập tay khi đã sắp xe.
- Action riêng `POST /sales-orders/:id/update-carrier-info` — cùng cơ chế với `update-delivery-address`: không phải Manual Override, không đổi Status, **không field nào bắt buộc**, sửa được ở mọi Status, dùng chung permission `sales-order.view`. Ghi `SalesOrderTimeline` (`CARRIER_INFO_UPDATED`, payload `{old, new}`).
- Component `CarrierInfoDialog` (`apps/web/src/components/sales-order/carrier-info-dialog.tsx`) mirror `DeliveryAddressDialog` — nút "Sửa" đặt cạnh dòng Tên nhà xe trong khối "Thông tin giao hàng" ở `WorkshopOrderContent` (chỉ 2 mẫu xưởng Cầu Vồng/Cửa Lưới có khối này; mẫu chung không có).
- Khi có giá trị: hiện trực tiếp (Tên nhà xe 16px/700 giống Tên KH; SĐT/Ghi chú 11px). Khi trống: vẫn hiện dòng chấm chấm để viết tay (giữ tương thích ngược cho đơn chưa nhập).
- Nhãn Timeline `CARRIER_INFO_UPDATED`: "Cập nhật thông tin nhà xe" — thêm vào `TIMELINE_LABEL` ở `/orders/[id]/page.tsx` (Timeline của Sales Order hiển thị ở đó, không phải trang Production).
- Verify bằng Playwright (click "Sửa" → điền form → lưu → đọc lại): toast thành công, giá trị hiện đúng ngay trên phiếu sau khi lưu.

## 7. Snapshot nhãn hiển thị tham số ENUM — `valueLabel`

Với tham số kiểu ENUM (loại cửa, màu khung...), `value` snapshot trên đơn là **mã nội bộ** (`cuaso`, `van_go`) — không phải nhãn hiển thị (`Cửa sổ`, `Vân gỗ`). Nhãn nằm ở `ProductParameterOption.label` (Master Data), đọc lại lúc in sẽ vi phạm nguyên tắc Snapshot. Giải pháp: thêm field `valueLabel String?` vào cả `QuotationItemParameter` và `SalesOrderItemParameter` (migration `20260719140955_add_parameter_value_label`):

- `QuotationWorkflowService.addItem()`/`updateItem()`: resolve `valueLabel` từ `ProductParameterOption` khớp `value` tại thời điểm thêm/sửa dòng báo giá (hàm `resolveValueLabel()`).
- `QuotationWorkflowService.approve()`: copy nguyên `valueLabel` đã snapshot sang `SalesOrderItemParameter` — **không tra lại Master Data lần nữa**.
- `value` giữ nguyên mã gốc (Pricing Engine/BOM Engine vẫn đọc field này để tính toán) — `valueLabel` CHỈ phục vụ hiển thị.

**Giới hạn:** đơn hàng cũ (tạo trước migration) sẽ mãi hiện mã thô (`valueLabel = NULL`, không backfill — đúng bản chất Snapshot bất biến).

---

# Bài học quan trọng

**Ví dụ minh hoạ trong `knowledge/modules/*.md` KHÔNG phải giá trị thật** — gặp lặp lại 2 lần trong milestone này:

1. Mã xưởng ví dụ `XL01/XL02/XL03` (trong `production.md`) ≠ mã thật `XW001/XW004/XW005/XW006` trong DB.
2. Tên tham số ví dụ `width`/`height` (trong `product.md`) ≠ tên thật `chieurong`/`chieucao` dùng cho **100% sản phẩm hiện có**.

Bug #2 khiến cột RỘNG/CAO hiển thị trống ("—") xuyên suốt nhiều vòng code mà không ai phát hiện, vì chỉ kiểm bằng `tsc`/`next build` (không lỗi biên dịch) chứ chưa từng chạy thử với dữ liệu thật. **Bài học: trước khi hardcode bất kỳ mã/tên field nào tham chiếu tới dữ liệu nghiệp vụ thật, phải tra thẳng DB dev — không suy đoán theo ví dụ trong tài liệu.**

---

# Phạm vi

## Trong phạm vi

- Migration: `delivery*` + `carrierName`/`carrierPhone`/`carrierNote` trên `SalesOrder`; `DELIVERY_ADDRESS_UPDATED`/`CARRIER_INFO_UPDATED`/`PRINTED` timeline actions; `valueLabel` trên `QuotationItemParameter`/`SalesOrderItemParameter`.
- BE: snapshot địa chỉ giao hàng tại Approve; action `update-delivery-address` + `update-carrier-info`; `GET /production-orders/:id` trả `salesOrder.delivery*`/`carrier*`/`createdAt`/`productionCenterCode`; `POST /production-orders/print`; `resolveValueLabel()` ở Quotation module.
- FE: khối "Địa chỉ giao hàng" + dialog sửa (dùng ở 3 nơi); khối "Thông tin giao hàng" (nhà xe) + dialog sửa (`CarrierInfoDialog`, dùng ở mẫu in riêng xưởng); trang `/production/print` (mẫu chung + mẫu riêng 2 xưởng); nút in đơn/in hàng loạt; nhãn Timeline mới.
- FE: `AppLayout` bỏ sidebar cho mọi route `/print`.
- Tài liệu: `order.md` (địa chỉ giao hàng), tài liệu này.

## Ngoài phạm vi

- Không tạo module Giao hàng/Logistics riêng, không thêm bảng chứng từ giao hàng mới.
- Không thêm trạng thái mới cho `ProductionOrder`/`SalesOrder` (in và sửa địa chỉ chỉ ghi Timeline).
- Không cho sửa địa chỉ giao hàng ở Quotation (chỉ ở Sales Order).
- Không đụng Kho (đang tạm gỡ khỏi triển khai).
- Không hiện giá bán/giá vốn trên phiếu.
- Không đọc BOM/Material cho cột Nhôm/Vải/Đóng gói.
- Không xây dựng cơ chế cấu hình mẫu in theo N xưởng — hard-code đúng 2 mã `XW004`/`XW001`.
- Không backfill `valueLabel` cho dữ liệu cũ.
- Không thêm permission mới (dùng lại `sales-order.view`/`production.view`).

---

# Lịch sử thay đổi (tóm tắt, chi tiết xem git log)

| Giai đoạn | Nội dung |
|---|---|
| Vòng 1-2 (18/07) | Milestone gốc: `delivery*` trên SalesOrder, Timeline `PRINTED`, trang in A5 chung, in đơn/in hàng loạt. |
| Mẫu riêng Cầu Vồng | Thêm nhánh layout riêng theo mẫu giấy gửi — **lần 1 dùng nhầm mã xưởng ví dụ `XL03`**. |
| Mẫu riêng Cửa Lưới | Thêm mẫu riêng thứ 2 — người dùng báo "in vẫn ra phiếu cũ" → tra DB phát hiện mã thật là `XW001`/`XW004`, sửa lại cả 2. |
| Hợp nhất | Người dùng yêu cầu 2 mẫu dùng chung 1 cơ chế (gộp dòng theo Cầu Vồng, tiêu đề theo Cửa Lưới) + chuyển A5 ngang (cơ chế named-page ban đầu). |
| Điều kiện gộp riêng | Thử tách lại: Cửa Lưới gộp khi khớp cả mã + thông số khác. |
| Revert rồi xác nhận lại | Đối chiếu ảnh gốc kỹ hơn → tưởng phải bỏ gộp hoàn toàn cho Cửa Lưới, nhưng người dùng xác nhận **giữ logic gộp có điều kiện** như trên, chỉ chỉnh giao diện. |
| 2 vòng thiết kế lại giao diện | Từ viền đậm/màu → viền mảnh, bố cục "tư duy phiếu giấy xưởng" (không dùng 1 bảng HTML cho cả phiếu), phân cấp cỡ chữ rõ (Rộng/Cao/Tên khách lớn). |
| Fix tên tham số | Phát hiện `width`/`height` sai — tên thật `chieurong`/`chieucao` — bug tồn tại từ đầu, chỉ phát hiện khi tra dữ liệu thật. |
| Verify bằng Playwright | Cài Playwright tạm (scratchpad), tạo JWT hợp lệ test không cần credential thật — phát hiện + fix cơ chế khổ giấy named-page không hoạt động, và bug sidebar hiện khi in (ảnh hưởng cả in Báo giá). |
| Chỉnh mô tả sản phẩm | Giảm cỡ tên sản phẩm, tăng cỡ+đậm mô tả, bỏ nhãn tham số — phát hiện mã ENUM thô chưa dịch được → thêm `valueLabel` snapshot (module Quotation). |
| Gộp workbench | Gộp 11 file `009`→`019` thành 1 file duy nhất (file này). |
| Thông tin nhà xe | Đảo quyết định cũ ("không thêm field nhà xe") — thêm `carrier*` trên `SalesOrder` + action + dialog sửa, mirror đúng pattern `delivery*`. |

---

# Trình tự thực hiện & Test

- [x] Migration + BE + FE cho địa chỉ giao hàng, Timeline `PRINTED`, trang in chung.
- [x] Mẫu riêng Cầu Vồng + Cửa Lưới: nhận diện xưởng, bố cục, gộp dòng có điều kiện, phong cách phiếu giấy, A5 ngang.
- [x] Fix sidebar khi in (`app-layout.tsx`).
- [x] Fix tên tham số kích thước (`chieurong`/`chieucao`).
- [x] `valueLabel` snapshot nhãn ENUM (schema + BE + FE + 3 test mới).
- [x] Thông tin nhà xe: `carrier*` trên `SalesOrder`, action `update-carrier-info`, `CarrierInfoDialog`, nhãn Timeline `CARRIER_INFO_UPDATED` (+ 3 test mới).
- [x] Unit test: `sales-order.service.spec.ts` (`updateDeliveryAddress`, `updateCarrierInfo`), `production-order.service.spec.ts` (`print()`, `productionCenterCode`), `quotation-workflow.service.spec.ts` (`resolveValueLabel`).
- [x] `tsc --noEmit` + `nest build` + `next build` sạch (cả 2 app). Toàn bộ 275 test API pass.
- [x] Verify bằng in thật (Playwright `page.pdf()`, JWT tự ký cho `owner@erp.local`, không cần credential thật): PO thật Xưởng Cửa Lưới ra đúng 1 trang A5 ngang, không cắt chữ, RỘNG/CAO đúng số liệu, gộp dòng đúng logic, sidebar đã biến mất.
- [x] Verify luồng "Thông tin giao hàng" bằng Playwright thật (click "Sửa" → điền form → submit): toast "Đã cập nhật thông tin nhà xe", giá trị hiện đúng ngay trên phiếu.
- [ ] Verify qua trình duyệt có đăng nhập thật (chưa có credential Owner) — cần người dùng tự mở `/production/print?ids=...` để xác nhận cuối cùng, đặc biệt với đơn MỚI tạo sau migration `valueLabel` (chưa có dữ liệu thật để thấy nhãn ENUM chạy end-to-end, chỉ mới verify fallback trên đơn cũ).
