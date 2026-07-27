# Phiên làm việc 2026-07-24 — Login logo, Header indicator, In phiếu sản xuất

Trạng thái tại thời điểm ghi: tất cả thay đổi bên dưới **chưa commit** (working tree local). Không có gì được deploy/push trong phiên này.

## 1. Trang đăng nhập — hết nháy logo "chữ E" lúc mới mở

**Vấn đề:** logo lấy qua `useBranding()` (client-side fetch trong `useEffect`) nên luôn có ~vài trăm ms hiển thị fallback trước khi có logo thật.

**Đã sửa:**
- `apps/web/src/app/login/page.tsx` — đổi thành **Server Component**, fetch `GET {NEXT_PUBLIC_API_URL}/api/settings/branding` trực tiếp trên server (`cache: "no-store"`) trước khi trả HTML, truyền `initialLogo` xuống làm prop.
- `apps/web/src/app/login/login-form.tsx` (**file mới**) — tách toàn bộ logic form (state, submit, dialog lỗi) thành Client Component, nhận `initialLogo` qua prop. Fallback khi không có logo: icon `Building2` (lucide-react) trung tính — không dùng `AvatarFallback`/chữ cái.

**Deploy note:** không đổi API, không đổi DB. An toàn deploy độc lập.

## 2. Header — chấm trạng thái kết nối (đã đổi hướng 3 lần trong phiên)

Thứ tự thử — **chỉ bản cuối còn tồn tại trong code**:
1. Thanh loading kiểu NProgress khi chuyển trang (`RouteProgressBar`, patch `history.pushState`/`replaceState`) — **đã xoá**, user phản hồi "web load quá nhanh nên không cần".
2. Chấm xanh lá phát sáng chạy qua lại liên tục (thuần CSS, trang trí) — **đã xoá**, user đổi ý muốn chỉ báo trạng thái thật thay vì trang trí.
3. **Bản hiện tại (giữ lại):** `apps/web/src/components/layout/header-status-indicator.tsx` (**file mới**) — chấm + chữ **Online/Offline** thật, canh giữa Header (absolute, không phụ thuộc layout 2 bên). Poll `GET /api/health` mỗi 15 giây (+ check ngay khi mount). Xanh lá `#22c55e` khi `database: "ok"`; đỏ `#ef4444` khi fetch lỗi/timeout hoặc DB lỗi.

File liên quan đã sửa:
- `apps/web/src/components/layout/header.tsx` — gắn `<HeaderStatusIndicator />`, bỏ `Suspense`/`useSearchParams` (không cần nữa sau khi bỏ RouteProgressBar).
- `apps/web/src/app/globals.css` — có thêm rồi xoá lại 1 `@keyframes` (net diff = 0, không còn dấu vết).

**Bug đã gặp và fix trong lúc làm:** bản NProgress ban đầu bị lỗi React `useInsertionEffect must not schedule updates` vì Next.js App Router tự gọi `history.pushState` từ trong 1 `useInsertionEffect` nội bộ — fix bằng `setTimeout(start, 0)` để defer set-state ra ngoài (đã xoá cùng với cả component khi bỏ hướng NProgress).

**Deploy note:** `/api/health` là endpoint có sẵn, public, không đổi backend. An toàn deploy độc lập. Nên cân nhắc chu kỳ poll 15s × số client đang mở tab nếu số user đồng thời lớn (hiện tại nhẹ, không đáng lo với quy mô ERP nội bộ).

## 3. Bản in Phiếu sản xuất (mẫu Xưởng) — `apps/web/src/app/production/print/page.tsx`

- Cột **SL**: đổi sang style to + đậm giống cột Rộng/Cao (`tdBigStyle`, fontSize 15/fontWeight 800), áp dụng cả dòng dữ liệu và dòng TỔNG CỘNG.
- Cột **Ghi chú**: chữ gạch chân (`text-decoration: underline`).
- Cỡ chữ Ghi chú: refactor từ đoán theo **số ký tự** (`noteFontSize`, gây co chữ quá sớm — mới gõ chưa nửa cột đã nhỏ) sang **đo chiều rộng chữ thật bằng canvas** — component mới `NoteCell` đo `clientWidth` thật của textarea, tìm cỡ chữ lớn nhất (tối đa 22px, bước 0.5) vừa khít bề rộng cột. Chỉ giảm khi chữ thật sự chạm hết cột, gõ tiếp mới giảm thêm.

**Deploy note:** chỉ đổi web, không đổi API/DB. An toàn deploy độc lập. Nên test in thử ít nhất 1 phiếu Cầu Vồng + 1 phiếu Cửa Lưới thật trước khi coi là xong (session này chỉ verify được qua tsc/eslint + smoke curl, **chưa xem bằng mắt trên trình duyệt** vì môi trường không có công cụ điều khiển browser).

## Việc phụ (không phải sửa code, không ảnh hưởng deploy)

