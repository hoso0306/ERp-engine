-- Bật extension unaccent (contrib chuẩn của Postgres) — dùng để tìm kiếm
-- không phân biệt dấu tiếng Việt (vd "hoang" khớp "Hoàng"). Chỉ bật extension,
-- không đổi schema/cột nào — các câu query tìm kiếm sẽ gọi unaccent(lower(...))
-- trực tiếp qua raw SQL (xem apps/api/src/shared/unaccent-search.ts).
CREATE EXTENSION IF NOT EXISTS unaccent;
