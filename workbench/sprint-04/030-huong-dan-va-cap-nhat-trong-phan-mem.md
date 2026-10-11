# Milestone (Sprint 04) - Mục "Hướng dẫn & cập nhật" trong phần mềm

> **Tên file:** `workbench/sprint-04/030-huong-dan-va-cap-nhat-trong-phan-mem.md`
> **Trạng thái:** ✅ Code xong (12/10/2026) — chưa commit, chưa deploy.

---

# Bối cảnh

Phần mềm sẽ được bàn giao toàn bộ cho khách. Hiện thông báo cập nhật chỉ gửi qua Zalo (trôi mất, nhân viên mới không có gì để đọc) và chưa có hướng dẫn sử dụng cho người dùng cuối.

Quyết định với user (11/10/2026): đưa **hướng dẫn sử dụng + nhật ký cập nhật vào thành 1 mục trong phần mềm**. Zalo chỉ còn vai trò báo tin ngắn kèm "xem chi tiết trong mục Hướng dẫn & cập nhật".

**Ngoài phạm vi task này:** tài liệu vận hành cho người quản trị (VPS, backup/khôi phục, tên miền, Cloudflare, rclone) — phải nằm NGOÀI phần mềm (cần nhất đúng lúc phần mềm sập), làm task riêng.

---

# Người dùng & mục tiêu

- **Ai:** mọi nhân viên đã đăng nhập (Chủ DN, Kế toán, Kinh doanh, Sản xuất…), kể cả nhân viên mới.
- **Họ cần:** (1) biết đợt cập nhật vừa rồi có gì; (2) tự tra "việc X làm ở đâu, bấm gì" mà không phải hỏi người làm phần mềm.
- **Kết quả mong muốn:** giảm câu hỏi lặp lại; nhân viên mới tự học được luồng chính.

---

# Thiết kế

## Vị trí

- Menu trái, nhóm **"Hệ thống"**, mục mới **"Hướng dẫn & cập nhật"** → route `/help`. Không gắn permission — ai đăng nhập cũng thấy (giống "Tài khoản của tôi").
- Trang có 2 tab:
  - **Có gì mới** — nhật ký cập nhật theo đợt, mới nhất ở trên.
  - **Hướng dẫn sử dụng** — danh sách bài hướng dẫn theo công việc, bấm vào xem chi tiết (`/help/<slug>`).

## Nội dung tách khỏi giao diện

- Nội dung viết dạng **dữ liệu có cấu trúc trong file TypeScript** (`apps/web/src/content/help/`): mỗi bài gồm tiêu đề, mô tả ngắn, các bước ("Vào đâu → bấm gì → kết quả"), lưu ý, liên kết thẳng tới màn hình liên quan. Giao diện chỉ đọc dữ liệu này để hiển thị.
- **Không thêm thư viện mới** (không Markdown/MDX) — giữ nguyên tech stack; cấu trúc cố định giúp mọi bài trình bày đồng nhất.
- Mỗi đợt cập nhật tính năng sau này: thêm 1 mục vào file nhật ký + sửa/thêm bài hướng dẫn liên quan **trong cùng commit với tính năng** → tài liệu luôn khớp phiên bản đang chạy.

## Hiển thị theo quyền

- Mỗi bài hướng dẫn và mỗi dòng trong nhật ký có thể khai báo quyền liên quan (dùng lại logic `canSeeNavItem` / `hasPermission` hiện có). Người không có quyền dùng tính năng đó → **không thấy bài/dòng đó** (vd Kế toán không thấy hướng dẫn Sản xuất).
- Nội dung chỉ mô tả cách dùng, không chứa dữ liệu nghiệp vụ.

## Nội dung bản đầu

1. **Nhật ký cập nhật:** đợt **11/10/2026** (doanh số theo xưởng + báo cáo Sản xuất; nhắc khách lâu không mua; lọc khách theo mức ưu tiên; phân quyền từng báo cáo) — cùng nội dung tin Zalo đã gửi. Các thay đổi trước 11/10 không đưa vào (chưa từng thông báo cho khách dưới dạng này).
2. **Bài hướng dẫn** — xem mục "Cần user chốt" (phạm vi bản đầu).