- **So sánh DB VPS production vs local** (chỉ đọc — dump schema-only + đếm row từng bảng, không kéo data thật về máy): schema khớp 100%; master/reference data khớp 100%; dữ liệu giao dịch đã tách biệt từ go-live 21/07 (như dự kiến); phát hiện role **"kế toán trưởng"** được tạo trực tiếp trên VPS sau go-live, **chưa có ở local** — cần đồng bộ ngược nếu muốn dev/test đúng phân quyền production (chưa làm, đang chờ quyết định của user).
- **Fix phụ không liên quan task chính:** dev server API sập nhiều lần do 1 tính năng khác đang làm dở song song trong repo ("carrier mặc định khách hàng" — sửa `customer.service.ts`, DTOs, `excel.service.ts`, migration `add_customer_default_carrier_info`) — Prisma Client bị stale sau khi schema đổi. Đã chạy `prisma generate` để fix (an toàn, chỉ regenerate code sinh tự động, không đụng migration/data). Không sửa code của tính năng đó.
- **Dev server sập lặp lại nhiều lần** trong suốt phiên do rapid file-save race condition trong `nest start --watch` (lỗi vặt của `@nestjs/cli` trên Windows khi ≥2 lần đổi file cách nhau vài giây, thường do các phiên khác lưu file song song) — chỉ cần khởi động lại `pnpm dev`, không phải lỗi code.
- **Verify quyền "Xem giá vốn" (`quotation.view-cost`)**: user hỏi liệu nút "Xem lãi/lỗ" + cột Giá vốn + Tổng giá vốn + Lợi nhuận có cùng gate theo 1 quyền trong Cài đặt không — kiểm tra thì **đã đúng như vậy từ trước**, không cần sửa gì: nút gate qua `canViewCost`, cột/2 dòng tổng gate qua `showCost = !!costByItemId` (chỉ có khi fetch được cost-summary, chỉ fetch khi có quyền), backend endpoint có `@RequirePermission('quotation.view-cost')`, `findAll()` omit hẳn field khi không có quyền, Settings > Vai trò hiện đúng nhãn "Báo giá" / "Xem giá vốn".

## 7. Bỏ bắt buộc số điện thoại khách hàng ở dialog Sửa địa chỉ giao hàng

Áp dụng cho `DeliveryAddressDialog` — dùng chung ở 3 nơi (Đơn hàng, Phiếu sản xuất, xem trước bản in). Giữ nguyên bắt buộc Tên người nhận, chỉ bỏ bắt buộc SĐT.

- `apps/web/src/components/sales-order/delivery-address-dialog.tsx` — bỏ `required` + dấu `*` ở label SĐT, bỏ check SĐT khỏi validation submit/điều kiện disable nút Lưu.
- `apps/api/src/sales-order/sales-order.service.ts` — bỏ `throw new BadRequestException('Số điện thoại nhận hàng là bắt buộc.')` trong `updateDeliveryAddress()`.
- `apps/api/src/sales-order/sales-order.service.spec.ts` — cập nhật test "bắt buộc deliveryPhone" → "không bắt buộc deliveryPhone" (assert cho phép rỗng). 14/14 test pass.

**Deploy note:** không cần migration — cột `deliveryPhone` vẫn `NOT NULL` ở DB nhưng chuỗi rỗng `""` hợp lệ với constraint đó. Chỉ đổi API + web, an toàn deploy độc lập.

## 8. Cấu hình lại bảng chi tiết báo giá (tab ngoài) & dialog "Xem lãi/lỗ"

Nhiều vòng chỉnh theo phản hồi trực tiếp từ ảnh chụp màn hình của user (căn cột, màu sắc, thứ tự) — ghi lại **trạng thái cuối cùng** sau tất cả vòng lặp, không liệt kê từng bước trung gian.

**`apps/web/src/components/quotation/quotation-item-table.tsx`** (bảng chi tiết ở trang báo giá):
- Thêm cột **STT**.
- Fix bug thẳng cột: các dòng tổng (Tổng tiền hàng/VAT/Giảm thêm/Tổng thanh toán) trước đó dùng chung 1 `colSpan` bị lệch sang cột "Chú thích"/"Giá vốn" thay vì đúng cột "Thành tiền"/"VAT" — sửa lại từng dòng thẳng đúng cột.
- Gộp "Tổng tiền hàng" + "Tổng VAT" thành 1 dòng **"TỔNG"** (như 1 dòng sản phẩm): chữ "TỔNG" thẳng cột "Phụ phí", số liệu rơi đúng cột Thành tiền/VAT.
- Thêm 1 dòng đệm trống tạo khoảng cách giữa dòng sản phẩm và dòng TỔNG.
- **Tổng thanh toán**: chữ thẳng cột với "TỔNG" (bắt đầu từ cột Phụ phí, căn trái), số liệu thẳng cột VAT; gộp chung hàng với "Tổng giá vốn" (khi có quyền xem) — Tổng giá vốn rơi đúng cột "Giá vốn".
- Đổi thứ tự nhóm: Tổng tiền hàng/VAT/Giảm thêm/Thanh toán (ai xem báo giá cũng thấy) đặt **trước** nhóm Giá vốn/Lợi nhuận (chỉ Owner/Admin có quyền `quotation.view-cost`).
- Màu/cỡ chữ theo mức quan trọng: Tổng thanh toán, Tổng giá vốn, Lợi nhuận đều `text-base font-bold` (đồng cỡ); Tổng giá vốn `text-green-400` (xanh nhạt); Lợi nhuận dương `text-green-700` (xanh đậm) kèm dấu `+`, âm `text-destructive` (đỏ, Intl format tự có dấu `-`).
- Fix 1 bug có sẵn từ trước (không phải do phiên này gây ra): `colSpan` dùng cho dòng Tổng giá vốn/Lợi nhuận bị lệch 1 cột khi báo giá đã duyệt (không editable) + có quyền xem giá vốn — nay cố định `colSpan = 10` (đúng số cột cơ bản, không phụ thuộc `editable`).

