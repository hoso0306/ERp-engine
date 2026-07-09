# Milestone 02 (Sprint 02) - Sửa lỗi & cải tiến sau Test lần 1 (08/07/2026)

> **Tên file:** `workbench/sprint-02/002-sua-loi-test-lan-1.md`
>
> Milestone Báo cáo dời thành `003-bao-cao.md`.

---

# Mục tiêu

Xử lý toàn bộ lỗi và các cải tiến đã ghi nhận trong `testlan1.md` (kiểm thử thủ công 08/07/2026), để website sẵn sàng cho người dùng vận hành thử phần đã có FE.

Nguồn: `workbench/sprint-02/testlan1.md`.

---

# Kết quả chẩn đoán (đã khảo sát code trước khi lập kế hoạch)

1. **Nhóm "lỗi hiển thị FE" ở các ô chọn** (đơn vị tính, nhóm khách hàng, tuyến giao hàng, mức độ ưu tiên, loại sản phẩm, xưởng sản xuất, tên sản phẩm trong dialog sửa dòng báo giá) — **một nguyên nhân chung**: component dùng chung `apps/web/src/components/ui/select.tsx` (Base UI Select) không hiển thị label của item đã chọn trên trigger. Sửa một chỗ, hết lỗi ở mọi form.
2. **"Chưa xem được tồn kho, tồn kho tối thiểu"** — FE chưa từng hiển thị `currentStock`/`minimumStock` ở bất kỳ trang nào (API đã trả sẵn). Là thiếu sót FE, không phải lỗi API.
3. **"Khách duyệt xong nhưng tab Sản xuất / Đơn hàng không có gì"** — Đơn hàng + Phiếu sản xuất **đã được tạo đúng trong DB** (đã verify). Vấn đề là sidebar có link `Đơn hàng`, `Sản xuất`, `Công nợ`, `Hàng hoàn`, `Kho`, `Báo cáo`, `Cài đặt`, `Dashboard` nhưng **các trang này chưa được xây** (thuộc các milestone FE sau) → bấm vào ra trang trống/404. Milestone này chỉ xử lý mặt UX menu; xây FE các module đó là milestone riêng.
4. **Import SĐT mất số 0** — cột SĐT trong file Excel template đang để định dạng số; cần ép định dạng text ở template + chuẩn hoá khi đọc import.

---

# Phạm vi

* Chỉ sửa lỗi và làm các cải tiến liệt kê trong Task bên dưới (toàn bộ điểm mở đã chốt với người dùng 08/07/2026 — xem mục "Quyết định đã chốt").
* **Không** xây trang FE cho Đơn hàng / Sản xuất / Kho / Công nợ / Hàng hoàn / Dashboard / Báo cáo / Đăng nhập (milestone riêng).
* **Không** làm luồng bán lẻ vật tư (đơn bán lẻ, xuất kho bán lẻ) — Task 07 chỉ lưu + hiển thị giá bán.

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Task nào đụng schema phải có migration riêng, rõ ràng.

---

# Task 00 - Sửa lỗi hiển thị Select dùng chung (FE)

**Loại:** Bug — ưu tiên cao nhất (ảnh hưởng mọi form nhập liệu).

## Nội dung

* Sửa `apps/web/src/components/ui/select.tsx`: trigger phải hiển thị **label** của item đã chọn (không hiện id thô / không trống).
* Rà và verify từng chỗ dùng: form Vật tư (thêm/sửa — đơn vị tính), form Khách hàng (thêm/sửa — nhóm KH, tuyến giao hàng, mức độ ưu tiên), form Sản phẩm (thêm/sửa — loại SP, đơn vị tính, xưởng sản xuất), dialog dòng báo giá (chọn/hiển thị tên sản phẩm), filter các trang danh sách, dialog Override báo giá.

### Definition of Done

* [x] Mọi ô chọn hiển thị đúng tên item đã chọn, cả khi mở form sửa (giá trị có sẵn).
* [x] Build thành công. Verify sống trên từng form nêu trên.

**Commit**

```text
fix(web): shared select renders selected item label
```

---

# Task 01 - Vật tư: hiển thị tồn kho + đổi nhãn "Vật tư"

**Loại:** Bug (thiếu hiển thị) + cải tiến nhãn.

## Nội dung

* Danh sách vật tư: thêm cột **Tồn kho** (kèm đơn vị) và **Tồn tối thiểu**; tô đỏ/badge cảnh báo khi tồn kho dưới mức tối thiểu (rule sẵn có của Dashboard).
* Trang chi tiết vật tư: thêm khối Tồn kho hiện tại / Tồn kho tối thiểu.
* Đổi toàn bộ nhãn FE "Nguyên liệu" → **"Vật tư"** (menu `navigation.ts`, heading, label form, thông báo) — thống nhất với thuật ngữ tài liệu (`material` = vật tư).

### Definition of Done

