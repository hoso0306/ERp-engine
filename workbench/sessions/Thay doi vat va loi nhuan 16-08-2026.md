# Đổi quy ước giá bán sang "đã bao gồm VAT" (bỏ cộng VAT thêm)

**Trạng thái: KẾ HOẠCH — chưa triển khai, đang chờ người dùng duyệt.**

*(Gồm 2 phần: Phần 1 — đổi logic backend (Pricing/Quotation/Debt/VAT
Settlement) + lợi nhuận; Phần 2 — bản in báo giá, làm SAU Phần 1 vì phụ thuộc
số đã sửa ở backend. Việc sửa bản in trước đó bị gác lại vì lúc đó chưa rõ
hướng đổi backend — giờ đã gộp lại thành 1 kế hoạch duy nhất, xem Phần 2 cuối
file.)*

**Lưu ý cho người/phiên làm việc tiếp theo:** trước khi sửa bất kỳ file nào ở
dưới, **đọc lại đúng đoạn code thật tại số dòng ghi trong plan** — số dòng có
thể đã lệch nếu có commit khác chen vào giữa lúc plan này được viết và lúc bắt
tay vào code. Đối chiếu đúng nội dung đoạn code trích dẫn trong plan với code
thật trước khi sửa, đừng tin số dòng 100%.

## Thứ tự thực hiện (Phần 1 trước, Phần 2 sau — không làm song song)

1. Sửa `calcVatAmount()` (mục 1) — công thức gốc, mọi nơi khác gọi tới đây.
2. Sửa `pricing-calc.helpers.ts` (mục 2) — bản copy, sửa ngay sau để khỏi quên.
3. Sửa `approve()`: `grandTotal`/`totalAmountBeforeVat`/message lỗi dòng
   1591-1594 (mục 3) — **cùng lúc sửa luôn `plannedProfit`** (mục 8, cùng hàm
   `approve()`, cùng 1 lần sửa file cho gọn).
4. Sửa `discount()` cap check (mục 4).
5. Sửa `previewPrice()` (mục 5).
6. Sửa `findAll()` — thêm select `vatAmount`, trừ vào `profit` (mục 6).
7. Sửa `getCostSummary()` (mục 7).
8. Sửa FE `quotation-item-dialog.tsx` (mục 9).
9. Sửa FE `quotation-item-table.tsx` — cả 2 chỗ, mục 10 và mục 11.
10. Chạy phần "Kiểm tra" của Phần 1 (script số thật + `tsc`/`eslint`).
11. Backup + deploy Phần 1 lên VPS, verify lại trên production.
12. **Chỉ sau khi Phần 1 đã chạy ổn trên VPS** mới bắt đầu Phần 2 (bản in) —
    làm theo đúng mục 1/2/3 trong Phần 2, rồi kiểm tra + deploy riêng.

## Context

Hiện tại: giá trong Price Matrix / công thức Pricing Rule là giá **CHƯA gồm
VAT** — hệ thống tự cộng thêm `vatAmount = subtotal × VAT%` lên trên để ra số
khách phải trả (`grandTotal`).

Quyết định nghiệp vụ mới (đã xác nhận với người dùng): giá trong Price Matrix/
công thức **từ nay đã bao gồm VAT sẵn** — áp dụng cho **TẤT CẢ sản phẩm** (cả
dùng Matrix lẫn chỉ dùng công thức). Hệ quả: **khách trả ÍT hơn trước** (không
còn bị cộng thêm VAT lần nữa) — đây là thay đổi CÓ CHỦ ĐÍCH, người dùng đã xác
nhận rõ. `vatAmount` từ nay là số **tách ngược** ra từ trong giá đã gồm thuế
(phục vụ báo cáo/quyết toán thuế), không phải cộng thêm.

Đã xác nhận 2 quyết định nghiệp vụ:

1. **Cơ chế công nợ song song trước/sau VAT** (khách trả tiền mặt không lấy
   hoá đơn chỉ cần trả phần gốc) — **GIỮ LẠI**, chỉ đổi cách tính "phần gốc"
   sang tách ngược từ giá đã gồm VAT (không đổi tính năng nghiệp vụ).
2. **Phạm vi áp dụng**: chỉ cho dòng báo giá **TẠO MỚI/SỬA LẠI** sau khi deploy
   — báo giá DRAFT/SENT hiện có giữ nguyên số cũ cho tới khi người dùng tự sửa
   lại dòng đó (lúc đó tính lại theo công thức mới), hoặc tự bấm "Tính lại giá"
   (tính năng `recalculateAll` đã có sẵn) nếu muốn cập nhật hàng loạt. Đơn đã
   APPROVED giữ nguyên vĩnh viễn theo nguyên tắc Snapshot — không đụng.

## Backup trước khi làm

Tên mốc backup: **"Backup trước khi sửa lại logic VAT và lợi nhuận theo ảnh
16/08/2026"** — đúng tên đã chốt trước đó, nay áp dụng luôn cho task này (bản
in đã gác lại, đây mới là thay đổi thật sự cần backup kỹ vì đụng số tiền thu
khách + lợi nhuận toàn hệ thống).

- **Code (Local):** ghi lại commit hash hiện tại trên `main` (trước khi sửa) —
  đây là mốc `git checkout`/`git revert` nếu cần lùi lại toàn bộ thay đổi.
- **DB (VPS, lúc deploy):** bắt buộc chạy `BACKUP_DIR=/opt/erp/backups
  ./scripts/backup/backup.sh` **trước khi deploy** (không chỉ trước khi sửa
  dữ liệu tay như mọi khi) — vì lần này code thay đổi cách TÍNH giá/VAT/lợi
  nhuận, ảnh hưởng trực tiếp đến báo giá/đơn hàng tạo mới ngay sau khi deploy.
  Ghi rõ tên mốc ở trên vào mô tả backup/log deploy để tra lại đúng lúc cần.
- **Khuyến nghị thêm** (do mức độ rủi ro cao hơn hẳn các task trước trong
  phiên này): deploy vào lúc ít người dùng đang thao tác báo giá, và thông báo
  trước cho các kế toán bán hàng biết mốc giờ đổi công thức, để họ biết báo
  giá tạo/sửa TRƯỚC mốc này vẫn theo giá chưa gồm VAT, còn SAU mốc là đã gồm.
- **Khi cần restore:** chưa có sẵn `restore.sh` — sẽ viết lúc deploy nếu cần
  (người dùng xác nhận: chưa cần bây giờ).

Đã research kỹ bằng 2 agent độc lập (rà công thức VAT + rà mọi nơi tính lợi
nhuận/doanh thu), sau đó tự rà soát lại thủ công lần 2 bằng cách đọc trực tiếp
từng đoạn code quan trọng nhất — phát hiện **4 bản copy độc lập** của cùng
công thức tính VAT, nhiều nơi tính lợi nhuận cần trừ thêm VAT, và vài điểm bổ
sung agent chưa bắt được (mục 3, 5, 7 bên dưới có đánh dấu). Toàn bộ danh sách
bên dưới.

## Thiết kế công thức mới

**Công thức tách VAT ngược** (thay cho cộng thêm):

```
// CŨ (cộng thêm):
vatAmount = round(subtotal × vatRate / 100)

// MỚI (tách ngược — subtotal đã gồm VAT):
vatAmount = round(subtotal × vatRate / (100 + vatRate))
```

**Tổng đơn tại Approve** (`quotation-workflow.service.ts`, hàm `approve()`):

