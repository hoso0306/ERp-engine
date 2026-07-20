# Milestone (Sprint 04) - Xem Giá vốn/Lợi nhuận Báo giá (chỉ Owner/Admin) + Fix bug plannedCost luôn = 0

> **Tên file:** `workbench/sprint-04/022-gia-von-loi-nhuan-bao-gia-fix-planned-cost.md`
> **Trạng thái:** ✅ HOÀN THÀNH (20/07/2026) — Việc 12 (verify qua trình duyệt) bỏ qua theo quyết định của người dùng; đã verify gián tiếp: 288/288 test pass, backfill đối chiếu DB dev đúng (4/4 SalesOrder `plannedCost > 0`, 7 OrderBOM, 0 item thiếu `materialRequirementVersionId`), seed permission đúng (chỉ OWNER/ADMIN có `quotation.view-cost`).

---

# Bối cảnh

Chủ doanh nghiệp muốn xem được lãi/lỗ ngay khi đang xem một báo giá (thường là trước khi khách duyệt — Draft/Sent), để quyết định có nên tiếp tục thương lượng hay không. Yêu cầu gốc:

1. Nút trên trang chi tiết báo giá → mở bảng trực quan: từng sản phẩm (giá vốn, giá bán, tổng giá vốn, tổng giá bán không VAT, lợi nhuận).
2. Bảng sản phẩm trong trang chi tiết: thêm cột "Giá vốn" sau cột "Chú thích", thêm dòng tổng "Tổng giá vốn"/"Lợi nhuận".
3. Trang danh sách báo giá (`/quotations`): thêm cột "Ghi chú" + 2 cột "Tổng giá vốn"/"Lợi nhuận" cạnh "Tổng tiền".
4. Toàn bộ dữ liệu giá vốn/lợi nhuận **chỉ OWNER và ADMIN** xem được (SALES, MANAGER, VIEWER... không thấy).

Trong lúc khảo sát phát hiện thêm 1 bug độc lập, người dùng xác nhận sửa luôn trong cùng milestone này:

**Bug: `plannedCost` luôn = 0 khi Approve báo giá.** `QuotationItem.materialRequirementVersionId` không bao giờ được set ở `addItem`/`updateItem`. Tại `approve()` (`quotation-workflow.service.ts`), vòng lặp validate (dòng 967-1005) **đã** resolve đúng Material Requirement Version đang ACTIVE của từng sản phẩm (biến `activeMaterialVersion`) và validate nó tồn tại — nhưng vòng lặp tính BOM ngay sau đó (dòng 1066-1092) lại đọc nhầm từ `item.materialRequirementVersionId` (luôn `null`) thay vì dùng giá trị `activeMaterialVersion.id` vừa resolve. Hệ quả:

- `SalesOrder.plannedCost` / `SalesOrderItem.plannedCost` luôn = 0 → `plannedProfit` bị thổi phồng bằng đúng doanh thu (Dashboard "Lợi nhuận kế hoạch" sai).
- `OrderBOM`/`OrderBOMItem` (danh sách vật tư cho Phiếu sản xuất, đọc bởi `production-order.service.ts:179`) không bao giờ được tạo.

**Khảo sát DB dev (20/7/2026):** 4/4 `SalesOrder` hiện có `plannedCost = 0`, 0 `OrderBOM` nào tồn tại, 0/7 `SalesOrderItem` có `materialRequirementVersionId` — khớp 100% với phân tích bug. 12 sản phẩm đang có Material Requirement Version ACTIVE nên backfill tính được.

---

# Phạm vi

## Trong phạm vi

- Permission mới `quotation.view-cost`, seed riêng cho OWNER + ADMIN (không cho SALES dù SALES đang lấy toàn bộ action của resource `quotation`).
- Backend: tính giá vốn ước tính real-time (mọi trạng thái báo giá, kể cả Approved — không đọc `plannedCost` đã snapshot vì đang bug) dùng lại BOM Engine.
- Backend: endpoint chi tiết `GET /quotations/:id/cost-summary` + mở rộng `GET /quotations` (list) thêm `totalCost`/`profit` per-quotation khi có quyền.
- Frontend: cột "Giá vốn" + dòng tổng trong bảng sản phẩm; nút "Xem lãi/lỗ" + Dialog; cột "Ghi chú" + "Tổng giá vốn"/"Lợi nhuận" ở trang danh sách.
- Fix bug `approve()`: dùng đúng `activeMaterialVersion.id` đã resolve thay vì field luôn null.
- Backfill dữ liệu cũ: recompute `SalesOrder.plannedCost/plannedProfit`, `SalesOrderItem.plannedCost`, tạo `OrderBOM`/`OrderBOMItem` còn thiếu cho các đơn đã Approve trước đây.
- Cập nhật `knowledge/modules/quotation.md`, `permission.md`.

