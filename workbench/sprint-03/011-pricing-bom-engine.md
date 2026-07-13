# Milestone (Sprint 03) - Refactor Pricing & BOM Engine

> **Tên file:** `workbench/sprint-03/011-pricing-bom-engine.md`
> **Trạng thái:** CHỜ DUYỆT — chưa được code khi người dùng chưa xác nhận.

---

# Mục tiêu

Triển khai kết luận của đợt Design Review Pricing/BOM ngày 10/07/2026:

1. Sửa 2 bug đang chạy sai ở hệ thống hiện tại (lệch `area` ở preview, nuốt lỗi expression lúc Approve).
2. Xây **ExpressionEvaluator dùng chung** (parser riêng, typed) thay cho 3 bản copy `new Function`.
3. Chuyển model sản phẩm sang **Hướng B**: Product = hệ, màu khung/số cánh là Configuration; đơn giá là **Price Matrix**; rule min/bậc thang có **condition expression**.
4. Pricing Engine chạy theo **pipeline**: Validate → Derive → Normalize → Matrix Lookup → Discount → Round.
5. Tách **BOM Engine** riêng, chỉ nhận kích thước gốc. BOM chọn vật tư theo Configuration bằng **condition trên từng dòng** (khách chọn Cafe → dòng AL30-CAFE, không phải AL30-TRANG), sau đó mới chạy formula tính số lượng.

## Nguyên tắc bắt buộc của milestone này

> **Kích thước tính tiền ≠ Kích thước sản xuất.**
> Pricing Engine được điều chỉnh kích thước (min, bậc thang) để tính tiền.
> BOM Engine **không bao giờ** nhận kích thước đã điều chỉnh — luôn nhận kích thước gốc khách đặt.
> Phải có test khẳng định: đơn 60cm × 200cm → giá tính theo 70cm, định mức vật tư tính theo 60cm.

---

# Các quyết định đã chốt (10/07/2026)

| Vấn đề | Quyết định |
|---|---|
| Mô hình sản phẩm | **Hướng B** — Product = hệ (Hệ 27/30/45...); màu khung, số cánh, kiểu mở = Configuration (ProductParameter ENUM) |
| Đơn giá | **Price Matrix** dạng bảng rows (tổ hợp config → đơn giá/m²), sales nhìn như Excel |
| Versioning | Matrix + Rules + Rounding version **chung một aggregate** (một PricingVersion, một ID để snapshot) — không version rời |
| Điều kiện rule | Là **expression** (`door == 2 && color == "cafe"`), không phải trường có cấu trúc |
| Rule hệ xích (cao gấp đôi rộng / nhỏ hơn 1/2 rộng) | **Cảnh báo (WARN)** — không chặn, không đổi giá. Model vẫn hỗ trợ BLOCK cho tương lai |
| Đơn vị | Nhập kích thước theo **cm** (dài, rộng). Giá theo **m²**. Biến `area` (m²) = `width * height / 10000`, định nghĩa **một chỗ duy nhất** |
| Evaluator | Một thư viện dùng chung, parser riêng (không dùng `new Function`), hỗ trợ number/string/boolean |
| Chọn vật tư theo config | **Condition trên từng dòng BOM** (`MaterialRequirementItem.condition`) — không xây Selection Engine, không thêm Matrix riêng cho BOM, không có `priceCode` trung gian |
| Rule Language | Condition/expression là **ngôn ngữ chung toàn ERP** (pricing rule, dòng BOM, validation rule, derived parameter) chạy trên một evaluator duy nhất. Thống nhất ở **tầng ngôn ngữ** — mỗi loại rule vẫn là bảng riêng với cột typed riêng, **không** xây Rule framework/entity tổng quát kiểu `condition + action`. Không thêm `condition` vào DerivedParameter khi chưa có nhu cầu |

---

# Phạm vi

**Làm:** API (schema + service + test), FE cấu hình bảng giá + form báo giá (mức tối thiểu để dùng được).

**Không làm trong milestone này:**