```
// totalAmount = Σ subtotal — KHÔNG đổi công thức, nhưng giờ subtotal đã gồm VAT
// nên totalAmount cũng tự động thành "doanh thu gộp đã gồm VAT" (xem mục Rủi ro).
totalVatAmount = Σ item.vatAmount          // tách ngược, không đổi cách gọi

// CŨ: grandTotal = totalAmount + totalVatAmount - discountAmount + shippingFee
// MỚI — bỏ hẳn phần cộng totalVatAmount (đã nằm sẵn trong totalAmount):
grandTotal = totalAmount - discountAmount + shippingFee

// totalAmountBeforeVat — thêm số hạng trừ totalVatAmount (khác cũ):
totalAmountBeforeVat = totalAmount - totalVatAmount - discountAmount + shippingFee
```

**Verify quan trọng đã tự kiểm tra bằng đại số:** với cách định nghĩa
`totalAmountBeforeVat` như trên, đẳng thức `grandTotal − totalAmountBeforeVat
== totalVatAmount` **vẫn đúng y hệt như invariant cũ** → nghĩa là
`VatSettlementService.create()` (đang tính `amount = Receivable.totalAmount −
Receivable.totalAmountBeforeVat`) **KHÔNG cần sửa gì** — invariant được bảo
toàn tự động. Đây là điểm mấu chốt giúp không phải đổi cơ chế
`AllocationPolicy`/`BeforeVatFirstPolicy` — chúng tiếp tục hoạt động đúng vì
`remainingAmountBeforeVat` vẫn là 1 số nhỏ hơn `remainingAmount` một cách nhất
quán. **Vẫn phải viết test thực tế xác nhận lại bằng số cụ thể trước khi coi
là xong**, không chỉ tin vào suy luận đại số.

**Lợi nhuận** (mọi nơi tính `profit`/`plannedProfit`):

```
// CŨ: profit = doanh_thu(subtotal, chưa VAT) - giá_vốn
// MỚI: doanh_thu giờ đã gồm VAT → phải trừ thêm:
profit = doanh_thu(subtotal, đã gồm VAT) - vatAmount - giá_vốn
```

Giá vốn (BOM/Material cost) **không bị ảnh hưởng** — đã verify vật tư không có
VAT trong giá nhập, không rủi ro tính trùng.

### Ví dụ số cụ thể — ĐÍNH CHÍNH hiểu lầm ban đầu

**Đính chính:** `subtotal`/`totalAmount` (= Σ giá matrix × diện tích, sau CK/phụ
phí) **KHÔNG đổi công thức, KHÔNG đổi SỐ** — giá matrix giữ nguyên, công thức
`finalPrice`/`subtotal` chưa từng đụng tới `vatRate` (cả trước lẫn sau khi đổi
đều tính y hệt nhau). Cột "Tổng tiền" trên bảng danh sách báo giá **giữ nguyên
số như cột "trước VAT" của bản cũ** — đúng như bạn nói. Cái ĐỔI là: **VAT
không còn cộng thêm lên trên `subtotal` để ra số khách trả nữa.**

VD: giá matrix 1.000.000đ (giữ nguyên), VAT 10%, giá vốn 600.000đ.

| | CŨ (cộng thêm) | MỚI (tách ngược) |
|---|---|---|
| `subtotal`/Tổng tiền hàng | 1.000.000 | 1.000.000 *(KHÔNG đổi)* |
| `vatAmount` | 100.000 (=1.000.000×10%) | 90.909 (=1.000.000×10/110) |
| `grandTotal`/Tổng thanh toán (khách trả) | 1.100.000 | **1.000.000** *(giảm — đúng chủ đích)* |
| `totalAmountBeforeVat` (trước VAT, công nợ) | ~909.091 (chưa từng dùng cho ví dụ này) | 909.091 (=1.000.000−90.909) |
| `plannedProfit` (lợi nhuận) | 400.000 (=1.000.000−600.000) | **309.091** (=1.000.000−90.909−600.000, giảm) |