## Ngoài phạm vi (không đụng trong task này)

- Không sửa `addItem`/`updateItem` để snapshot `materialRequirementVersionId` sớm ở Draft — không cần thiết vì đúng thiết kế đã chốt: giá vốn/BOM tính tại Approve bằng version ACTIVE hiện tại, không snapshot sớm như Pricing Rule.
- Không bật lại module Kho / xuất kho tự động — đang chủ động tắt (chốt 18/07/2026), không liên quan bug này.
- Không xây dựng hệ thống Field Permission tổng quát — chỉ thêm đúng 1 permission key cho nhu cầu này (permission.md xác nhận Field Permission là "Không làm trong V1").

---

# Quyết định kỹ thuật (đã chốt với người dùng)

1. **Nguồn giá vốn cho tính năng xem lãi/lỗ:** tính real-time bằng BOM Engine + Material Requirement Version đang ACTIVE của từng sản phẩm, áp dụng cho **mọi trạng thái báo giá** (kể cả Approved) — không đọc `plannedCost` đã snapshot trên SalesOrderItem (đang bug = 0 cho đến khi backfill xong). Ghi rõ đây là "ước tính" vì không snapshot cứng như giá bán.
2. **Vị trí cột:**
   - Bảng sản phẩm (`quotation-item-table.tsx`): cột "Giá vốn" (đơn giá, sau "Chú thích") + dòng tổng "Tổng giá vốn"/"Lợi nhuận" cạnh "Tổng tiền hàng".
   - Trang danh sách (`quotation-table.tsx`): cột "Ghi chú" (field `note` đã fetch sẵn, chưa hiển thị) + 2 cột "Tổng giá vốn"/"Lợi nhuận" cạnh "Tổng tiền" — **không** thêm cột "Giá vốn" riêng ở đây vì mỗi dòng = 1 báo giá (nhiều sản phẩm), trùng với "Tổng giá vốn".
3. **Permission:** `quotation.view-cost` — OWNER + ADMIN có (qua `allKeys()`), **SALES phải lọc trừ** permission này ra khỏi `...keysForResource('quotation')` trong seed. MANAGER/VIEWER không nhận (không nằm trong `viewKeys()` hay nhóm `approve/override/cancel`).
4. **List endpoint bảo mật ở tầng API:** `findAll` chỉ trả `totalCost`/`profit` khi role có `quotation.view-cost` (check qua `PermissionService.hasPermission`) — không dựa vào FE ẩn cột.
5. **Fix bug Approve:** dùng đúng `activeMaterialVersion.id` (đã resolve ở vòng lặp validate) cho vòng lặp tính BOM + khi lưu `materialRequirementVersionId` vào `SalesOrderItem`/`OrderBOM`. Không đổi `addItem`/`updateItem`.
6. **Backfill:** dùng Material Requirement Version đang ACTIVE **hiện tại** để tính lại (không có cách khôi phục chính xác version tại thời điểm Approve lịch sử vì thông tin đó chưa từng được lưu — giới hạn đã ghi nhận). Script tạm (`apps/api/scripts-tmp/`), không commit, xoá sau khi verify — theo đúng tiền lệ milestone `006`.
7. **DRY:** 1 helper dùng chung `estimateItemsCost()` cho cả cost-summary endpoint, list endpoint, và backfill script — tránh viết lại logic BOM 3 lần.

---

# Việc 1 — Fix bug: `approve()` dùng đúng Material Requirement Version đã resolve

