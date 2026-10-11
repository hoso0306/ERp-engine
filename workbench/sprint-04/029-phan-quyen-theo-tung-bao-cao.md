# Milestone (Sprint 04) - Phân quyền theo từng báo cáo

> **Tên file:** `workbench/sprint-04/029-phan-quyen-theo-tung-bao-cao.md`
> **Trạng thái:** ✅ Code xong (11/10/2026) — chưa commit, chưa deploy.

---

# Bối cảnh

Module Báo cáo hiện dùng **một quyền duy nhất `report.view`** cho toàn bộ 16 thẻ báo cáo (`report.md` mục "Permission": "Không tách quyền theo từng báo cáo ở V1"). Có quyền là xem được tất cả — kể cả báo cáo có giá vốn/lợi nhuận.

User yêu cầu: **mỗi thẻ báo cáo là một quyền riêng**, bật/tắt được cho từng Vai trò ở Cài đặt → Vai trò.

---

# Quyết định đã chốt (11/10/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Quyền `report.view` cũ | **Bỏ hẳn.** Chỉ còn 16 quyền theo thẻ. Có ≥ 1 quyền báo cáo → thấy menu "Báo cáo". |
| 2 | Giá vốn/lợi nhuận lẫn trong thẻ khác ("Tốc độ phát triển" có chuỗi lợi nhuận KH, export "Đơn hàng" backup có cột Giá vốn KH/Lợi nhuận KH) | **Chưa sửa** — để task sau. Task này chỉ tách quyền theo thẻ. |

---

# Thiết kế

## Danh mục quyền mới — resource `report`, action = slug endpoint

Action trùng đúng slug endpoint/`reportName` export đang có → kiểm tra quyền export chỉ cần `report.${name}`, không cần bảng map riêng.

| Nhóm | Thẻ | Key | Nhãn ở màn Vai trò |
|---|---|---|---|
| Tài chính | Doanh thu | `report.revenue` | Doanh thu |
| | Tiền mặt về | `report.cash-in` | Tiền mặt về |
| | Lợi nhuận kế hoạch | `report.profit` | Lợi nhuận kế hoạch |
| | Công nợ | `report.debt` | Công nợ |
| Bán hàng | Đơn hàng | `report.orders` | Đơn hàng |
| | Doanh thu theo sản phẩm | `report.revenue-by-product` | Doanh thu theo sản phẩm |
| | Tốc độ phát triển | `report.growth` | Tốc độ phát triển |
| | Tăng trưởng theo nhóm SP | `report.growth-by-product-type` | Tăng trưởng theo nhóm sản phẩm |
| Con người | Doanh thu theo nhân viên | `report.revenue-by-employee` | Doanh thu theo nhân viên |
| | Doanh thu theo khách hàng | `report.revenue-by-customer` | Doanh thu theo khách hàng |
| Vận hành | Hàng hoàn | `report.returns` | Hàng hoàn |
| Sản xuất | Doanh thu theo xưởng (+ trang chi tiết xưởng) | `report.revenue-by-production-center` | Doanh thu theo xưởng |
| Xuất dữ liệu backup | Khách hàng | `report.customers-list` | Xuất DS khách hàng (backup) |
| | Đơn hàng | `report.orders-list` | Xuất DS đơn hàng (backup) |
| | Công nợ | `report.receivables-list` | Xuất DS công nợ (backup) |
| | Thanh toán | `report.payments-list` | Xuất DS thanh toán (backup) |

## Chuyển đổi dữ liệu — data migration (không đổi schema)

Mục tiêu: **sau deploy không role nào mất/được thêm quyền** so với trước. User tự bỏ tích sau.

Trong 1 migration SQL:
1. `INSERT` 16 permission mới (`ON CONFLICT (key) DO NOTHING`).
2. Với **mọi role đang có `report.view`** → cấp đủ 16 quyền mới (`role_permissions`, `ON CONFLICT DO NOTHING`).
3. Ghi `permission_audits` cho mỗi lần cấp (`action = GRANT`, `changed_by = NULL` = hệ thống, `payload` ghi lý do "Tách report.view thành quyền theo từng báo cáo — 029") — tuân thủ "Không thay đổi dữ liệu âm thầm".
4. Ghi `permission_audits` `REVOKE` cho `report.view` ở các role đó (cùng payload), rồi xoá `role_permissions` của `report.view` và xoá permission `report.view`. (`permission_audits.permission_id` FK là `ON DELETE SET NULL` → lịch sử audit cũ giữ nguyên, key cũ lưu lại trong payload.)

Local hiện tại: 6 role có `report.view` (Chủ doanh nghiệp, Quản trị hệ thống, kế toán trưởng, Kế toán, Quản lý, Chỉ xem) — production cùng 6 role.