**`apps/web/src/components/quotation/quotation-margin-dialog.tsx`** (dialog "Xem lãi/lỗ") — gần như viết lại:
- Cột mới: **STT**, **Thông số rút gọn** dưới tên sản phẩm (ưu tiên `valueLabel` ENUM, giống cách bản in báo giá hiển thị), **CK** (chiết khấu %, thay cho cột "Giá bán" cũ), **Phụ phí** (mới).
- Cột "Giá vốn" cũ đổi thành hiển thị **Giá bán** kiểu tab ngoài (số lớn + "đ/m²" nhỏ dưới, hoặc giá hệ thống nếu không theo m²).
- SL dời ra sau nhóm Giá bán/CK/Phụ phí.
- Đổi thứ tự **Tổng giá bán trước, Tổng giá vốn sau**.
- Dòng "Tổng cộng": Tổng giá vốn `text-green-400`, Tổng giá bán `text-foreground` (đen), Lợi nhuận đỏ nếu lỗ / xanh đậm kèm dấu `+` nếu lãi.
- Vì API `cost-summary` không trả `unitPrice`/`discountPercent`/`surchargeAfterDiscount`/`parameters`, dialog nhận thêm prop `items` (ghép từ `quotation.items` đã fetch sẵn ở trang cha theo `quotationItemId`, không gọi thêm API).

**File khác bị đụng theo (nhỏ):**
- `apps/web/src/app/quotations/[id]/page.tsx` — chỉ 2 chỗ: thêm field `valueLabel: string | null` vào interface `QuotationItemParam` (API đã trả sẵn, trước đó TS type thiếu khai báo), thêm prop `items={quotation.items}` khi render `<QuotationMarginDialog>`. **Lưu ý:** file này còn bị 1 phiên khác sửa nhiều chỗ khác song song (xem mục ⚠️ ở trên) — chỉ 2 điểm trên là của phiên này.

**Deploy note:** thuần frontend, không đổi API/DB (trừ mục 7 ở trên cũng không cần migration). An toàn deploy độc lập. Từ mục 10-11 trở đi, user tự chụp ảnh màn hình thật gửi lại sau mỗi vòng chỉnh nên đã **xác nhận bằng mắt qua ảnh user gửi** (không phải tôi tự xem — môi trường không có công cụ điều khiển trình duyệt).

## 10. Layout responsive — sidebar mở rộng đè tràn màn hình trên laptop

**Vấn đề user báo (kèm ảnh chụp thật):** trang báo giá (nhiều cột) bị tràn ngang khi mở rộng sidebar trên màn hình laptop (~1280-1366px) — nội dung bị xô, che mất nút. Yêu cầu: **thu gọn** sidebar thì vẫn thấy toàn màn hình bình thường; **mở rộng** thì chấp nhận sidebar đè lên nội dung (overlay) thay vì đẩy/tràn.

**Đã thử rồi bỏ:** ban đầu nâng ngưỡng "mobile" (`use-mobile.ts`, chỉ Sidebar dùng) từ 768px lên 1280px để mọi thao tác mở sidebar trên laptop dùng kiểu overlay Sheet như mobile — user phản hồi "vẫn chưa ổn" vì cách này xoá luôn thanh icon-rail hẹp vốn vẫn nên hiển thị bình thường lúc thu gọn. Đã revert `use-mobile.ts` về đúng 768px gốc.

**Giải pháp cuối cùng — `apps/web/src/components/ui/sidebar.tsx`:**
- Ô "gap" (khoảng đệm đẩy nội dung, tách biệt với panel sidebar thật vốn `position: fixed`) dưới 1280px (`max-xl:`) giờ **luôn giữ bề rộng bằng lúc thu gọn (icon-width)**, bất kể sidebar đang mở hay đóng. Panel sidebar thật vẫn giãn hết cỡ khi mở như cũ — vì nó `fixed`, việc gap không giãn theo khiến panel tự động **đè lên** nội dung thay vì đẩy. Thêm `shadow-xl` khi ở trạng thái đè (`max-xl:shadow-xl`) để có cảm giác nổi lên trên.
- Fix thêm 1 bug nền khác lộ ra trong lúc tìm nguyên nhân tràn trang (không phải do sidebar, do **thiếu `min-w-0`** ở 2 tầng flex-item liên tiếp): `SidebarInset` (chính nó, không phải `<main>` con bên trong `app-layout.tsx`) là flex-item thật sự nằm cạnh Sidebar trong hàng flex ngoài cùng — thiếu `min-w-0` ở đây thì fix `min-w-0` cho `<main>` con (`app-layout.tsx`) không có tác dụng gì, vì tầng ngoài đã không chịu co lại trước rồi. Đã thêm `min-w-0` cho cả 2 tầng.

**Deploy note:** thuần CSS/layout ở component dùng chung (`ui/sidebar.tsx`, `app-layout.tsx`, `use-mobile.ts`) — áp dụng cho **mọi trang**, không riêng báo giá. An toàn deploy độc lập, không đổi API/DB.

File đã đổi:
- `apps/web/src/components/ui/sidebar.tsx`
- `apps/web/src/components/layout/app-layout.tsx`
- `apps/web/src/hooks/use-mobile.ts` (net không đổi — thử nâng ngưỡng rồi revert về giá trị gốc 768)

## 11. Bảng chi tiết báo giá (tiếp tục mục 8) — nút Nhân đôi dòng, fix tràn cột Chú thích

