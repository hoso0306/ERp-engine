# Roadmap sau Test lần 1 — Phương án A (đã chốt 08/07/2026)

> **Tên file:** `workbench/roadmap.md`
>
> Nguyên tắc: sửa lỗi nền trước → dựng nền Auth FE → xây FE theo luồng nghiệp vụ (Đơn hàng → Sản xuất/Kho → Công nợ → Hàng hoàn) → Báo cáo → Dashboard → Cài đặt.
>
> Mỗi milestone khi bắt đầu sẽ có file kế hoạch chi tiết riêng theo convention (`sprint-XX/NNN-ten.md`). File này là kế hoạch tổng để review thứ tự + phạm vi.

---

## Bối cảnh

Sau Sprint 01 + Milestone 01 Sprint 02: **BE đã hoàn chỉnh 100%** cho toàn bộ nghiệp vụ V1 (đã verify 45/45 check), nhưng FE mới có đến module Báo giá. Test lần 1 (`sprint-02/testlan1.md`) phát hiện lỗi nền FE + xác nhận nhu cầu cấp thiết nhất là nhìn thấy Đơn hàng sau khi duyệt báo giá.

Trạng thái FE hiện tại:

| Đã có FE | Chưa có FE (BE sẵn sàng) |
|----------|--------------------------|
| Khách hàng, Sản phẩm (+ Quy tắc giá, Định mức), Vật tư, Báo giá (+ in), Danh mục (Đơn vị, Loại SP, Xưởng) | Đăng nhập/Phân quyền, Đơn hàng, Sản xuất, Kho, Công nợ, Hàng hoàn, Dashboard trang chủ, Cài đặt, Báo cáo (BE cũng chưa — thiết kế sẵn) |

---

## Thứ tự thực hiện

### ✅ Bước 0 — `sprint-02/002-sua-loi-test-lan-1.md` (ĐÃ LẬP KẾ HOẠCH, làm đầu tiên)

Sửa 10 task lỗi/cải tiến từ Test lần 1. Lý do làm trước: lỗi Select đang phá **mọi form nhập liệu** — không xây trang mới trên nền form lỗi. Chi tiết xem file.

---

### Bước 1 — `sprint-02/003-fe-dang-nhap.md` — FE Đăng nhập + nền phân quyền

**Mục tiêu:** web dùng được thật không cần proxy test; mọi trang sau dùng chung nền auth này.

**Vì sao trước Đơn hàng:** mọi trang mới đều cần fetch wrapper gắn token + guard + ẩn theo quyền. Làm sau sẽ phải quay lại sửa từng trang.

Task chính:

* **API client dùng chung** (`lib/api.ts`): fetch wrapper tự gắn `Authorization: Bearer` từ storage, xử lý 401 → chuyển `/login`; **thay toàn bộ chỗ đang gọi `fetch` trực tiếp** (tất cả trang hiện có) — việc nặng nhất của milestone.
* Trang `/login`: email + mật khẩu; luồng `mustChangePassword` → bắt đổi mật khẩu trước khi vào.
* Auth guard toàn route (layout/middleware Next.js) + user menu (tên, đổi mật khẩu, đăng xuất).
* Ẩn menu + nút Action theo `permissions` từ `GET /auth/me` (API có sẵn).
* Gỡ proxy test khỏi quy trình chạy dev; cập nhật hướng dẫn chạy.

DoD chính: đăng nhập thật bằng tài khoản Owner; user thiếu quyền → menu/nút ẩn, API 403 hiển thị lỗi lịch sự; không còn cần proxy.

---

### Bước 2 — `sprint-02/004-fe-don-hang.md` — FE Đơn hàng

**Mục tiêu:** sau khi duyệt báo giá, nhìn thấy và vận hành được đơn hàng — nhu cầu cấp thiết nhất từ Test lần 1.

Task chính:

