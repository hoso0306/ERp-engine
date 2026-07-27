# Phiên làm việc 2026-07-24/25 — Nhà xe mặc định khách hàng, Preview import Excel, Chuẩn hoá Rộng/Cao phiếu SX

Trạng thái cập nhật 2026-07-25 (sau đợt deploy 3): toàn bộ mục 1-5 **đã lên production** (`kynangai.cloud`). Mục 1-2 commit `0943b59`/`7e7870d`; mục 3 commit `5d871ba` (được commit ở phiên khác, phát hiện đã deploy sẵn lúc chuẩn bị đợt deploy 3); mục 4 commit `1dee073`; mục 5 là thay đổi data (không có commit), đã sync trực tiếp qua service layer.

Ghi chú: file này tách riêng khỏi `workbench/sessions/2026-07-24-header-login-print-fixes.md` (phiên khác, đã deploy xong việc của họ) để không lẫn 2 việc độc lập vào chung 1 file.

## 1. Nhà xe mặc định khách hàng — Đợt deploy 1 (commit `0943b59`, đã lên production)

- **DB**: migration `20260724043144_add_customer_default_carrier_info` — thêm `Customer.defaultCarrierName/defaultCarrierPhone/defaultCarrierNote` (nullable). Migration cũng dọn kèm `DEFAULT 0` thừa trên `receivables.total_amount_before_vat`/`remaining_amount_before_vat` (schema đã bỏ default từ trước, DB chưa migrate theo — an toàn, không đổi data).
- **BE**: `customer.service.ts`, `dto/create-customer.dto.ts`, `dto/update-customer.dto.ts` — CRUD 3 field mới. `excel.service.ts` — thêm hỗ trợ Excel Data Validation dạng dropdown (`validationList` trên `ExcelColumn`, ghi list vào sheet ẩn `Lists`, dùng chung được cho các module Excel khác không bị ảnh hưởng).
- **FE**: `customer-form.tsx`, `customer-edit-form.tsx` — thêm khối "Thông tin giao hàng" (Nhà xe/SĐT/Ghi chú). `customers/[id]/page.tsx` — hiển thị.
- **Import/Export Excel khách hàng** viết lại hoàn toàn (`customer.service.ts` `importExcel`/`exportExcel`/`exportTemplate`):
  - Thêm 3 cột Nhà xe/SĐT nhà xe/Ghi chú giao hàng vào cuối (giữ tương thích file cũ).
  - Dropdown Data Validation cho Nhóm KH/Tuyến GH/Ưu tiên/Trạng thái ở cả file Export và Template.
  - Mỗi dòng lỗi **chỉ bỏ qua riêng dòng đó**, không chặn cả file như trước.
  - SĐT trùng khách đã có trong DB (chưa xoá) → **cập nhật**, chỉ điền field đang trống (không đè dữ liệu cũ), không đổi `code`/`name`/`phone`, không đụng `priority`/`status`/`debtLimit`/`debtTermDays`.
  - Response đổi từ `{success, errors}` sang `{created, updated, errors}`.
- **Backup trước deploy**: `/opt/erp/backups/erp-20260724-123334.sql.gz`.

## 2. Snapshot Nhà xe vào SalesOrder lúc Duyệt báo giá — Đợt deploy 2 (commit `7e7870d`, đã lên production)

- **BE**: `quotation-workflow.service.ts` — lúc **Duyệt báo giá**, tự động snapshot `Customer.defaultCarrier*` vào `SalesOrder.carrierName/carrierPhone/carrierNote` (đúng pattern `deliveryName/Phone/Address` đã có), thay vì chỉ để tham khảo như thiết kế ban đầu ở đợt 1. Chỉ áp dụng cho đơn Approve **từ lúc deploy trở đi** — đơn cũ đã Approve trước đó vẫn trống, phải nhập tay qua `CarrierInfoDialog` như cũ.
- Cập nhật lại comment/label liên quan ở schema, DTO, form FE, `knowledge/modules/customer.md`, `knowledge/modules/order.md` cho khớp hành vi mới.
- **Backup trước deploy**: `/opt/erp/backups/erp-20260724-125636.sql.gz`.

## 3. Preview import Excel — commit `5d871ba`, đã lên production (commit ở phiên khác, không phải đợt deploy 3)

Lý do: import trước đó bấm là ghi thẳng DB luôn, không xem trước được sẽ tạo/sửa gì — user yêu cầu thêm bước xem trước.