**Hệ quả cần bạn nắm rõ:** với CÙNG giá matrix, **khách trả ít hơn VÀ lợi
nhuận công ty cũng giảm theo** (vì phần VAT giờ được tách ra khỏi doanh thu
thay vì được cộng thêm free). Doanh thu (`Σ subtotal`) trên Dashboard/Báo cáo
**KHÔNG tăng** (đã đính chính ở mục 5 bên dưới) — chỉ có Lợi nhuận và Tổng
thanh toán/Công nợ là giảm.

## Danh sách file cần sửa

### Backend — công thức VAT (9 điểm cộng thêm → tách ngược)

1. `apps/api/src/quotation/quotation-workflow.service.ts:2037-2039` — `calcVatAmount()`, đổi công thức.
2. `apps/api/src/pricing-engine/pricing-calc.helpers.ts:9-33` — bản copy y hệt hàm trên (dùng bởi `vat-settlement.service.ts` nhánh `createFromOpeningBalance`) — sửa đồng bộ, cân nhắc gộp về dùng chung 1 helper duy nhất thay vì giữ 2 bản (comment sẵn có trong code đã cảnh báo "sửa 1 bên nhớ sửa bên kia" — đúng rủi ro đang gặp).
3. `apps/api/src/quotation/quotation-workflow.service.ts:1575-1602` (`approve()`) — `grandTotal`/`totalAmountBeforeVat` theo công thức mới ở trên. **Đã đọc lại kỹ, bổ sung 1 điểm:** dòng 1591-1594 có validate `if (grandTotal < 0) throw ... 'Giảm thêm vượt quá Tổng thanh toán (Tổng tiền hàng + VAT)'` — logic check tự đúng khi `grandTotal` đổi công thức, nhưng **chữ trong message cũng phải sửa** (không còn "Tổng tiền hàng + VAT" vì không còn phép cộng riêng). Comment dòng 1596-1600 giải thích invariant trước-VAT cũng nên viết lại cho khớp công thức mới (không sai, nhưng dễ gây hiểu nhầm nếu để nguyên).
4. `apps/api/src/quotation/quotation-workflow.service.ts:1337-1345` (`discount()`, cap kiểm tra giảm giá) — đã đọc đúng đoạn: `totalPayable = Σ(subtotal + vatAmount)` (dòng 1337-1340) → đổi thành `Σ subtotal` (vatAmount đã nằm sẵn trong đó). Message lỗi dòng 1343 "vượt quá Tổng thanh toán (Tổng tiền hàng + VAT)" → sửa lại chữ cho khớp (không còn phép cộng riêng nữa), vd "vượt quá Tổng thanh toán".
5. `apps/api/src/product/product.service.ts:2507-2536` (`previewPrice`, preview giá ở trang sửa Pricing Rule) — đổi công thức `vatAmount`/`priceWithVat` cho nhất quán (không còn cộng thêm — `priceWithVat` giờ = chính `systemPrice`). Comment dòng 2518-2520 ("VAT tính thẳng trên systemPrice") cũng nên cập nhật lại chữ. **Đã đọc lại, phát hiện thêm 1 nơi tiêu thụ dữ liệu này ở FE** (không có trong lần rà bằng agent): `apps/web/src/app/products/[id]/pricing-rule/versions/[versionId]/page.tsx:722-731` — panel preview hiện dòng "VAT (x%): ..." rồi dòng tổng `priceWithVat` bên dưới như 2 dòng cộng dồn. Không cần sửa code FE (chỉ hiện lại đúng số BE trả về), nhưng **phải xem lại bằng mắt sau khi sửa BE** — vì `priceWithVat` giờ trùng luôn với giá ở trên, hiển thị 2 dòng giống nhau liền kề nhau trông cấn — cân nhắc bỏ bớt dòng "VAT (x%)" hoặc đổi cách trình bày cho gọn (tương tự bản in báo giá Phần 2), tuỳ bạn quyết định lúc thấy giao diện thật.

### Backend — lợi nhuận (4 điểm cần trừ thêm VAT)