* `/orders` danh sách: tabs trạng thái (Đang SX / SX xong / Đã gửi xe / Đã giao / Đã huỷ), tìm kiếm, lọc ngày; cột: mã đơn, khách, tổng tiền, tiến độ SX (x/y phiếu), thanh toán, ngày giao dự kiến (cảnh báo trễ).
* `/orders/[id]` chi tiết: thông tin + snapshot khách; danh sách items (+ BOM từng item); các Phiếu SX liên quan + trạng thái; tóm tắt công nợ (đã thu / còn lại); Timeline đầy đủ.
* Actions đúng Workflow: **Gửi xe**, **Khách đã nhận**, **Huỷ đơn** — kèm **dialog cảnh báo đơn đã thu cọc** (*"Đơn hàng đã thu cọc. ERP sẽ đóng công nợ. Việc hoàn tiền thực hiện ngoài hệ thống."* — trả nợ FE Task 04 milestone 001), **Manual Override** (lý do bắt buộc).
* Bật menu Đơn hàng (bỏ badge "Đang phát triển").
* Link chéo: từ báo giá Approved → đơn hàng; từ đơn hàng → báo giá gốc.

---

### Bước 3 — `sprint-02/005-fe-san-xuat-kho.md` — FE Sản xuất + Kho

**Mục tiêu:** quản đốc xưởng thao tác phiếu SX; thủ kho nhập vật tư và theo dõi tồn.

Task chính:

* `/production`: danh sách phiếu SX (lọc theo xưởng + trạng thái), chi tiết (sản phẩm, thông số, BOM vật tư cần), Action **Bắt đầu** / **Hoàn thành** (hoàn thành → API tự trừ kho theo BOM; hiển thị rõ lỗi thiếu tồn nếu bị chặn), timeline phiếu.
* `/warehouse`: **Tồn kho** (cảnh báo dưới mức tối thiểu), **Phiếu nhập vật tư** (tạo + danh sách + chi tiết), **Lịch sử giao dịch kho** (lọc theo vật tư / loại giao dịch).
* Bật 2 menu tương ứng.

---

### Bước 4 — `sprint-02/006-fe-cong-no.md` — FE Công nợ

**Mục tiêu:** kế toán thu tiền và theo dõi công nợ.

Task chính:

* `/debts` danh sách công nợ: lọc quá hạn / mức rủi ro / vượt hạn mức, tìm kiếm; cột: khách, đơn, tổng, đã thu, còn lại, hạn thanh toán.
* Chi tiết receivable: lịch sử thanh toán (Payment History) + Action **Ghi nhận thanh toán** (số tiền, phương thức; số tham chiếu bắt buộc khi chuyển khoản; chặn thu vượt — API đã enforce).
* Khối **Dashboard công nợ** (tổng còn phải thu, quá hạn, quá hạn >30 ngày, vượt hạn mức, top 10 khách nợ) — API `GET /receivables/dashboard` sẵn.
* Bật menu Công nợ.

---

### Bước 5 — `sprint-02/007-fe-hang-hoan.md` — FE Hàng hoàn

Task chính:

* `/returns`: danh sách (filter `status` — API sẵn), badge **PROCESSING / COMPLETED**.
* Tạo phiếu hoàn từ đơn DELIVERED: chọn items + số lượng + lý do (validate không vượt số đã mua — API enforce).
* Chi tiết + Action **"Hoàn tất xử lý"** (trả nợ FE Task 05 milestone 001).
* **Kho thu hồi** (Recovery Inventory): danh sách theo trạng thái, Action dùng lại (mark-used) / thanh lý (dispose) / sửa thông tin (location, ảnh).
* Bật menu Hàng hoàn.

---

### Bước 6 — `sprint-03/008-bao-cao.md` — Module Báo cáo (BE + FE)

Thiết kế có sẵn tại `knowledge/modules/report.md`; schema/index tiền đề đã xong ở milestone 001. Đặt sau các FE vận hành vì báo cáo cần dữ liệu vận hành thật và màn hình nghiệp vụ phải có trước.

---

### Bước 7 — `sprint-03/009-fe-dashboard.md` — FE Dashboard trang chủ

`GET /dashboard/overview` + `/alerts` (đã ẩn theo quyền). Làm sau các module chi tiết để các con số có chỗ bấm vào (drill-down về màn hình tương ứng).

---

### Bước 8 — `sprint-03/010-fe-cai-dat-nguoi-dung.md` — FE Cài đặt + Người dùng/Phân quyền

* Cài đặt: thông tin công ty, bộ số chứng từ, cấu hình theo module (API sẵn).
* Quản lý Users (tạo, cấp lại mật khẩu tạm, vô hiệu hoá) + Roles (tạo, gán quyền) — API sẵn từ `013-permission.md`.