- **BE**: `customer.controller.ts` — thêm route `POST /customers/import/preview`. `customer.service.ts` — tách logic parse+validate+so khớp DB dùng chung thành `resolveImport()` (private), `previewImportExcel()` (chỉ đọc, không ghi DB) và `importExcel()` (ghi DB) đều gọi lại hàm này để đảm bảo preview thấy đúng thứ sẽ xảy ra thật.
- **FE**: `customer-import-dialog.tsx` — viết lại thành luồng 2 bước: chọn file → "Xem trước" (gọi API preview, hiện bảng Dòng/Hành động/Tên/SĐT/Thay đổi) → "Xác nhận Import" (gọi API ghi thật). Đã fix 1 bug UI: lúc đầu đặt `className="max-w-4xl"` (thiếu tiền tố `sm:`) khiến dialog bị đè bởi `sm:max-w-sm` mặc định ở màn hình ≥640px, dialog hiện bé tí — sửa thành `sm:max-w-5xl`.
- **Đã verify**: `tsc --noEmit` + `eslint` sạch cho cả BE/FE, `next build`/`nest build` pass. Verify logic bằng script gọi trực tiếp `CustomerService.previewImportExcel()`/`importExcel()` qua `ts-node` (không qua HTTP, bypass auth) — preview nhận đúng dòng tạo mới/cập nhật kèm field sắp điền, import thật ghi khớp với preview, đã dọn dữ liệu test tạo ra. **Chưa test bằng mắt trên trình duyệt.**
- **Deploy note**: chỉ đổi API + web, không có migration mới cho phần này (migration `add_customer_default_carrier_info` đã deploy ở đợt 1 rồi).

File đã đổi (chưa commit):
- `apps/api/src/customer/customer.controller.ts`
- `apps/api/src/customer/customer.service.ts`
- `apps/web/src/components/customer/customer-import-dialog.tsx`

## 4. Chuẩn hoá hiển thị Rộng/Cao trên phiếu SX — Đợt deploy 3 (commit `1dee073`, đã lên production)

**Vấn đề:** số liệu Rộng/Cao trên phiếu in hiển thị không đồng nhất số chữ số thập phân tuỳ cách nhập ban đầu (vd `"1.2"`, `"11"`, có dòng lẫn dấu phẩy) — user yêu cầu luôn hiện theo 1 định dạng cố định.

**Đổi hướng 2 lần theo phản hồi trực tiếp — chỉ bản cuối còn trong code:**
1. Ban đầu hiểu nhầm yêu cầu là "bỏ bớt số 0 thừa" (`maximumFractionDigits: 4`, không đặt minimum) — user phản hồi hiểu ngược, họ muốn **luôn hiện đủ** chữ số thập phân chứ không phải rút gọn.
2. Đổi sang `minimumFractionDigits: 4, maximumFractionDigits: 4` (luôn đủ 4 số) — user yêu cầu giảm xuống còn 3.
3. **Bản cuối:** `minimumFractionDigits: 3, maximumFractionDigits: 3`.

**Đã sửa:** `apps/web/src/app/production/print/page.tsx` — thêm hàm `formatDimension(raw: string)`: parse chuỗi thô (chấp nhận cả dấu phẩy lẫn dấu chấm), luôn hiện lại theo chuẩn Việt Nam với đúng 3 chữ số thập phân (vd `"1.2"` → `"1,200"`, `"11"` → `"11,000"`). Giá trị không parse được số (vd `"—"` khi thiếu tham số) giữ nguyên, không lỗi. Áp dụng cho cả 2 mẫu in: mẫu Xưởng (2 ô Rộng/Cao, `tdBigStyle`) và mẫu chung (dòng thông số dưới tên sản phẩm, chỉ áp dụng khi tên tham số là `chieurong`/`chieucao` và không có `valueLabel`). Không sửa dữ liệu gốc đã lưu trong DB — chỉ chuẩn hoá lúc hiển thị, đúng nguyên tắc Snapshot (CLAUDE.md mục 7).

**Đã tra dữ liệu thật trước khi sửa:** query trực tiếp `SalesOrderItemParameter`/`QuotationItemParameter` trên DB dev local — dữ liệu raw đang sạch (`"1.2"`, `"11"`, dấu chấm, không số 0 thừa), xác nhận đây không phải bug ở code hiển thị cũ mà do khác biệt cách nhập liệu qua thời gian (có thể trên production hoặc do tham số Rộng/Cao ở 1 số Product cấu hình kiểu nhập TEXT cho phép gõ tự do thay vì NUMBER).

