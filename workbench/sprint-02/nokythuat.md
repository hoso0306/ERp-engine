# Nợ kỹ thuật — Sprint 02

> **Tên file:** `workbench/sprint-02/nokythuat.md`
>
> Theo dõi các khoản nợ kỹ thuật đã biết, chấp nhận tạm thời có chủ đích (không phải thiếu sót vô tình), kèm lý do và mốc cần xử lý. Đánh dấu ✅ khi đã trả xong, không xoá khỏi file — giữ lịch sử.

---

## [ ] 1. BE chưa gắn `AuthGuard`/`PermissionGuard` cho controller nghiệp vụ

**Phát sinh từ:** `003-fe-dang-nhap.md` (khảo sát 09/07/2026).

**Hiện trạng:** Toàn bộ 27 controller / 137 endpoint của BE (trừ 4 endpoint của `auth.controller.ts`) — Customer, Product, Quotation, Sales Order, Production, Warehouse, Debt, Return, Setting, Permission... — **không gắn `AuthGuard`/`PermissionGuard`** nào. API gọi thẳng được, không cần token, kể cả khi bypass FE (Postman/script gọi trực tiếp `http://localhost:3001/api/...`).

**Vì sao chấp nhận tạm thời:** Milestone `003-fe-dang-nhap.md` chỉ chốt phạm vi làm FE (ẩn menu/nút theo quyền) — quyết định đã chốt với người dùng 09/07/2026, xem "Quyết định đã chốt" trong file đó. ERP nội bộ (không public internet) nên mức độ khẩn cấp thấp hơn ứng dụng thương mại, nhưng vẫn là lỗ hổng thật: "ẩn nút" ở FE chỉ ngăn người dùng hợp lệ bấm nhầm, không ngăn được ai đó gọi trực tiếp API.

**Khối lượng khi xử lý:** ~133 endpoint (27 controller trừ auth) cần áp dụng `@UseGuards(AuthGuard, PermissionGuard)` + `@RequirePermission('resource.action')` theo đúng bảng permission key đã định nghĩa ở `knowledge/modules/permission.md` (seed tại `apps/api/prisma/seed.ts` — `PERMISSION_CATALOG`). Làm theo từng nhóm module, verify từng nhóm bằng cách gọi thử thiếu quyền → phải nhận `403`.

**Lưu ý khi xử lý:** `permission.md`/seed hiện **không có permission key nào cho Product, Material, Unit, ProductType, ProductionCenter** — cần quyết định trước: thêm resource mới vào catalog (đổi schema/seed) hay để các module này không qua `PermissionGuard` có chủ đích (chỉ `AuthGuard`). Đây là quyết định nghiệp vụ, không tự suy đoán khi làm.

**Mốc cần xử lý:** Milestone BE riêng, ngay sau milestone FE Đơn hàng (`004-fe-don-hang.md`) hoặc trước khi go-live — không để kéo dài.

---

## [ ] 2. `middleware.ts` dùng convention đã deprecated ở Next.js 16

**Phát sinh từ:** `003-fe-dang-nhap.md` — phát hiện khi chạy `next build` (09/07/2026).

**Hiện trạng:** `apps/web/src/middleware.ts` chạy đúng, build không lỗi, nhưng Next.js 16 in cảnh báo: convention `middleware.ts` đã deprecated, khuyến nghị đổi sang `proxy.ts`.

**Vì sao chấp nhận tạm thời:** Chỉ là cảnh báo, không chặn build hay runtime. Đổi ngay tốn công không cần thiết khi chưa rõ API `proxy.ts` khác `middleware.ts` ở điểm nào (cần đọc doc Next.js trước khi đổi, tránh đổi nhầm behavior route guard).

**Mốc cần xử lý:** Khi nâng cấp Next.js lần sau, hoặc khi có thời gian rảnh giữa các milestone — không khẩn cấp.

---

## Quy ước

- Mỗi khoản nợ là 1 mục `##`, checkbox `[ ]` ở đầu tiêu đề, đánh dấu `[x]` khi trả xong + ghi ngày.
- Bắt buộc có: Phát sinh từ (milestone/file nguồn), Hiện trạng, Vì sao chấp nhận tạm thời, Mốc cần xử lý.
- Không xoá mục đã trả — giữ để tra lịch sử quyết định.