* [x] Xem được tồn kho + tồn tối thiểu ở danh sách và chi tiết; cảnh báo dưới mức hiển thị đúng.
* [x] Không còn chữ "Nguyên liệu" trên UI.
* [x] Build thành công.

**Commit**

```text
feat(web): show material stock levels and rename nguyen lieu to vat tu
```

---

# Task 02 - Khách hàng: import Excel không mất số 0 đầu SĐT

**Loại:** Bug (dữ liệu sai).

## Nội dung

* Template export/import (ExcelJS): ép cột SĐT về **định dạng Text** (`numFmt '@'`) để Excel không tự cắt số 0.
* API import: khi đọc cell SĐT — nếu cell là số thì chuyển về chuỗi và **thêm lại số 0 đầu** (SĐT VN 10 số: giá trị 9 chữ số → prepend "0"); trim khoảng trắng; dòng không hợp lệ báo lỗi rõ ràng theo số dòng.
* Export khách hàng hiện có cũng phải giữ nguyên số 0.

### Definition of Done

* [x] Import file có SĐT bị Excel cắt số 0 → vào hệ thống vẫn đúng 10 số.
* [x] Template mới tải về: nhập SĐT không bị Excel đổi định dạng.
* [x] Build thành công. Verify sống bằng file thật.

**Commit**

```text
fix(customer): preserve leading zero phone numbers on excel import
```

---

# Task 03 - Báo giá: cảnh báo quá hạn đúng trạng thái + bộ lọc danh sách

**Loại:** Bug (cảnh báo sai) + cải tiến đã đề xuất trong testlan1.

## Nội dung

* Cảnh báo/badge **"Đã quá hạn" chỉ áp dụng cho báo giá còn mở** (Nháp/Đã gửi). Báo giá Đã duyệt/Đã huỷ không hiện cảnh báo quá hạn (cả trang danh sách lẫn chi tiết).
* Danh sách báo giá thêm **tabs trạng thái + lọc theo ngày tạo** (thiết kế đã chốt với người dùng 08/07/2026):
  * Tabs: **Chờ xử lý** (mặc định — DRAFT + SENT, không giới hạn ngày) | **Đã duyệt** | **Đã huỷ** | **Tất cả**.
  * Bộ lọc khoảng ngày tạo (từ ngày – đến ngày).
  * API `GET /quotations` đã có filter `status`, bổ sung filter theo khoảng `createdAt`.

### Definition of Done

* [x] Báo giá Đã duyệt không còn cảnh báo quá hạn (verify sống).
* [x] Tabs + lọc ngày hoạt động, mặc định vào tab Chờ xử lý.
* [x] Build thành công.

**Commit**

```text
feat(quotation): status tabs + date filter, expiry warning only for open quotes
```

---

# Task 04 - Báo giá: gợi ý khách hàng realtime khi tạo báo giá

**Loại:** Cải tiến UX (đã đề xuất trong testlan1).

## Nội dung

* Ô chọn khách hàng ở trang tạo báo giá: gõ SĐT/tên → **dropdown gợi ý hiện ngay theo từng ký tự** (debounce ~300ms, dùng API `GET /customers?search=` sẵn có), hiển thị tên + SĐT + nhóm để chọn nhanh.

### Definition of Done

* [x] Gõ "098" → danh sách khách khớp xổ xuống ngay, chọn được bằng chuột/bàn phím.
* [x] Build thành công.

**Commit**

```text
feat(quotation): customer typeahead search on create
```

---

# Task 05 - Khách hàng: thêm Tên công ty + Mã số thuế

**Loại:** Tính năng mới (đã đề xuất trong testlan1) — **có migration schema**.

## Nội dung

* Schema: `Customer.companyName String?`, `Customer.taxCode String?` (+ `@map`, migration riêng, không backfill — dữ liệu cũ NULL).
* Form thêm/sửa khách + trang chi tiết: 2 trường mới (không bắt buộc).
* Export/Import Excel + template: thêm 2 cột tương ứng.
* Cập nhật `knowledge/modules/customer.md` + mermaid trong `erd.md`.

### Definition of Done

* [x] Tạo/sửa khách với tên công ty + MST; hiển thị ở chi tiết; export/import đủ 2 cột.
* [x] Build thành công, migration chạy trên DB dev.

**Commit**

```text
feat(customer): company name and tax code fields
```

---

# Task 06 - Menu: xử lý các mục chưa có trang

**Loại:** Bug UX (nguyên nhân hiểu nhầm "duyệt báo giá xong không thấy đơn hàng").

## Nội dung

* Các mục sidebar chưa có trang (`Đơn hàng`, `Công nợ`, `Hàng hoàn`, `Sản xuất`, `Kho`, `Báo cáo`, `Cài đặt`, và `Dashboard` nếu trang chủ chưa có nội dung): **disable + badge "Đang phát triển"** (đã chốt 08/07/2026), không cho bấm vào trang trống.
* Không xoá khỏi menu — giữ để thấy roadmap sản phẩm.

### Definition of Done