**⚠️ Trùng file với `workbench/sessions/2026-07-24-header-login-print-fixes.md` mục 3** (phiên "Header/Login/Print" khác, đã deploy) — file `production/print/page.tsx` đã được phiên đó sửa cho cột SL (to+đậm) và Ghi chú (gạch chân, đo cỡ chữ bằng canvas) **và đã deploy rồi**. Bản trên đĩa hiện tại là code đã deploy + cộng thêm thay đổi `formatDimension` của mục này — khi commit, diff sẽ CHỈ còn đúng phần `formatDimension` (vì phần kia đã lên production/đã ở nhánh chính), không bị lẫn.

**Đã verify**: `tsc --noEmit` sạch sau mỗi vòng chỉnh (cả 3 bản). Sanity-check hàm `formatDimension` bằng script Node độc lập — input/output khớp kỳ vọng (`"1.2"`→`"1,200"`, `"1,2000"`→`"1,200"`, `"11"`→`"11,000"`, `"—"`→`"—"`). **Đã test bằng mắt trên trình duyệt — user xác nhận OK.**

**Deploy note:** thuần frontend (1 file), không đổi API/DB. An toàn deploy độc lập.

File đã đổi: `apps/web/src/app/production/print/page.tsx` (commit `1dee073`).

**Backup trước deploy**: `/opt/erp/backups/erp-20260725-162507.sql.gz`.

**Lưu ý khi thực hiện đợt deploy 3:** phát hiện mục 3 (Preview import Excel) thực ra **đã được commit + deploy từ trước** (commit `5d871ba`, nằm trong khoảng `109771d` mà VPS đã chạy) — trạng thái "CHƯA COMMIT, CHƯA DEPLOY" ghi ở mục 3 phía trên đã lỗi thời do có phiên làm việc khác commit sau khi file này được viết. Đợt deploy 3 trên thực tế chỉ cần deploy đúng 1 file của mục 4.

## 5. Thêm option "Máng nhôm vuông" cho 40 sản phẩm RCV — Đợt sync data (đã lên production 2026-07-25)

Khác với mục 1-4 (đổi code), mục này **không đổi file code nào** — toàn bộ là thay đổi Master Data (Product Parameter Option, Pricing Rule Version, Material Requirement Version, Material) qua script gọi thẳng `ProductService`/`PricingEngineService`/`BomEngineService` (service layer, giữ đúng validation + versioning + audit), chạy trên **DB dev cục bộ**, script tạm đã xoá sau khi chạy xong (`git status` sạch, không có gì để commit).

**Nghiệp vụ:** param `mangremcuon` (Loại máng) của 40 sản phẩm RCV (Rèm cầu vồng, SP000056–SP000095) tách `nhom` thành 2 lựa chọn: `nhomcong` ("Máng nhôm cong", giữ nguyên hành vi cũ) + `nhomvuong` ("Máng nhôm vuông", mới, công thức giá/định mức giống hệt nhomcong). `nhua` không đổi.

**Đã làm trên từng sản phẩm (40/40):**
- Đổi option `mangremcuon`: `nhomcong, nhomvuong, nhua` (thứ tự hiển thị).
- Pricing Rule: version mới — `surchargeExpression = if(mangremcuon == "nhomcong" || mangremcuon == "nhomvuong", 20000 * area, 0)`; Price Matrix thêm dòng `nhomvuong` cho mỗi `marem`, đơn giá copy y hệt dòng `nhomcong` tương ứng.
- Material Requirement: version mới — thêm dòng vật tư mới, điều kiện `mangremcuon == "nhomvuong"`, công thức giống hệt dòng `NL000091` (`(chieurong - 0.004) * 0.45`, hao hụt 5%, CEIL 0.0001).
- Vật tư mới **`NL000139 - Máng nhôm vuông - Rèm cầu vồng`** (kg, giá vốn tạm 125.000đ/kg — **cần cập nhật giá thật khi có báo giá NCC**, cùng Production Center với `NL000091`) — **dùng chung cho cả 40 sản phẩm**, đúng pattern của `NL000091`.