**`apps/web/src/components/quotation/quotation-item-table.tsx`:**
- **Nút "Nhân đôi dòng"** (icon `Copy`, cạnh nút Sửa) — gọi lại đúng `POST /quotations/:id/items` (API thêm dòng có sẵn) với `productId`/`quantity`/`parameters`/`note` copy từ dòng gốc; giá/chiết khấu/VAT được **BE tự tính lại từ đầu** như thêm dòng mới bình thường, không copy nguyên số đã snapshot. Hàm `duplicateItem()` thêm ở `quotations/[id]/page.tsx`, prop `onDuplicate` mới trên component.
- **Fix tràn cột "Chú thích"** — nhiều vòng thử theo ảnh chụp thật user gửi, ghi lại đúng thứ tự nguyên nhân đã lần lượt phát hiện (đáng chú ý vì mỗi lần tưởng xong lại lộ nguyên nhân sâu hơn):
  1. Chữ dài không xuống hàng, tràn đè cột kế bên → do `TableCell` gốc (`ui/table.tsx`) có sẵn `whitespace-nowrap` mặc định — phải override `whitespace-normal` mới xuống hàng được.
  2. Xuống hàng đúng nhưng **cột** vẫn không nhỏ lại → do bảng dùng `table-layout: auto` + `w-full`, browser tự giãn cột không có `width` cứng (chỉ có `max-width`) ra hấp thụ khoảng trống thừa. **Fix triệt để:** chuyển cả bảng sang `table-layout: fixed` + `<colgroup>` khai báo % cố định cho từng cột (STT 4%, Sản phẩm 18%, Thông số 15%, Giá bán 9%, Chiết khấu 7%, Phụ phí 7%, SL 4%, Thành tiền 9%, VAT 8%, Chú thích 7%, Giá vốn 8% nếu có quyền, cột action **116px cố định** — px chứ không phải % vì 3 nút icon cố định kích thước, % nhỏ ở màn hẹp sẽ làm nút tràn đè cột trước, đã tự gặp lỗi này 1 lần rồi sửa lại).
  3. Đổi `table-fixed` kéo theo hệ quả: các cột khác (Sản phẩm, VAT, Phụ phí, Thành tiền, Giá vốn, và toàn bộ nhóm dòng tổng TỔNG/Tổng thanh toán/Giảm thêm/Lợi nhuận) trước đó dựa vào `auto` tự giãn để hiện đủ chữ 1 dòng — nay bị khoá cứng bề rộng nên chữ tràn/đè nhau (đặc biệt ô "Tổng giá vốn (ước tính)" trong hàng gộp chung với "Tổng thanh toán", chỉ nằm gọn 1 cột ~7%). Đã thêm `whitespace-normal break-words` cho toàn bộ các ô này để phòng ngừa triệt để, không riêng chỗ vừa lộ lỗi.
- **Cỡ chữ nhóm dòng tổng** (TỔNG, Tổng thanh toán, Tổng giá vốn, Lợi nhuận, Giảm thêm): giảm từ `text-base` xuống `text-sm` cho cân đối hơn — user phản hồi `text-base` (đặt ở bước mục 8) nhìn to/lệch tỉ lệ so với phần còn lại của bảng.
- Dọn 1 class `w-48` thừa ở cột Thông số (không còn tác dụng gì sau khi có colgroup).

**Deploy note:** thuần frontend (1 file), không đổi API/DB. An toàn deploy độc lập.

File đã đổi thêm (ngoài mục 8):
- `apps/web/src/components/quotation/quotation-item-table.tsx` (đã liệt kê ở mục 8, tiếp tục sửa nhiều ở đây)
- `apps/web/src/app/quotations/[id]/page.tsx` (thêm hàm `duplicateItem()` + wiring prop `onDuplicate` — cùng file đã lưu ý bị phiên khác đụng song song ở mục ⚠️ bên dưới)

## 12. Mặc định Ngày hết hạn/Hạn giao hàng khi tạo báo giá mới

`apps/web/src/app/quotations/new/page.tsx` — 2 ô ngày (vẫn tuỳ chọn, sửa/xoá tự do như trước) nay có giá trị khởi tạo mặc định thay vì rỗng:
- **Ngày hết hạn**: ngày tạo **+1**.
- **Hạn giao hàng**: ngày tạo **+2**.

Thêm helper `toDateInputValue()`/`addDays()` tính theo giờ **local** (không dùng `toISOString()` vì quy đổi UTC có thể lệch ngày tuỳ múi giờ máy).

**Deploy note:** thuần frontend (1 file), không đổi API/DB. An toàn deploy độc lập.

## ⚠️ Lưu ý quan trọng cho việc tổng hợp/phân tích deploy

Tại thời điểm cuối phiên, `git status` cho thấy working tree **có lẫn thay đổi từ (các) phiên/công việc khác**, không phải do phiên này tạo ra — cần tách riêng khi phân tích:

- `apps/web/package.json`, `pnpm-lock.yaml` — không rõ nguồn gốc, không phải phiên này.
- `apps/web/src/app/quotations/[id]/page.tsx`, `apps/web/src/app/quotations/[id]/print/page.tsx` — không phải phiên này (có vẻ tính năng "xuất báo giá" đang làm dở). **Cập nhật 2026-07-25: đã hoàn thành ở 1 phiên khác cùng ngày — xem mục 9.**
- File mới `apps/web/src/components/quotation/export-quotation-menu.tsx`, `apps/web/src/lib/quotation-image.ts` — không phải phiên này. **Xem mục 9.**
- Tính năng "carrier mặc định khách hàng" (`apps/api/src/customer/...`, migration `20260724043144_add_customer_default_carrier_info`) — không phải phiên này, chỉ chạm vào để fix Prisma Client generation.
- Một số file **của phiên này** (`login-form.tsx`, `header-status-indicator.tsx`, `header.tsx`, `login/page.tsx`) đang ở trạng thái **staged** trong git dù phiên này không chạy `git add` — có khả năng do phiên/công cụ khác stage. Cần kiểm tra lại trước khi commit để không gộp nhầm.