- [ ] `quotation-workflow.service.ts`: trong vòng lặp validate (967-1005), lưu `activeMaterialVersion.id` vào `Map<itemId, string>`.
- [ ] Vòng lặp tính BOM (1066-1092): dùng map thay vì `item.materialRequirementVersionId`.
- [ ] Khi tạo `SalesOrderItem` (dòng ~1214) và `OrderBOM` (dòng ~1238): dùng giá trị đã resolve từ map thay vì field luôn null.
- [ ] `quotation-workflow.service.spec.ts`: sửa mock sản phẩm có `materialRequirement.versions` ACTIVE thay vì set `materialRequirementVersionId` trực tiếp lên item; assert `plannedCost`/`OrderBOM` được tính đúng.

# Việc 2 — Permission `quotation.view-cost`

- [ ] `apps/api/prisma/seed.ts`: thêm `'view-cost'` vào `PERMISSION_CATALOG.quotation`.
- [ ] Role SALES: đổi `...keysForResource('quotation')` → lọc trừ `quotation.view-cost`.
- [ ] Chạy lại seed trên DB dev, xác nhận OWNER/ADMIN có permission mới, SALES/MANAGER/VIEWER không có.

# Việc 3 — Backend: helper tính giá vốn ước tính dùng chung

- [ ] `quotation-workflow.service.ts`: thêm private helper `estimateItemsCost(items)` — batch fetch Material Requirement Version ACTIVE theo `productId` (1 query cho nhiều item/nhiều quotation), gọi `bomEngine.calculateBom()` per item, trả `{itemId, costUnitPrice, totalCost, costAvailable}[]`.

# Việc 4 — Backend: endpoint `GET /quotations/:id/cost-summary`

- [ ] DTO response: items (`productId/productCode/productName/quantity/costUnitPrice/saleUnitPrice/totalCost/totalSale/profit/costAvailable`) + `totals` + `hasIncompleteData`.
- [ ] `quotation.controller.ts`: route mới, `@RequirePermission('quotation.view-cost')`.
- [ ] `quotation-workflow.service.ts`: method `getCostSummary(id)` dùng helper Việc 3, `saleUnitPrice = finalPrice`, `totalSale = subtotal` (đã không VAT sẵn).

# Việc 5 — Backend: mở rộng `GET /quotations` (list) với `totalCost`/`profit`

- [ ] `quotation.controller.ts`: `findAll` lấy thêm `roleId` từ `req.user`, truyền xuống service.
- [ ] `quotation-workflow.service.ts`: `findAll()` check `permissionService.hasPermission(roleId, 'quotation.view-cost')`; nếu có, batch tính `totalCost`/`profit` cho các quotation trong trang hiện tại bằng helper Việc 3 (1 lần batch, không N+1 theo từng quotation).
- [ ] Không có quyền → không trả field này (không phải trả `null`, mà omit hẳn).

# Việc 6 — Frontend: cột Giá vốn trong bảng sản phẩm (trang chi tiết)

- [ ] `quotations/[id]/page.tsx`: gọi `GET /quotations/:id/cost-summary` khi `hasPermission("quotation.view-cost")`, truyền data xuống `QuotationItemTable`.
- [ ] `quotation-item-table.tsx`: prop `costByItemId?: Map<...>`, render cột "Giá vốn" (sau "Chú thích") + dòng tổng "Tổng giá vốn"/"Lợi nhuận" (cạnh "Tổng tiền hàng"), chỉ render khi prop có giá trị. Dòng nào `costAvailable=false` hiện "—" kèm tooltip lý do.

# Việc 7 — Frontend: nút "Xem lãi/lỗ" + Dialog bảng trực quan

- [ ] Component mới `quotation-margin-dialog.tsx` (theo pattern `quotation-item-dialog.tsx`): bảng từng sản phẩm (giá vốn, giá bán, tổng giá vốn, tổng giá bán không VAT, lợi nhuận) + tổng cộng toàn báo giá. Dùng lại đúng data đã fetch ở Việc 6 (không gọi API lần 2).
- [ ] `quotations/[id]/page.tsx`: nút "Xem lãi/lỗ" cạnh các nút hành động khác, `hasPermission("quotation.view-cost")`.

# Việc 8 — Frontend: cột Ghi chú + Tổng giá vốn/Lợi nhuận (trang danh sách)