**Sự cố tự phát hiện giữa chừng:** ban đầu code tạo nhầm 40 Material riêng (1 mã/sản phẩm) thay vì 1 mã dùng chung — đã dừng lại hỏi user, xác nhận hướng gộp về 1 mã `NL000139`, viết script gộp lại. 39 mã thừa (`NL000140`–`NL000178`) không hard-delete được (Material Requirement Version đã ARCHIVED vẫn tham chiếu, FK RESTRICT) nên đã soft-deactivate (`isActive = false`) — không ảnh hưởng vận hành, chỉ còn nằm lại làm lịch sử version cũ.

**Đã verify (local trước khi sync):** gọi trực tiếp `pricingEngine.calculate()` + `bomEngine.calculateBom()` cho cả 40 sản phẩm × 3 nhánh (nhomcong/nhomvuong/nhua) — đúng giá, đúng surcharge, đúng dòng BOM. Audit SQL toàn diện trên DB dev: 0 lệch thứ tự option, 0 lệch surcharge expression, 0 vật tư lạ trong điều kiện `mangremcuon`.

### Đã sync lên production (2026-07-25)

**Cách làm:** viết lại script y hệt logic ở local (tạo 1 Material dùng chung **trước**, rồi mới lặp qua 40 sản phẩm), copy vào container `erp-api` bằng `docker compose cp` (không dùng bind-mount, container build từ image nên phải copy trực tiếp vào container đang chạy), chạy bằng `docker compose exec -T api npx ts-node <script>.ts` — dùng đúng service layer thật của production. Test 1 sản phẩm mẫu (SP000056) trước, verify OK rồi mới chạy hàng loạt `FULL_BATCH=true` cho cả 40 (script tự bỏ qua sản phẩm đã xử lý — idempotent).

**Sự cố phát sinh khi chạy trên production (khác với local):** `running_numbers` (bộ đếm sinh mã) cho type `MATERIAL` bị lệch từ trước — `last_number = 91` trong khi mã Material cao nhất thực tế là `NL000138` (127 material nhưng có gap do 11 mã từng bị xoá, khả năng do lần đồng bộ domain sản phẩm 2026-07-21 không cập nhật lại bộ đếm này). Hậu quả: sinh mã Material mới bị trùng `NL000091` (unique constraint), phải xin phép user chạy `UPDATE running_numbers SET last_number = 138 WHERE type = 'MATERIAL'` trước khi tạo được Material mới. `PRODUCT`/`CUSTOMER` running_numbers vẫn khớp đúng, chỉ riêng `MATERIAL` bị lệch — **nếu sau này tạo Material mới trên production mà gặp lỗi unique constraint tương tự, kiểm tra lại `running_numbers` trước.**

**Kết quả:** 40/40 sản phẩm thành công, đúng 1 Material dùng chung `NL000139 - Máng nhôm vuông - Rèm cầu vồng` (không lặp lại sự cố tạo-trùng-40-mã đã xảy ra ở local). Verify bằng `calculatePrice`/`calculateBom` qua service layer thật + audit SQL trên production: 0 lệch thứ tự option, đúng 1 giá trị `surcharge_expression` duy nhất trên cả 40 sản phẩm, 0 vật tư lạ trong điều kiện `mangremcuon`, đúng 1 Material tên "Máng nhôm vuông - Rèm cầu vồng". Đã xoá script tạm khỏi container và khỏi repo trên VPS.

**An toàn đã kiểm tra trước khi chạy:** production lúc này đã có dữ liệu thật (50 báo giá, 42 đơn hàng, 50 khách hàng — không còn trống như lúc go-live 07-21) nên **không** làm full-resync domain sản phẩm như lần trước, chỉ áp dụng thay đổi tăng-dần qua service layer. Kiểm tra trước khi đổi option `nhom`→`nhomcong`: 0 báo giá DRAFT/SENT nào đang chọn `nhom` cho RCV; 12 đơn hàng đã APPROVED dùng `nhom` đều đã sinh Phiếu sản xuất từ trước (BOM đã chốt, không bị tính lại) → an toàn.

**Backup trước khi sync:** `/opt/erp/backups/erp-20260725-162507.sql.gz` (dùng chung với backup trước đợt deploy 3 ở mục 4, vì làm liền nhau trong cùng 1 phiên).

**Chưa test bằng mắt trên trình duyệt** (môi trường không có công cụ điều khiển browser; đăng nhập thử qua API bằng tài khoản admin@kynangai.cloud bị 401, user chọn bỏ qua bước này, để tự kiểm tra tay sau).