## Backend

- `seed.ts`: `report: [16 action]` thay `['view']`. `viewKeys()` (MANAGER/VIEWER) đang sinh `resource.view` cho mọi resource → sửa để role xem-hết vẫn nhận đủ quyền báo cáo; ACCOUNTANT nhận đủ 16 quyền thay cho `report.view`.
- `ReportController`: mỗi endpoint `@RequirePermission('report.<slug>')`. Chi tiết xưởng (`revenue-by-production-center/:id`) dùng chung quyền thẻ.
- Export `GET /reports/:name/export`: `:name` động nên không gắn được decorator tĩnh → kiểm tra trong code: thiếu `report.${name}` → `403`. Decorator class-level đổi thành "có ít nhất 1 quyền báo cáo" hoặc bỏ, để check trong method là nguồn duy nhất.
- Unit test: export bị chặn khi thiếu quyền đúng tên, cho qua khi có.

## Frontend

- `/reports`: chỉ hiện thẻ có quyền; nhóm không còn thẻ nào → ẩn cả nhóm.
- Sidebar + trang chủ: `NavItem` hỗ trợ "cần ít nhất 1 trong các quyền" (`requiredAnyPermission` hoặc tương đương) — menu "Báo cáo" hiện khi có ≥ 1 quyền `report.*`.
- Màn Vai trò: thêm 16 nhãn tiếng Việt. Màn này tự sinh checkbox theo catalog DB, có sẵn nút chọn cả nhóm "Báo cáo" — không phải sửa logic.
- Gõ thẳng URL báo cáo không có quyền → API 403 → trang báo lỗi như hiện tại (không lộ dữ liệu). Không thêm route guard riêng.

## Tài liệu

- `report.md` mục "Permission", `permission.md` (catalog Report), file này.

---

# Lưu ý khi deploy production

- Migration tự chạy khi `erp-api` khởi động lại (Dockerfile `prisma migrate deploy`).
- **Người dùng đang đăng nhập cần tải lại trang (F5)** sau deploy: FE giữ danh sách quyền từ lúc đăng nhập, menu "Báo cáo" có thể tạm ẩn cho tới khi tải lại. BE kiểm tra quyền theo DB mỗi request nên có hiệu lực ngay.
- Kiểm tra sau deploy: số permission `report.*` = 16, không còn `report.view`, mỗi role cũ có đủ 16, có audit GRANT/REVOKE tương ứng.

---

# Task

## ✅ Task 1 — Danh mục quyền + data migration + seed

Migration `20261012000000_report_permission_per_card`. Local: 6 role × 16 quyền, `report.view` đã xoá, audit 96 GRANT + 6 REVOKE.
## ✅ Task 2 — Backend: gate từng endpoint + export theo tên + test

14 route `@RequirePermission('report.<slug>')` (chi tiết xưởng dùng chung `report.revenue-by-production-center`); export kiểm tra `report.${name}` trong method qua `PermissionService`. Thêm `report.controller.spec.ts` (3 test).
## ✅ Task 3 — Frontend: lọc thẻ, sidebar "ít nhất 1 quyền", nhãn màn Vai trò

`config/report-permissions.ts` (16 key); `NavItem.requiredAnyPermission` + `canSeeNavItem()` dùng chung sidebar/trang chủ; `/reports` lọc thẻ + ẩn nhóm trống + EmptyState khi không có thẻ nào; 16 nhãn ở màn Vai trò.
## ✅ Task 4 — Test (unit, tsc, build, API thật với role đủ/thiếu quyền) + tài liệu

---

# Kết quả

- **BE:** `tsc` sạch; Jest 24 suite / 402 test pass (thêm 3 test export theo quyền). Lint không thêm lỗi so với HEAD.
- **FE:** `tsc` + `next build` sạch; lint không thêm lỗi.
- **Migration local:** 6 role × 16 quyền `report.*`, không còn `report.view`, audit 96 GRANT + 6 REVOKE.
- **API thật (local):** Chủ doanh nghiệp 200 / Kinh doanh (không có quyền báo cáo) 403 trên đủ 13 route báo cáo + chi tiết xưởng + 5 export (gồm 4 export backup); export tên lạ → 403; `/auth/me` trả 16 quyền `report.*`.
- **Trang:** `/`, `/reports`, `/reports/profit`, `/reports/production-centers`, `/settings/roles` → 200.
- **Ghi chú:** màn Vai trò sắp checkbox theo tên action tiếng Anh (`permission.findAllCatalog` orderBy action) — 16 quyền báo cáo không theo thứ tự thẻ. Chưa sửa (ngoài phạm vi).