* [x] Không còn bấm được vào trang trống/404 từ sidebar; mục chưa có trang hiển thị badge "Đang phát triển" rõ ràng.
* [x] Build thành công.

**Commit**

```text
fix(web): mark nav items without pages as coming soon
```

---

# Task 07 - Vật tư: giá bán lẻ (bên cạnh giá nhập)

**Loại:** Tính năng mới (đã chốt 08/07/2026) — **có migration schema**.

**Nghiệp vụ đã chốt:** giá bán = giá bán lẻ vật tư. Khi bán lẻ hoặc tính giá bán → dùng giá bán. Khi tính **giá vốn** → vẫn dùng giá nhập (MaterialPrice) như hiện tại — không đụng Pricing/BOM Engine.

## Nội dung

* Schema: thêm `Material.retailPrice Decimal? @map("retail_price")` (Source Data, nhập tay, nullable — vật tư không bán lẻ để trống). Migration riêng, không backfill.
* Form thêm/sửa vật tư: trường "Giá bán lẻ" (không bắt buộc).
* Danh sách + chi tiết vật tư: hiển thị **Giá nhập** (giá mặc định từ MaterialPrice) và **Giá bán lẻ** cạnh nhau.
* Cập nhật `knowledge/modules/material.md` (nếu có) + mermaid `erd.md`.
* **Không** làm luồng bán lẻ vật tư (đơn bán lẻ, xuất kho bán lẻ) — chưa thuộc phạm vi, chỉ lưu + hiển thị giá.

### Definition of Done

* [x] Nhập/sửa giá bán lẻ; danh sách và chi tiết hiển thị đủ giá nhập + giá bán.
* [x] Giá vốn (BOM/plannedCost) không bị ảnh hưởng — vẫn lấy giá nhập.
* [x] Build thành công, migration chạy trên DB dev.

**Commit**

```text
feat(material): retail price field alongside purchase price
```

---

# Task 08 - Vật tư: gắn nhiều xưởng sản xuất (để lọc)

**Loại:** Tính năng mới (đã chốt 08/07/2026) — **có migration schema**.

**Nghiệp vụ đã chốt:** một vật tư có thể thuộc **nhiều xưởng**. Hiện tại **chỉ dùng để lọc** danh sách — không ảnh hưởng nghiệp vụ xuất kho/BOM.

## Nội dung

* Schema: bảng nối `MaterialProductionCenter` (`materialId` + `productionCenterId`, `@@unique` cặp, theo convention join table sẵn có như `RolePermission`). Migration riêng, dữ liệu cũ không gắn xưởng nào.
* Form thêm/sửa vật tư: chọn nhiều xưởng (multi-select, không bắt buộc).
* Danh sách vật tư: bộ lọc theo xưởng (`GET /materials?productionCenterId=`), cột/badge hiển thị các xưởng của vật tư.

### Definition of Done

* [x] Gắn/bỏ xưởng cho vật tư hoạt động; lọc theo xưởng đúng.
* [x] Không ảnh hưởng luồng xuất kho / tính BOM hiện có.
* [x] Build thành công, migration chạy trên DB dev.

**Commit**

```text
feat(material): assign production centers for filtering
```

---

# Task 09 - Hoàn thiện Milestone

* [x] Toàn bộ Task 00–08 xong, build API + web xanh, unit test pass.
* [x] Verify sống lại các form đã sửa + luồng báo giá chính.
* [x] Cập nhật `testlan1.md`: đánh dấu các lỗi đã xử lý.
* [x] Tự review. Dừng.

**Commit**

```text
chore(web): complete test round 1 fixes milestone
```

---

# Quyết định đã chốt với người dùng (08/07/2026)

1. **Giá bán vật tư** = giá bán lẻ. Bán lẻ / tính giá bán → dùng giá bán; tính **giá vốn** → dùng giá nhập. → Task 07.
2. **Vật tư thuộc nhiều xưởng**, hiện tại chỉ dùng để lọc. → Task 08.
3. **Tabs báo giá:** tab mặc định "Chờ xử lý" (toàn bộ DRAFT + SENT, không giới hạn ngày) + bộ lọc ngày riêng. → Task 03.
4. **Menu chưa có trang:** disable + badge **"Đang phát triển"** (giữ trong menu). → Task 06.
5. **Bảng chênh lệch giá cũ/mới (mục 4.4 testlan1):** người dùng xác nhận hoạt động ổn — không cần task sửa.

---

# Thứ tự thực hiện đề xuất

Task 00 (chặn mọi form) → 01 → 02 → 03 → 06 → 04 → 05 → 07 → 08 → 09.

---

# Milestone tiếp theo

Sau milestone này: **003-bao-cao.md** (Module Báo cáo) hoặc **FE Đơn hàng/Sản xuất** — do bạn chọn (lỗi "duyệt xong không thấy đơn hàng" cho thấy FE Đơn hàng có thể cấp thiết hơn Báo cáo).