## 4. [Đã tách sang file riêng] Nhà xe mặc định khách hàng, Preview import Excel, Chuẩn hoá Rộng/Cao phiếu SX

Nội dung trước đây ở mục này đã chuyển sang `workbench/sessions/2026-07-25-customer-import-carrier-print-dimension.md` (2 đợt đầu đã commit + deploy lên production, 2 phần sau chưa commit/deploy) — xem file đó để tránh trùng lặp.

## 5. [Phiên khác — Customer/Quotation] Chiết khấu Khách hàng đổi từ theo Sản phẩm sang theo Loại sản phẩm

Ghi lại bởi 1 phiên Claude Code khác chạy song song trong cùng repo (không phải phiên viết mục 1-3, cũng không phải phiên viết mục 4). **Chưa commit, chưa deploy.**

**Yêu cầu:** cơ chế `CustomerProductDiscount` (Sprint 04, chốt 16/07/2026) trước đó cấu hình % chiết khấu riêng theo từng **sản phẩm** cụ thể (khách A × SP000036) — đổi thành cấu hình theo **loại sản phẩm** (`ProductType`, vd "Rèm cầu vồng"), áp dụng cho mọi sản phẩm cùng loại thay vì phải cấu hình lặp lại từng sản phẩm.

- **DB**: migration `20260724105330_customer_discount_by_product_type` — `CustomerProductDiscount.productId` → `productTypeId` (FK `ProductType`), unique đổi `(customerId, productId)` → `(customerId, productTypeId)`. Migration tự backfill `productTypeId` từ `products.product_type_id` trước khi drop cột cũ — đã apply lên DB dev local, verify đúng 1 dòng dữ liệu cũ (NK BỘ NGOAN × "Cửa xếp" = 60%) migrate không mất dữ liệu, không xung đột unique (tại thời điểm đổi DB dev chỉ có đúng 1 dòng).
- **BE**: `customer.service.ts` (CRUD chiết khấu thao tác theo `ProductType`), `dto/create-customer-product-discount.dto.ts` (`productId` → `productTypeId`), `quotation-workflow.service.ts` (lookup snapshot lúc thêm dòng báo giá đổi từ `(customerId, productId)` sang `(customerId, product.productTypeId)`). Endpoint lookup `GET /customers/:id/product-discounts/lookup?productId=` **giữ nguyên tham số `productId`** (người lập báo giá vẫn chọn sản phẩm cụ thể như cũ) — backend tự suy ra loại sản phẩm để tìm %, không đổi UX màn thêm dòng báo giá.
- **FE**: `customer-product-discount-dialog.tsx`/`-list.tsx` (trang chi tiết khách hàng) — đổi từ chọn sản phẩm (`ProductTypeahead`) sang chọn loại sản phẩm (Select, tái dùng API `/product-types` có sẵn); `customers/[id]/page.tsx` cập nhật interface theo; `quotation-item-dialog.tsx` chỉ đổi nhãn hiển thị (không đổi logic gọi API).
- **Docs**: `knowledge/modules/customer.md` (mục "Chiết khấu loại sản phẩm"), `knowledge/modules/quotation.md` (mục Discount Engine), `workbench/sprint-04/005-chiet-khau-khach-hang-vat-bao-gia.md` (thêm ghi chú follow-up).
- **Đã verify**: `tsc --noEmit` sạch cả API/web; `nest build` + `next build` pass; `jest` toàn bộ API — 288/288 pass (đã sửa `quotation-workflow.service.spec.ts` theo schema mới). Verify thực tế qua script Prisma trực tiếp trên DB dev: chiết khấu 60% cấu hình cho loại "Cửa xếp" nay áp dụng đúng cho SP000053 (sản phẩm khác SP000052 ban đầu, cùng loại) — xác nhận đúng mục tiêu thay đổi. **Chưa test bằng mắt trên trình duyệt.**
- **Deploy note**: có migration DB — cần backup trước deploy như các đợt trước. **Rủi ro cần lưu ý riêng cho VPS**: nếu `customer_product_discounts` trên production có nhiều dòng hơn DB dev (đặc biệt nếu 1 khách có ≥2 dòng chiết khấu cho các sản phẩm cùng loại với % khác nhau), migration sẽ **fail** khi tạo unique index mới do trùng `(customer_id, product_type_id)` — phải kiểm tra dữ liệu thật trên VPS trước khi deploy migration này, không giả định giống local.