---

## Nguyên tắc xuyên suốt các milestone FE

* UI theo pattern các trang sẵn có (shadcn/ui + Base UI, bảng + dialog + toast, tiếng Việt).
* Action Driven đúng Workflow Engine — không cho sửa status tay ngoài Manual Override (lý do bắt buộc).
* Mỗi milestone bật đúng menu của mình (gỡ dần badge "Đang phát triển" do Task 06 của 002 gắn).
* Từ 003 trở đi mọi trang đi qua API client dùng chung + permission-aware.
* Mỗi milestone: build xanh + verify sống luồng chính trước khi đóng.

---

## Tiến độ

* [x] 002 — Sửa lỗi Test lần 1 (sprint-02) — **✅ hoàn thành 09/07/2026** (10 task, 10 commit, verify sống từng task)
* [x] 003 — FE Đăng nhập + phân quyền (sprint-02) — **✅ hoàn thành 09/07/2026** (API client dùng chung, login + đổi mật khẩu bắt buộc, middleware guard, user menu, ẩn menu/nút theo quyền, migrate 37 file gọi fetch trực tiếp → client dùng chung; verify sống bằng Playwright headless; nợ kỹ thuật ghi nhận: 133 endpoint BE chưa gắn AuthGuard/PermissionGuard, để milestone riêng)
* [x] 004 — FE Đơn hàng (sprint-02) — **✅ hoàn thành 10/07/2026** (`/orders` danh sách + tabs trạng thái, `/orders/[id]` chi tiết với items+BOM/Phiếu SX/công nợ/Timeline, Action Gửi xe/Khách đã nhận/Huỷ (kèm cảnh báo cọc)/Manual Override, bật menu + link chéo Báo giá⇄Đơn hàng; verify sống bằng Playwright thật, không chỉ đọc code)
* [x] 005 — FE Sản xuất + Kho (sprint-02) — **✅ hoàn thành 10/07/2026** (`/production` danh sách + chi tiết với thông số/BOM (BE enrich nhỏ, không cần quyền `sales-order.view`) + Action Bắt đầu/Hoàn thành; `/warehouse` Tồn kho (cảnh báo dưới mức) + Phiếu nhập vật tư (tạo/danh sách/chi tiết) + Lịch sử giao dịch kho; bật 2 menu + link chéo Đơn hàng⇄Phiếu SX⇄giao dịch kho; verify sống bằng Playwright thật — Start thiếu tồn kho báo lỗi đúng, nhập kho + Start + Complete đủ tồn kho chạy đúng, đối chiếu số liệu kho khớp BOM)
* [x] 006 — FE Công nợ (sprint-02) — **✅ hoàn thành 10/07/2026** (`/debts` danh sách với tabs Tất cả/Quá hạn/Vượt hạn mức + lọc rủi ro/thanh toán + Dashboard công nợ (stat tile theo skill dataviz), `/debts/[id]` chi tiết + Payment History + Action Ghi nhận thanh toán (chặn thu vượt, bắt buộc số tham chiếu khi chuyển khoản), bật menu + link chéo Đơn hàng⇄Công nợ; không cần đổi BE; verify sống bằng Playwright thật — ghi nhận thanh toán thật thành công, chặn thu vượt đúng)
* [x] 007 — FE Hàng hoàn (sprint-02) — **✅ hoàn thành 10/07/2026** (`/returns` danh sách 2 tab Phiếu hoàn/Kho thu hồi, `/returns/[id]` chi tiết + Action Hoàn tất xử lý, `/returns/new` tạo phiếu hoàn (typeahead hoặc prefill từ đơn, validate cộng dồn số lượng), tab Kho thu hồi + Action Đánh dấu đã sử dụng/Thanh lý/Sửa, bật menu + link chéo Đơn hàng⇄Hàng hoàn; không cần đổi BE; verify sống bằng Playwright thật — tạo phiếu hoàn thật, chặn trả vượt số lượng đúng, mark-used/dispose/complete đúng, cross-link 2 chiều đúng; phát hiện + sửa 1 console warning (Select controlled/uncontrolled) trong lúc verify)
* [ ] 008 — Báo cáo BE+FE (sprint-03)
* [ ] 009 — FE Dashboard (sprint-03)
* [ ] 010 — FE Cài đặt + Người dùng (sprint-03)