6. `apps/api/src/quotation/quotation-workflow.service.ts:220-227` (`findAll` — danh sách báo giá) — hiện chỉ SELECT `subtotal`, cần thêm SELECT `vatAmount` rồi trừ vào `profit`.
7. `apps/api/src/quotation/quotation-workflow.service.ts:279-320` (`getCostSummary` — dialog Xem lãi/lỗ) — tương tự, thêm `vatAmount` vào tính `profit` per-item và tổng (hiện SELECT ở dòng 256-269 cũng chưa có `vatAmount`, cần thêm). Comment dòng 305-306 ("Đã không gồm VAT sẵn... khớp yêu cầu tổng giá bán không tính VAT") sẽ SAI sau khi sửa — phải xoá/viết lại.
8. `apps/api/src/quotation/quotation-workflow.service.ts:1693-1694` (`plannedProfit` lúc Approve) — `plannedProfit = totalAmount - totalVatAmount - plannedCost - discountAmount` (thêm số hạng trừ `totalVatAmount`, biến này đã có sẵn trong scope).

### Frontend

9. `apps/web/src/components/quotation/quotation-item-dialog.tsx` — bản copy công thức VAT phía client (preview lúc thêm/sửa dòng báo giá). Đã đọc kỹ toàn file, đúng 2 chỗ cần sửa:
   - Dòng 249-250: `vatAmount = subtotal × vatRate/100` → công thức tách ngược; `grandTotal = subtotal + vatAmount` → bỏ, `grandTotal` giờ = chính `subtotal` (không cộng thêm).
   - Dòng 469-480 (render): dòng "VAT (x%)" + "Tổng cộng" đang hiện như 2 dòng cộng dồn — đổi thành hiện `subtotal` là số cuối cùng, dòng VAT chỉ mang tính thông tin ("trong đó đã gồm VAT: x"), không phải phép cộng nữa.
10. `apps/web/src/components/quotation/quotation-item-table.tsx:91-99` — bảng dòng báo giá đang sửa (Draft/Sent) tự tính `profit` riêng ở client, độc lập với BE — đã có sẵn biến `totalVat` (dòng 92) nhưng đang KHÔNG dùng cho profit — chỉ cần nối vào: `profit = totalAmount - totalVat - totalCost`.
11. **[Phát hiện bổ sung, chưa có trong lần rà soát bằng agent]** `apps/web/src/components/quotation/quotation-item-table.tsx:315` — dòng "Tổng thanh toán" hiển thị ngay trên trang chi tiết báo giá (Draft/Sent): `formatMoney(totalAmount + totalVat - discountAmount + shippingFee)` — vẫn đang CỘNG `totalVat`, y hệt lỗi ở `grandTotal` backend (mục 3) nhưng đây là bản tính riêng ở client, phải sửa thành `totalAmount - discountAmount + shippingFee` (bỏ cộng `totalVat`) — nếu không sửa, trang chi tiết báo giá sẽ hiện SAI (cao hơn thực tế đúng bằng phần VAT) ngay cả khi backend đã đúng.

### Không cần sửa (đã verify, liệt kê để tránh sửa nhầm)