File đã đổi (chưa commit):
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260724105330_customer_discount_by_product_type/` (mới)
- `apps/api/src/customer/customer.service.ts`
- `apps/api/src/customer/dto/create-customer-product-discount.dto.ts`
- `apps/api/src/quotation/quotation-workflow.service.ts`
- `apps/api/src/quotation/quotation-workflow.service.spec.ts`
- `apps/web/src/app/customers/[id]/page.tsx`
- `apps/web/src/components/customer/customer-product-discount-dialog.tsx`
- `apps/web/src/components/customer/customer-product-discount-list.tsx`
- `apps/web/src/components/quotation/quotation-item-dialog.tsx`
- `knowledge/modules/customer.md`
- `knowledge/modules/quotation.md`
- `workbench/sprint-04/005-chiet-khau-khach-hang-vat-bao-gia.md`

## 6. [Phiên khác — Quotation] Cho đổi khách hàng trên báo giá đang Nháp

Ghi lại bởi 1 phiên Claude Code khác chạy song song trong cùng repo (không phải phiên viết mục 1-3, 4, hay 5 ở trên — nối tiếp ngay sau phiên viết mục 5). **Chưa commit, chưa deploy.**

**Yêu cầu:** tab Báo giá thêm khả năng đổi khách hàng khi đơn đang "Nháp"; nếu đơn đã "Gửi" mà Override thủ công về lại "Nháp" thì vẫn đổi được.

- **BE**: `dto/update-quotation.dto.ts` thêm `customerId` optional. `quotation-workflow.service.ts` `update()` — cho đổi `customerId` qua `PATCH /quotations/:id` (dialog "Sửa thông tin" có sẵn, trước đó chỉ sửa được Ngày hết hạn/Hạn giao hàng/Ghi chú), **chỉ khi status hiện tại là DRAFT** (chặt hơn `EDITABLE_STATUSES` chung DRAFT+SENT đang áp dụng cho các field khác) — check dựa vào status hiện tại nên đơn bị Manual Override từ SENT về DRAFT vẫn đổi được, đúng yêu cầu. Validate khách hàng mới tồn tại (`deletedAt: null`).
- **Quyết định nghiệp vụ đã hỏi và chốt với user**: nếu báo giá đã có dòng sản phẩm, đổi khách hàng thì **tự động snapshot lại `discountPercent`** cho toàn bộ dòng theo Chiết khấu Khách hàng × Loại sản phẩm của khách hàng MỚI (lookup `CustomerProductDiscount(customerId, productTypeId)`, tính lại `finalPrice`/`subtotal`/`vatAmount` bằng đúng công thức Discount Engine hiện có) — 2 phương án khác đã bị từ chối: (a) chặn đổi nếu đã có dòng, (c) giữ nguyên chiết khấu cũ không tự sửa.
- **FE**: `quotations/[id]/page.tsx` — dialog "Sửa thông tin" thêm ô chọn khách hàng (tái dùng `CustomerTypeahead` đã có ở form tạo báo giá mới), chỉ hiện ô chọn khi `status === "DRAFT"`; khi SENT hiển thị tên khách read-only kèm ghi chú lý do không sửa được. Validate FE bắt buộc chọn khách hàng trước khi submit khi đang DRAFT.
- **Quyết định phụ**: không ghi Timeline riêng cho hành động đổi khách hàng — giữ nhất quán với tiền lệ sẵn có (sửa Ngày hết hạn/Hạn giao hàng/Ghi chú qua cùng dialog cũng không ghi Timeline).
- **Đã verify**: `tsc --noEmit` sạch cả API/web; `nest build` + `next build` pass; thêm 4 test case mới cho `update()` (chặn đổi khi SENT, 404 khi khách hàng mới không tồn tại, snapshot lại đúng % khi khách mới có cấu hình chiết khấu, về 0% khi khách mới chưa cấu hình) — toàn bộ `jest` API 292/292 pass. **Chưa test bằng mắt trên trình duyệt.**
- **Deploy note**: không có migration DB mới (chỉ sửa comment trong `schema.prisma` cho khớp thực tế `productTypeId`, không đổi cấu trúc). Chỉ đổi API + web, an toàn deploy độc lập — nhưng nên deploy **sau** mục 5 (đổi Chiết khấu theo Loại sản phẩm) vì tính năng này phụ thuộc trực tiếp `CustomerProductDiscount.productTypeId`.

File đã đổi (chưa commit):
- `apps/api/prisma/schema.prisma` (chỉ sửa comment)
- `apps/api/src/quotation/dto/update-quotation.dto.ts`
- `apps/api/src/quotation/quotation-workflow.service.ts`
- `apps/api/src/quotation/quotation-workflow.service.spec.ts`
- `apps/web/src/app/quotations/[id]/page.tsx`

## Danh sách file đã đổi trong phiên này (để đối chiếu khi tổng hợp)

**Mới:**
- `apps/web/src/app/login/login-form.tsx`
- `apps/web/src/components/layout/header-status-indicator.tsx`

**Sửa:**
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/components/layout/header.tsx`
- `apps/web/src/app/production/print/page.tsx`

**Không đổi net (thêm rồi xoá lại trong phiên):**
- `apps/web/src/app/globals.css`

**Đã tạo rồi xoá trong phiên (không còn tồn tại):**
- `apps/web/src/components/layout/route-progress-bar.tsx`
- `apps/web/src/components/layout/header-glow-dot.tsx`

## 9. [Phiên khác — Quotation] Sao chép ảnh báo giá + thiết kế lại bản in

Ghi lại bởi 1 phiên Claude Code khác chạy song song trong cùng repo, ngày 2026-07-24 → 2026-07-25 (không phải phiên viết mục 1-3, 4, 5, hay 6). **Chưa commit, chưa deploy.**

### 9.1 Chức năng mới — "Sao chép ảnh báo giá" (kiểu Copy as Picture của Excel)

**Yêu cầu gốc:** kế toán gửi báo giá cho khách chủ yếu qua Zalo/Messenger — cần bấm 1 nút là có ảnh PNG trong clipboard, dán thẳng vào chat, không cần tải file thủ công.

**Kiến trúc đã chọn:** `html-to-image` (nhẹ hơn html2canvas, render text sắc nét hơn do giữ vector tới bước rasterize cuối) — capture trực tiếp DOM của `quotations/[id]/print/page.tsx` để đảm bảo ảnh luôn đồng bộ 100% với mẫu PDF, không tồn tại 2 mẫu báo giá khác nhau.