- [ ] `quotation-table.tsx`: cột "Ghi chú" (render `q.note`), 2 cột "Tổng giá vốn"/"Lợi nhuận" cạnh "Tổng tiền" — chỉ render khi `hasPermission("quotation.view-cost")` VÀ field có trong response (đề phòng lệch quyền).
- [ ] `quotations/page.tsx`: cập nhật type `Quotation` nhận thêm `totalCost?`/`profit?`.

# Việc 9 — Backfill dữ liệu cũ

- [ ] Khảo sát trước (đã làm 20/7/2026 trong lúc lập plan): 4/4 SalesOrder `plannedCost=0`, 0 OrderBOM, 7 SalesOrderItem không có `materialRequirementVersionId`.
- [ ] Viết script tạm `apps/api/scripts-tmp/backfill-planned-cost.js`: với mỗi `SalesOrder`, load items + `SalesOrderItemParameter`, dùng lại `estimateItemsCost()` logic (BomEngineService instantiate trực tiếp với PrismaService, giống pattern `bom-engine.service.spec.ts`) để tính lại `plannedCost` từng item bằng Material Requirement Version ACTIVE hiện tại.
- [ ] Update `SalesOrderItem.plannedCost`, `SalesOrder.plannedCost`, `SalesOrder.plannedProfit = totalAmount - plannedCost - discountAmount`.
- [ ] Tạo `OrderBOM`/`OrderBOMItem` còn thiếu (chỉ tạo nếu chưa tồn tại — idempotent, để script chạy lại an toàn).
- [ ] Chạy trên DB dev, đối chiếu số dòng ảnh hưởng = số khảo sát (4 SalesOrder, 7 SalesOrderItem), log chi tiết trước/sau để verify bằng tay.
- [ ] Xoá script tạm sau khi verify xong — không commit vào repo (theo tiền lệ milestone 006).
- [ ] Ghi rõ giới hạn (trong báo cáo hoàn thành): số liệu backfill dùng Material Requirement Version ACTIVE hiện tại, có thể khác version thật đã dùng lúc Approve nếu định mức đã đổi từ đó đến nay.

# Việc 10 — Test & Build

- [x] `quotation-workflow.service.spec.ts`: test mới cho `getCostSummary()`, `findAll()` có/không `totalCost`, và test sửa cho `approve()` (Việc 1).
- [x] `tsc --noEmit` sạch cả api + web.
- [x] `npx jest` toàn bộ suite api — pass 100% (288/288, 19 suite).
- [x] `next build` — build thành công.

# Việc 11 — Cập nhật knowledge docs

- [x] `knowledge/modules/permission.md`: thêm `view-cost` vào action list của Quotation, ghi rõ lý do tách riêng OWNER/ADMIN khỏi SALES (dữ liệu tài chính nhạy cảm, không phải Business Action).
- [x] `knowledge/modules/quotation.md`: thêm mục mô tả tính năng xem giá vốn/lợi nhuận (nguồn dữ liệu = ước tính real-time, không phải snapshot).
- [x] Không sửa mục Snapshot Rule hiện tại (giá vốn kế hoạch tại Approve vẫn đúng thiết kế cũ, chỉ là code sai — đã fix ở Việc 1, không phải đổi thiết kế).

# Việc 12 — Verify thực tế

- [ ] Verify bằng Playwright/browser thật (không chỉ đọc code): đăng nhập Owner → mở báo giá Draft có sản phẩm đã có Material Requirement Version ACTIVE → thấy cột Giá vốn + nút Xem lãi/lỗ + Dialog đúng số liệu.
- [ ] Đăng nhập role SALES (hoặc user không có `quotation.view-cost`) → xác nhận KHÔNG thấy cột/nút/dữ liệu giá vốn ở cả 2 trang.
- [ ] Approve một báo giá mới → xác nhận `SalesOrder.plannedCost` > 0 đúng (fix Việc 1 hoạt động cho đơn mới).
- [ ] Đối chiếu 1 SalesOrder cũ sau backfill: `plannedCost`/`plannedProfit` đổi đúng theo log script.

---

Sau khi hoàn thành hết Việc 1-12: báo cáo tổng kết (file đã sửa, kết quả test, commit message đề xuất, giới hạn của backfill) và dừng, chờ lệnh tiếp theo — không tự ý làm việc khác.