- `apps/api/src/pricing-engine/pricing-engine.service.ts` — `calculatePrice()`: `vatRate` vốn chỉ là pass-through, chưa từng cộng vào `systemPrice`/`rawPrice` — không đổi.
- `apps/api/src/debt/vat-settlement.service.ts:230-231` — công thức `totalAmount − totalAmountBeforeVat` giữ nguyên, invariant vẫn đúng (xem phần Thiết kế ở trên) — **nhưng bắt buộc viết test xác nhận lại bằng số thật**. **Tin tốt phát hiện thêm khi rà soát lại:** invariant này không chỉ đúng SAU khi đổi, mà đã đúng CẢ VỚI CÔNG THỨC CŨ từ trước tới giờ (verify lại bằng đại số: `grandTotal_cũ − totalAmountBeforeVat_cũ` cũng luôn = `totalVatAmount`, chỉ khác công thức `grandTotal` giữa 2 thời kỳ) → nghĩa là `VatSettlementService` tính đúng cho CẢ đơn cũ (duyệt trước khi đổi) lẫn đơn mới, không cần lo phân biệt 2 loại dữ liệu ở riêng chỗ này.
- `apps/api/src/debt/allocation-policy.ts` (`BeforeVatFirstPolicy`) — không đổi code, chỉ verify hành vi vẫn đúng qua test.
- `apps/api/src/sales-order/sales-order.service.ts` (mọi report Doanh thu: revenue-by-employee/product/customer, growth, dashboard) — **ĐÍNH CHÍNH so với nhận định ban đầu:** không có lỗi công thức, và số "Doanh thu" (`Σ totalAmount`/`subtotal`) **KHÔNG đổi** — vì `subtotal` chưa từng đụng `vatRate`, giá matrix giữ nguyên nên tổng vẫn y hệt trước. Cái đổi là **`plannedProfit` (Lợi nhuận) sẽ giảm** (trừ thêm VAT tách ngược) và **`grandTotal`/công nợ khách phải trả sẽ giảm** (không cộng VAT nữa) — xem ví dụ số cụ thể ở mục Thiết kế công thức. Không cần sửa gì ở các report Doanh thu vì bản thân số Doanh thu không sai lệch.

## Rủi ro còn lại cần lưu ý khi làm

- Trong lúc chuyển tiếp, 1 báo giá DRAFT có thể có **dòng cũ (công thức additive)** và **dòng vừa sửa (công thức inclusive) cùng tồn tại** nếu người dùng chỉ sửa 1 dòng sau khi deploy — chấp nhận theo đúng quyết định "chỉ áp dụng dòng tạo mới/sửa lại", có nút "Tính lại giá" (`recalculateAll`) sẵn có để người dùng chủ động đồng bộ cả báo giá nếu muốn.
- Đã đọc kỹ toàn bộ `quotation-item-dialog.tsx`, xác nhận đúng 2 vị trí cần sửa (mục 9), không còn chỗ nào khác trong file này.

## Kiểm tra

- Viết script gọi trực tiếp `calcVatAmount`/`approve()` (hoặc test đơn vị) với vài
  bộ số thật, xác nhận bằng tay: (a) `grandTotal == totalAmountBeforeVat +
  totalVatAmount` vẫn đúng, (b) `VatSettlementService.create()` cho ra đúng
  `amount` khớp `totalVatAmount` thật (không bị 0), (c) `AllocationPolicy` chia
  đúng theo `remainingAmountBeforeVat` mới.
- Tạo 1 báo giá mới trên Local sau khi sửa, so sánh: giá hiển thị = đúng giá
  matrix (không cộng thêm VAT), `vatAmount` hiển thị đúng số tách ngược,
  `plannedProfit` sau Approve đúng bằng công thức mới.
- `npx tsc --noEmit` + `eslint` cho toàn bộ file đã sửa (API + Web).
- Mở lại 1 báo giá DRAFT cũ (tạo trước khi đổi) — xác nhận số cũ KHÔNG bị đổi
  cho tới khi chủ động sửa/tính lại.

---

## Phần 2 — Bản in báo giá (làm SAU khi Phần 1 xong, đọc số từ BE đã sửa)

Kế hoạch bản in trước đó (bỏ cột VAT) bị gác lại vì lúc đó chưa rõ hướng đổi
backend. Giờ backend đã chốt (Phần 1), kế hoạch bản in **đơn giản hơn nhiều**
so với bản nháp cũ, vì `subtotal` per-dòng **không đổi số** — chỉ đổi ý nghĩa.

File duy nhất: `apps/web/src/app/quotations/[id]/print/page.tsx`.

### 1. Bảng sản phẩm (dòng ~622-792)

- Xoá 2 cột **Mức thuế VAT**, **Tiền Thuế** (header + `<td>` từng dòng + dòng
  TỔNG) — thuần tuý bớt hiển thị, không có giá trị nào cần tính lại.