- **`apps/web/src/lib/quotation-image.ts`** (mới) — `captureQuotationImage()` (capture DOM → Blob PNG), `copyImageToClipboard()`/`isClipboardImageSupported()` (Clipboard API + feature-detect), `downloadImageBlob()` (fallback khi trình duyệt không hỗ trợ), `loadHiddenPrintFrame()` (dựng iframe ẩn trỏ `/print`, dùng khi cần chụp ngay từ trang chi tiết mà không mở tab mới).
- **`apps/web/src/components/quotation/export-quotation-menu.tsx`** (mới) — split-button dùng chung 2 nơi: nút chính "Sao chép ảnh báo giá", mũi tên nhỏ mở dropdown "Xuất PDF" / "Xuất cả PDF và ảnh". 2 chế độ `mode="inline"` (trang `/print` tự chụp DOM đang hiển thị) và `mode="iframe"` (trang khác chụp qua iframe ẩn).
- `apps/web/package.json`, `pnpm-lock.yaml` — thêm dependency `html-to-image`.

**Diễn biến đổi ý theo phản hồi (chỉ trạng thái cuối còn tồn tại trong code):**
- Ban đầu thiết kế cắt ảnh thành nhiều trang theo khổ A4 (đo ranh giới `<tr>` gần nhất, không cắt giữa dòng sản phẩm) khi nội dung dài hơn 1 trang — **đã bỏ hẳn**: user chốt luôn xuất **1 ảnh duy nhất** từ trên xuống hết nội dung bất kể độ dài bảng, vì ảnh chỉ dùng để chụp gửi chứ không cần khớp khổ in. Hàm đổi tên `captureQuotationPages()` (trả `Blob[]`) → `captureQuotationImage()` (trả `Blob` đơn). Dialog chọn từng trang (`PagePreviewRow`) trong `export-quotation-menu.tsx` đã xoá theo.
- Nút trên **trang chi tiết báo giá**: ban đầu dùng `ExportQuotationMenu mode="iframe"` (bấm là copy ảnh ngay, không cần mở tab) — user yêu cầu đổi lại thành nút đơn giản **"In Đơn"**, bấm chỉ mở tab `/print` như hành vi "Tải PDF" cũ (3 lựa chọn export nằm hết trong trang `/print`). Styling nút "In Đơn": nền đỏ nhạt/viền đỏ đậm + `animate-pulse`, sau đó đổi tông sang xanh dương theo yêu cầu tiếp theo. **`mode="iframe"` và `loadHiddenPrintFrame()` hiện không còn nơi nào gọi tới** (không xoá — giữ lại làm API tái sử dụng được, không phải dead code do sai sót).

**Bug đã gặp và fix trong lúc làm:**
- `document.fonts.ready` ban đầu chờ theo `document` toàn cục thay vì `root.ownerDocument` — sai khi capture từ trong iframe (mỗi document có `FontFaceSet` riêng, chờ nhầm document thì fonts trong iframe có thể chưa kịp load lúc chụp).
- Ảnh chụp ra bị lệch/cắt nội dung (user gửi ảnh chụp thật minh hoạ) — nghi nguyên nhân: `#quotation-print-content` dùng `margin: "0 auto"` tự canh giữa, khiến `html-to-image` đo sai offset khi tạo bản clone để render. **Đã fix:** ép tường minh `width`/`height` theo `scrollWidth`/`scrollHeight` thật + override `style: { margin: "0", transform: "none" }` trên bản clone khi gọi `toCanvas()`. Nhân tiện phát hiện thêm 1 bug tiềm ẩn: iframe ẩn trong `loadHiddenPrintFrame()` cứng `width: 820px` trong khi nội dung báo giá đã nới lên `maxWidth: 980px` ở 1 bước chỉnh trước đó (mục 9.2) — đã nới iframe lên `1040px`. **⚠️ Chưa có ảnh chụp xác nhận lại sau fix này — cần test lại trước khi coi là xong.**

### 9.2 Thiết kế lại bản in báo giá — `apps/web/src/app/quotations/[id]/print/page.tsx`

Rất nhiều vòng chỉnh trực tiếp theo ảnh chụp màn hình user gửi (căn lề, màu sắc, cấu trúc bảng, gộp/tách khối) — chỉ ghi **trạng thái cuối cùng**, không liệt kê từng bước trung gian.

**Định hướng đổi 2 lần:**
1. Ban đầu mượn phong cách `WorkshopOrderContent` (mẫu phiếu sản xuất xưởng thật đang dùng — viền đen mảnh, header lưới 3 cột, tông đơn sắc).
2. User gửi ảnh chụp mẫu "Hoá đơn bán hàng" thật công ty đang dùng (file Excel) → **đổi hẳn hướng** sang layout đó: tông xanh dương/đỏ, header công ty+tiêu đề xếp chồng giữa trang, bảng có cột Rộng/Cao/M2 riêng, khối công nợ kiểu I/II/III/IV.