* Không đụng luồng Production, Warehouse, Debt, Return.
* Không làm sanity-check theo "giá bán tham khảo" (dải giá/m²) — ghi backlog.
* Không làm surcharge/phụ thu theo config (Motor Somfy...) — model condition đã sẵn sàng, nghiệp vụ chưa cần.
* Không xoá cơ chế expression tính giá hiện có — giữ làm fallback (xem Task 10).

Nếu phát hiện nghiệp vụ chưa rõ hoặc xung đột, dừng và hỏi người dùng.

---

# Tham chiếu

* `.claude/CLAUDE.md` — mục 7 (Snapshot), 8 (Versioning), 12 (không tổng quát hóa sớm), 13 (Derived Data).
* `knowledge/modules/product.md`, `knowledge/modules/quotation.md`, `knowledge/project/erd.md`.
* Code hiện tại: `apps/api/src/pricing-engine/pricing-engine.service.ts`, `apps/api/src/product/product.service.ts` (previewPrice / previewMaterial), `apps/api/src/quotation/quotation-workflow.service.ts` (approve → OrderBOM).

---

# Quy trình làm việc

* Mỗi lần chỉ thực hiện **01 Task**, xong thì dừng, tóm tắt, liệt kê file, đề xuất commit message, chờ Task tiếp theo.
* Task nào đổi schema thì migration đi kèm ngay trong Task đó.
* Mỗi Task có test đi kèm (unit cho engine/evaluator, integration cho workflow).

---

# GIAI ĐOẠN 0 — Sửa nền (không đổi schema)

## Task 00 - Fix bug lệch `area` ở previewPrice

**Hiện trạng:** `product.service.ts` (previewPrice) tính `area = width * height` không quy đổi, trong khi `pricing-engine.service.ts` tính `area = width * height / 1_000_000` (giả định mm). Admin preview một giá, khách được báo giá khác.

**Việc làm:**

* Khảo sát nhanh: UI hiện tại và dữ liệu quotation đang nhập kích thước theo đơn vị gì (mm hay cm) — kiểm tra placeholder/label FE + vài bản ghi `QuotationItemParameter`.
* Chốt theo quyết định mới: **nhập cm**, `area (m²) = width * height / 10_000`. Sửa cả hai chỗ về cùng công thức, đặt tại một hàm dùng chung tạm thời (sẽ được thay bằng Derived Parameter ở Task 06).
* Nếu dữ liệu cũ đang nhập mm: dừng lại báo cáo, đề xuất phương án quy đổi trước khi sửa.
* Đồng bộ luôn: previewPrice hiện bỏ sót rule `MIN_VALUE` mà engine có xử lý — thêm cho khớp.

## Task 01 - Fix nuốt lỗi expression lúc Approve

**Hiện trạng:** `quotation-workflow.service.ts` (~dòng 963): `catch { matQty = 0 }` — expression hỏng tạo Sales Order với `plannedCost = 0` âm thầm, trái nguyên tắc "không thay đổi dữ liệu âm thầm".

**Việc làm:**

* Expression lỗi khi Approve → **chặn approve**, báo `BadRequestException` nêu rõ vật tư nào, công thức nào lỗi.
* Test: quotation có material requirement chứa expression hỏng → approve fail, không sinh SalesOrder/OrderBOM.

## Task 02 - ExpressionEvaluator dùng chung

**Vị trí:** `apps/api/src/shared/expression/` (evaluator + rounding).

**Yêu cầu evaluator:**

* Parser riêng (tokenizer + recursive descent hoặc thư viện nhỏ như `expr-eval` — chọn khi implement, ưu tiên tự chủ, **không dùng `new Function`**).
* Kiểu dữ liệu: number, string, boolean.
* Toán tử: `+ - * / %`, so sánh `== != > < >= <=`, logic `&& || !`, ngoặc.
* Hàm: `if(cond, a, b)`, `ceil`, `floor`, `round`, `min`, `max`, `abs`. `ceil/floor/round` hỗ trợ tham số bước: `ceil(x, 0.5)`.
* Context: map tên biến → giá trị. Biến không tồn tại → lỗi rõ ràng (không trả 0 âm thầm).
* Kết quả không phải số hữu hạn (với expression tính lượng/giá) → lỗi rõ ràng.
* Có hàm `validate(expression)` trả về lỗi cú pháp + danh sách biến sử dụng (phục vụ UI kiểm tra khi admin nhập).