- Đổi tên cột **Thành Tiền** → **Thành Tiền (đã bao gồm VAT)**. **Giá trị GIỮ
  NGUYÊN = `item.subtotal`** (KHÔNG cộng `vatAmount` như bản nháp cũ đã tính
  sai — subtotal giờ tự nó đã là số cuối cùng, không cần cộng thêm gì nữa).
- Xoá luôn cột "Thành tiền (bao gồm VAT)" cũ — nó với "Thành Tiền" giờ là 1,
  không cần 2 cột nữa.
- `colgroup`/`colSpan`: 12 cột → 9 cột (STT, Sản phẩm, Rộng, Cao, SL, M2, Đơn
  giá, Thành Tiền (đã bao gồm VAT), Chú thích).
- Dòng "TỔNG": ô tiền = `totalAmount` (KHÔNG cộng `totalVat` nữa).

### 2. Khối "Tình hình công nợ" (dòng ~808-847)

**Đã xác nhận lại với người dùng (đổi so với quyết định trước đó):** gộp còn
**1 cột duy nhất, lấy số ĐẦY ĐỦ khách phải trả** (`grandTotal`/`existingDebt`/
`totalToPay` — trước đây gọi "Sau VAT") — **KHÔNG** dùng số đã tách VAT ra
(`totalAmountBeforeVat`/`existingDebtBeforeVat`/`totalToPayBeforeVat`) nữa.
Gắn nhãn cột là **"Đã bao gồm VAT"**.

Lý do chốt: VD giá matrix 1.000.000đ VAT 10% → `grandTotal` = 1.000.000đ (số
khách thực trả, đúng nghĩa đen "đã bao gồm VAT") — còn `totalAmountBeforeVat`
= 909.091đ (số ĐÃ tách VAT ra, nhỏ hơn) không còn phù hợp gắn nhãn "Đã bao gồm
VAT". Hệ quả: bản in sẽ **không còn hiện riêng số khách trả tiền mặt không lấy
hoá đơn nữa** — cơ chế này vẫn còn nguyên trong hệ thống (Phần 1 không đổi),
chỉ là không in ra nữa.

- **Phải sửa công thức tính CLIENT-SIDE** cho nhánh Báo giá chưa duyệt (chưa
  có `SalesOrder`/`Receivable` để đọc số snapshot) — `grandTotal` (dòng
  ~454-456): bỏ cộng `totalVat` → `totalAmount - discountAmount + shippingFee`.
  KHÔNG cần sửa `totalAmountBeforeVat` ở trang in nữa (không dùng tới).
- Header cột: **"Đã bao gồm VAT"** (khác quyết định trước — trước định để
  trống).
- `colSpan={3}` → `colSpan={2}`.

### 3. Dọn biến không dùng

**Ngược lại với bản nháp trước** (do đổi quyết định ở mục 2): giờ xoá
`totalAmountBeforeVat`, `currentOrderRemainingBeforeVat`,
`existingDebtBeforeVat`, `totalToPayBeforeVat`, `debtTotalRemainingBeforeVat`
(+ dòng `setDebtTotalRemainingBeforeVat` trong `.then()`) — chuỗi biến "trước
VAT" không còn dùng ở trang in nữa. **Giữ nguyên** `grandTotal`,
`currentOrderRemaining`, `existingDebt`, `totalToPay`, `debtTotalRemaining` —
chuỗi biến "đã bao gồm VAT" giờ là chuỗi duy nhất còn dùng.

### Kiểm tra riêng phần bản in

- Mở lại 1 báo giá + 1 đơn hàng thật sau khi Phần 1 đã deploy, xác nhận số
  trên bản in khớp 100% với số trên trang chi tiết (không lệch do 2 nơi tính
  riêng — đúng như lỗi mục 11 vừa phát hiện ở Phần 1).