**Trạng thái cuối cùng:**
- **Header**: logo `position:absolute` lệch trái (không tính vào canh giữa) + khối chữ công ty (tên đỏ đậm, địa chỉ kèm SĐT cùng dòng, email/website/MST dòng nhỏ dưới) + tiêu đề "BÁO GIÁ"/"XÁC NHẬN ĐƠN HÀNG" (xanh dương đậm) canh giữa độc lập theo tâm trang. Watermark logo mờ nền `opacity: 0.08` — dùng lại đúng thông số/cách làm của `AppLayout` (trang chủ và mọi trang trong app).
- Dòng **"Khách hàng: {tên}"** đối diện **"Mã báo giá: {code}"** (hoặc "Mã đơn hàng" khi đã duyệt) cùng 1 hàng, trái/phải.
- **Bảng chi tiết 12 cột**: STT / Sản phẩm / Rộng / Cao / SL / M2 / Đơn giá / Thành Tiền / Mức thuế VAT / Tiền Thuế / Thành tiền (bao gồm VAT, xuống dòng ở "(bao gồm VAT)") / Chú thích.
  - Rộng/Cao đọc thẳng giá trị tham số đã lưu — **đơn vị MÉT, không quy đổi** (xác nhận lại với user: ban đầu nhầm tưởng lưu mm theo cách phiếu sản xuất hiển thị, thực tế `product.md` mục "Quy ước đơn vị kích thước" ghi rõ nhập theo mét). Hiển thị 3 chữ số sau dấu phẩy (`fmt3`, vd "1,200").
  - M2 = Rộng × Cao × SL, tính tại thời điểm hiển thị (Derived Data hợp lệ theo CLAUDE.md — không lưu thêm field).
  - Rộng/Cao/SL in đậm. Đơn giá kèm "/m²" ngay sau số khi có `unitPrice` (vd "385.000/m²").
  - **Gộp dòng theo `rowSpan`** ở cột Sản phẩm khi cùng mã sản phẩm + cùng toàn bộ thông số khác Rộng/Cao — dùng đúng rule "Cửa Lưới" bên phiếu sản xuất (`groupItemsForDisplay()`, mới thêm). Cách trình bày trong ô gộp (tên nhỏ màu xám + thông số đậm không kèm nhãn) copy đúng theo `WorkshopOrderContent`, không phải `GenericOrderContent` (mẫu dự phòng gần như không dùng thực tế — nhầm lẫn ban đầu, đã sửa lại theo ảnh chụp thật user gửi).
  - Cột **Chú thích**: cảnh báo Validation Rule (WARN, màu cam) + Ghi chú người dùng — tách hẳn khỏi cột Sản phẩm, luôn hiện theo từng dòng kể cả khi Sản phẩm đã gộp.
  - Hàng **"TỔNG"** cuối bảng (có dòng đệm trống phía trên tạo khoảng cách, nền vàng nhạt `#fef3c7` — đã thử đỏ nhạt trước, đổi theo đề xuất) — chữ "TỔNG" ở cột Đơn giá, số liệu là tổng nguyên trạng 3 cột Thành Tiền / Tiền Thuế / Thành tiền (bao gồm VAT), **không trừ Giảm thêm** cấp báo giá (số đó phản ánh riêng ở khối công nợ bên dưới).
- Khối **"Tình hình công nợ"** tách riêng thành card viền bo góc (không gộp vào bảng — đã thử gộp theo kiểu I/II/III/IV rồi bỏ theo yêu cầu sau). "Trước VAT"/"Sau VAT" in đậm gạch chân; "Công nợ cũ" màu đỏ, "Đã thanh toán" màu xanh lá, "Tổng phải thanh toán" xanh dương đậm.
- Khối chữ ký **giữ nguyên "Khách hàng" / "Đại diện công ty"** (có đóng dấu đè) — **không** đổi thành "Người lập phiếu"/"Người nhận hàng" như ảnh mẫu hoá đơn, vì đây là bước khách **duyệt** báo giá/đơn hàng, khác bản chất phiếu giao nhận nội bộ (quyết định chủ động của phiên, có nêu rõ lý do cho user, chưa bị phản đối).
- Bề ngang nới từ 780px → 980px — không cần khớp khổ A4 vì trang chủ yếu dùng để chụp ảnh, không dùng để in (`@page A4` vẫn giữ nguyên, chỉ còn tác dụng cho nút "Xuất PDF").

**Đã thử rồi bỏ theo phản hồi:** khối "Tổng đơn" tách riêng dạng card 2 cột Trước VAT/Sau VAT (bố cục giống hệt khối công nợ) — sau khi làm xong, user yêu cầu bỏ hẳn, chuyển lại thành hàng "TỔNG" gộp trong bảng như mô tả ở trên.

**Deploy note:** thuần frontend, không đổi API/DB — chỉ cần cài thêm `html-to-image` khi deploy (`pnpm install`). An toàn deploy độc lập.

**Đã verify:** `tsc --noEmit` + `eslint` chạy sạch sau **mọi** vòng chỉnh trong suốt phiên (không có lỗi mới phát sinh, chỉ còn đúng loại lỗi baseline có sẵn từ trước — `react-hooks/set-state-in-effect`, `react-hooks/immutability` — trùng khớp pattern đã tồn tại sẵn ở các file khác như `production/print/page.tsx`, không phải do phiên này gây ra). **Không có công cụ điều khiển trình duyệt trong môi trường này** — toàn bộ vòng lặp thiết kế được xác nhận qua ảnh chụp màn hình thật user tự chụp và gửi lại sau mỗi lần chỉnh (không phải tự quan sát trực tiếp). Riêng bug lệch ảnh chụp mục 9.1 vừa fix ở cuối phiên — **chưa có ảnh xác nhận lại, cần test tiếp**.

File đã đổi (chưa commit):
- Mới: `apps/web/src/lib/quotation-image.ts`, `apps/web/src/components/quotation/export-quotation-menu.tsx`
- Sửa: `apps/web/src/app/quotations/[id]/print/page.tsx`, `apps/web/src/app/quotations/[id]/page.tsx`, `apps/web/package.json`, `pnpm-lock.yaml`