**Việc làm:**

* Viết evaluator + test đầy đủ (bảng test case: số học, ưu tiên toán tử, if lồng, so sánh chuỗi, biến thiếu, chia 0, cú pháp sai). Bộ test này đồng thời là **đặc tả cố định của grammar** — evaluator sẽ được dùng chung cho pricing rule, condition dòng BOM, validation rule, derived parameter, nên sau khi có expression lưu trong DB thì grammar chỉ được mở rộng, không được đổi ngữ nghĩa.
* Gom `applyRounding` về `shared/expression/rounding.ts`.
* Thay thế cả 3 bản copy: `pricing-engine.service.ts`, `product.service.ts`, `quotation-workflow.service.ts`. Hành vi lỗi thống nhất: **throw** (Task 01 đã dọn chỗ nuốt lỗi).
* `validateExpression` khi lưu PricingRule/MaterialRequirement item chuyển sang dùng `validate()` của evaluator — từ đây expression lưu mới bắt buộc đúng grammar mới.
* **Lưu ý tương thích:** expression cũ dạng JS thuần (`width > 2000 ? 6 : 4`) sẽ không chạy trên parser mới. Task này phải quét toàn bộ expression đang có trong DB (PricingRuleVersion.expression, MaterialRequirementItem.expression), báo cáo danh sách cần chuyển đổi, và chuyển đổi (ternary → `if()`). Số lượng ít thì chuyển tay bằng script một lần.

---

# GIAI ĐOẠN 1 — Data model (Hướng B)

## Task 03 - Khảo sát catalog hiện tại + phương án migration

> Giải thích cho câu hỏi "mình không hiểu lắm" (câu 2 hôm trước): cần biết trong DB hiện nay, ví dụ "Hệ 30, màu Cafe, 2 cánh" đang được lưu là **một sản phẩm riêng** (tức có nhiều sản phẩm gần giống nhau, mỗi tổ hợp một cái) hay là **một sản phẩm "Hệ 30"** có tham số màu/số cánh. Điều này quyết định dữ liệu cũ phải chuyển đổi nhiều hay ít khi sang model mới.

**Việc làm:**

* Liệt kê products + parameters + pricing versions đang có trong DB (script đọc, không sửa).
* Báo cáo: bao nhiêu sản phẩm là biến thể của cùng một hệ, quotation cũ tham chiếu thế nào.
* Đề xuất phương án migration cụ thể (gộp biến thể về một product + config, hay giữ nguyên sản phẩm cũ và chỉ áp model mới cho sản phẩm tạo mới). **Chờ người dùng duyệt phương án rồi mới làm Task 04.**
* Quotation/SalesOrder cũ đã snapshot nên không bị ảnh hưởng khi Master Data đổi (nguyên tắc 7).

## Task 04 - Schema: PricingVersion aggregate + Matrix + Condition

**Một migration**, gồm:

**PriceMatrixRow** (mới):

* `pricingRuleVersionId` (FK → pricing_rule_versions, Cascade), `configKey` (JSON hoặc cột chuẩn hóa `dimensions Json` — map tên parameter → value, ví dụ `{"color":"cafe","door":"2"}`), `unitPrice Decimal(15,0)` (đ/m²), `displayOrder`.
* Unique: (`pricingRuleVersionId`, `dimensions`) — không cho 2 row trùng tổ hợp.

**PricingRuleItem** (mở rộng):

* Thêm `condition String?` — expression boolean, null = luôn áp dụng.
* Thêm ruleType `BILLABLE_STEP` (bậc thang): dùng cặp `rangeFrom`/`rangeTo`/`billValue` (3 cột Decimal mới, nullable) — ví dụ mục 4 bảng giá: `[0, 0.7] → 0.7`, `(0.7, 1) → 1` trên biến `area`.
* Giữ nguyên `MIN_AREA`/`MIN_DIMENSION`/`MIN_VALUE` — thêm condition là đủ cho rule "1 cánh min 70cm, 2 cánh min 100cm".