## Để sau (không làm trong task này)

- Chấm đỏ "Có gì mới" khi có đợt cập nhật người dùng chưa xem (cần lưu trạng thái đã xem — localStorage hoặc DB).
- Biểu tượng "?" tại các màn hình phức tạp, mở đúng bài hướng dẫn.
- Ảnh chụp màn hình minh hoạ trong bài hướng dẫn.

---

# Quyết định đã chốt (12/10/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Phạm vi bài hướng dẫn bản đầu | **Phương án (b)** — 4 tính năng mới đợt 11/10 + 7 luồng chính để bàn giao (~11 bài). |
| 2 | Tên mục / route | "Hướng dẫn & cập nhật" tại `/help` (theo đề xuất, user chưa yêu cầu đổi). |

## Danh sách bài bản đầu

**Tính năng mới (đợt 11/10/2026):**
1. Xem doanh số theo xưởng (Dashboard + Báo cáo → Sản xuất)
2. Nhắc khách lâu không mua
3. Lọc khách hàng theo mức độ ưu tiên
4. Phân quyền xem từng báo cáo

**Luồng chính:**
5. Quản lý khách hàng
6. Báo giá → khách xác nhận → đơn hàng
7. Sản xuất (bắt đầu / hoàn thành / in phiếu)
8. Giao hàng (gửi xe, khách nhận)
9. Thu tiền & công nợ
10. Hàng hoàn
11. Người dùng & phân quyền

Nội dung từng bài viết theo **thao tác thật trên giao diện hiện tại** (đọc lại code màn hình), không viết theo tài liệu thiết kế.

---

# Task

## ✅ Task 1 — Khung trang `/help` (2 tab, trang bài chi tiết, menu, lọc theo quyền)

`content/help/types.ts` (kiểu dữ liệu + `canSeeHelp`), `app/help/page.tsx` (tab đọc từ `?tab=`), `app/help/[slug]/page.tsx`, mục menu "Hướng dẫn & cập nhật" (nhóm Hệ thống, không gắn quyền).
## ✅ Task 2 — Nội dung: nhật ký cập nhật

`content/help/changelog.ts`: đợt 11/10/2026 (4 mục, ẩn theo quyền) + đợt 12/10/2026 (ra mắt mục Hướng dẫn).
## ✅ Task 3 — Nội dung: 11 bài hướng dẫn

`content/help/articles/` — new-features (4), sales (2), production (2), finance (2), admin (1). Viết theo thao tác thật trên giao diện (đọc code màn hình + service), đối chiếu tên nút từng bước.

**Phát hiện khi đối chiếu code (không viết vào hướng dẫn vì code chưa làm):** `customer.md` ghi "Không cho xoá khách đã phát sinh đơn" và "INACTIVE không cho tạo đơn mới" — code hiện KHÔNG chặn cả 2. Cần user quyết định có bổ sung không (task riêng).
## ✅ Task 4 — Test (tsc, lint, build, xem trang với role đủ/thiếu quyền) + tài liệu

---

# Kết quả

- `tsc` + `next build` sạch (route `/help`, `/help/[slug]`); ESLint thư mục mới sạch.
- Kiểm tra tự động: 11 bài, không trùng slug; mọi `href` trỏ tới route có thật; mọi `articleSlug` trong nhật ký tồn tại; không trùng key trong danh sách.
- Mô phỏng hiển thị theo quyền (role local): Chủ DN / Quản trị / Quản lý / Chỉ xem 11 bài; Kế toán, kế toán trưởng 9; Kinh doanh 5; Sản xuất 1; Kho 0 (vẫn thấy tab Có gì mới).
- Trang `/help`, `/help?tab=guides`, `/help/bao-gia-va-don-hang`, slug không tồn tại → 200 (slug lạ hiện thông báo "Không tìm thấy bài hướng dẫn").
- Quy ước cập nhật hướng dẫn cùng commit tính năng: `knowledge/project/05-coding-convention.md`.