**MaterialRequirementItem** (mở rộng):

* Thêm `condition String?` — expression boolean, cùng cú pháp với PricingRuleItem.condition, null = dòng luôn được dùng.
* Đây là cơ chế chọn vật tư theo Configuration: mỗi biến thể vật tư là một dòng có condition (`color == "cafe"` → AL30-CAFE). Backfill: dòng hiện có để `condition = null` (giữ nguyên hành vi cũ).

**ValidationRule** (mới):

* `productId`, `expression String` (boolean — ví dụ `height <= 2 * width`), `severity` enum (`WARN`, `BLOCK`), `message String`, `displayOrder`.
* Nghiệp vụ hiện tại chỉ dùng WARN (đã chốt); BLOCK để sẵn.

**DerivedParameter** (mới):

* `productTypeId` (hoặc `productId` — chốt khi implement theo hướng đơn giản hơn), `name` (`area`), `expression` (`width * height / 10000`), `unit` (`m²`).
* Seed mặc định `area` cho các product type hiện có. Xóa hardcode `area` trong engine.

**Versioning giữ nguyên khung cũ:** vẫn là `PricingRuleVersion` DRAFT → ACTIVE → ARCHIVED, chỉ là version giờ chứa thêm matrix rows. Không tạo bảng version mới. Quotation snapshot vẫn một `pricingRuleVersionId`.

## Task 05 - Migration dữ liệu catalog (theo phương án đã duyệt ở Task 03)

* Thực thi chuyển đổi đã duyệt. Backfill một lần trong migration, ghi chú rõ.
* Kiểm tra sau migration: mọi product ACTIVE có pricing version hợp lệ (matrix hoặc expression fallback).

---

# GIAI ĐOẠN 2 — Pricing Pipeline

## Task 06 - Derived Parameter + Validation trong luồng báo giá

* Bước tính biến phái sinh: đọc DerivedParameter, evaluate bằng shared evaluator, **từ kích thước gốc** — kết quả cấp cho cả Pricing lẫn BOM.
* Bước validation: chạy ValidationRule khi tạo/sửa quotation item. WARN → trả về danh sách cảnh báo (FE hiển thị, cho phép tiếp tục, cảnh báo lưu vào item để in được trên báo giá nếu cần); BLOCK → BadRequestException.
* Đây là 2 bước trong luồng, không tạo module "Engine" riêng (nguyên tắc 12).

## Task 07 - Pricing Engine pipeline

Viết lại `PricingEngineService` theo 2 tầng:

* **Load:** đọc pricing version ACTIVE (matrix rows + rule items + rounding) → object config thuần.
* **Calculate (hàm thuần, không DB):** nhận (config, rawParams + derivedParams) →
  1. Normalize: áp rule items theo thứ tự `displayOrder`, mỗi rule chỉ chạy khi `condition` đúng (evaluator). MIN_* và BILLABLE_STEP tạo ra **billable params** (bản sao, không ghi đè raw).
  2. Matrix lookup: khớp tổ hợp config params với `dimensions` của row → `unitPrice`. Không khớp row nào → lỗi rõ ràng ("chưa có giá cho tổ hợp Cafe + 2 cánh").
  3. Thành tiền: `unitPrice × billableArea`.
  4. Rounding theo version.
* Output: `{ systemPrice, unitPrice, billableParams, rawParams, warnings, pricingRuleVersionId }` — billableParams chỉ để hiển thị/giải trình, **không** truyền sang BOM.
* previewPrice của product.service chuyển sang gọi PricingEngineService (xóa logic tính trùng).
* Test: bảng case theo đúng ảnh bảng giá thật (Hệ 30 Cafe 2 cánh 250×200cm → 5m² × 450.000; cửa 1 cánh 60cm rộng → tính theo 70cm; rèm kéo đứng 0,85m² → tính 1m²; tổ hợp thiếu giá → lỗi).

## Task 08 - Nối Quotation vào pipeline mới

* Luồng tạo/sửa quotation item dùng pipeline mới (kèm warnings).
* Discount giữ nguyên logic hiện có (`calcFinalPrice`) — chỉ xác nhận vị trí trong pipeline sau systemPrice.
* Approve: kiểm tra pricing version snapshot còn khớp (giữ cơ chế check hiện có).

---

# GIAI ĐOẠN 3 — BOM Engine

## Task 09 - BomEngineService

* Module mới `apps/api/src/bom-engine/` đối xứng với `pricing-engine`.
* **Load:** material requirement version ACTIVE. **Calculate (hàm thuần):** nhận (config, **rawParams** + derivedParams, quantity), pipeline:
  1. **Filter:** chỉ giữ các dòng có `condition` đúng với config đang chọn (condition null = luôn giữ).
  2. **Formula:** evaluate expression tính lượng cơ sở.
  3. **Waste → Round → nhân quantity** (giữ logic hiện có).
* Output: lines `{ materialId, baseQty, wastedQty, finalQty, unitPrice, lineTotal }` + `plannedCost`.
* `previewMaterial` (product.service) và bước sinh OrderBOM lúc Approve (quotation-workflow) đều gọi service này — xóa 2 bản logic trùng.
* **Test bắt buộc:**
  * Billable ≠ actual: đơn 60×200cm có rule min 70cm → pricing ra giá theo 70cm, BOM ra `2*width = 120cm` theo 60cm.
  * Chọn vật tư theo config: version có dòng AL30-CAFE (`color == "cafe"`) và AL30-TRANG (`color == "trang"`) → chọn Cafe thì OrderBOM chỉ chứa AL30-CAFE.
  * Condition lỗi hoặc tham chiếu biến không tồn tại → throw, không âm thầm bỏ dòng (nhất quán với Task 01).

---

# GIAI ĐOẠN 4 — Frontend tối thiểu

## Task 10 - UI Bảng giá (Price Matrix editor)

* Trang pricing version: bảng matrix (hàng = tổ hợp config từ ProductParameter ENUM options, cột đơn giá) — nhìn như Excel, nhập trực tiếp.
* Danh sách rule items: form builder đơn giản cho condition (chọn tham số / toán tử / giá trị → serialize ra expression; cho phép gõ tay expression nâng cao, validate qua API dùng `validate()`).
* Expression tính giá cũ vẫn hiển thị được (fallback cho product chưa có matrix) — product có matrix thì matrix thắng.
* Editor Material Requirement: thêm cột **Condition** trên từng dòng vật tư, dùng lại đúng form builder condition của pricing rule (một component chung).

## Task 11 - Form báo giá: config + cảnh báo

* Form quotation item: chọn Product (hệ) → chọn config (màu, số cánh — từ parameter options) → nhập rộng/dài theo **cm** (label ghi rõ đơn vị) → hiển thị đơn giá lookup được, diện tích tính tiền (nếu bị điều chỉnh thì ghi chú "tính theo tối thiểu 0,7m²"), và warnings từ ValidationRule.

---

# Câu hỏi còn mở (trả lời trước khi bắt đầu GIAI ĐOẠN tương ứng)

1. **(Trước Task 03→04)** Phương án migration catalog — sẽ đề xuất cụ thể sau khảo sát Task 03.
2. **(Trước Task 10)** Bảng giá có cần cột "giá bán tham khảo" (dải min–max/m²) để cảnh báo khi giá lệch không? Hiện để backlog.

---

# Định nghĩa hoàn thành milestone

* 3 bản copy evaluator đã thay bằng 1 thư viện chung, 2 bug đã fix, có test.
* Tạo được sản phẩm "Hệ 30" với config màu/số cánh, nhập matrix giá đúng như ảnh bảng giá thật, báo giá ra đúng số.
* Rule min theo số cánh + bậc thang m² chạy đúng; rule hệ xích hiện cảnh báo, không chặn.
* BOM sinh từ kích thước gốc, có test chứng minh billable ≠ actual.
* Quotation/SalesOrder cũ không bị ảnh hưởng (snapshot giữ nguyên giá trị).
