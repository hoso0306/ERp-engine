-- Phân quyền theo từng báo cáo (workbench/sprint-04/029) — data migration,
-- không đổi schema. Tách quyền dùng chung `report.view` thành 16 quyền, mỗi
-- thẻ báo cáo một quyền. Mọi role đang có `report.view` được cấp đủ 16 quyền
-- mới => sau migration KHÔNG role nào mất/được thêm quyền xem báo cáo.
-- Mọi lần cấp/thu hồi ghi permission_audits (changed_by NULL = hệ thống,
-- cùng cách seed ghi), không thay đổi âm thầm.

-- 1. 16 permission mới.
INSERT INTO "permissions" ("id", "resource", "action", "key", "created_at", "updated_at")
SELECT 'perm_report_' || a.action, 'report', a.action, 'report.' || a.action, NOW(), NOW()
FROM (VALUES
  ('revenue'), ('cash-in'), ('profit'), ('debt'),
  ('orders'), ('revenue-by-product'), ('growth'), ('growth-by-product-type'),
  ('revenue-by-employee'), ('revenue-by-customer'),
  ('returns'),
  ('revenue-by-production-center'),
  ('customers-list'), ('orders-list'), ('receivables-list'), ('payments-list')
) AS a(action)
ON CONFLICT ("key") DO NOTHING;

-- 2. Cấp đủ quyền mới cho mọi role đang có report.view (+ audit GRANT).
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT 'rp_029_' || md5(r."role_id" || p."id"), r."role_id", p."id", NOW()
FROM (
  SELECT rp."role_id"
  FROM "role_permissions" rp
  JOIN "permissions" pv ON pv."id" = rp."permission_id"
  WHERE pv."key" = 'report.view'
) r
CROSS JOIN "permissions" p
WHERE p."resource" = 'report' AND p."key" <> 'report.view'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

INSERT INTO "permission_audits" ("id", "role_id", "permission_id", "user_id", "action", "changed_by", "payload", "created_at")
SELECT 'pa_029_grant_' || md5(r."role_id" || p."id"), r."role_id", p."id", NULL, 'GRANT', NULL,
  jsonb_build_object('permissionKey', p."key", 'reason', 'Tách report.view thành quyền theo từng báo cáo (029)'),
  NOW()
FROM (
  SELECT rp."role_id"
  FROM "role_permissions" rp
  JOIN "permissions" pv ON pv."id" = rp."permission_id"
  WHERE pv."key" = 'report.view'
) r
CROSS JOIN "permissions" p
WHERE p."resource" = 'report' AND p."key" <> 'report.view';

-- 3. Thu hồi + xoá report.view (audit REVOKE trước khi xoá; FK
-- permission_audits.permission_id là ON DELETE SET NULL nên lịch sử cũ giữ
-- nguyên, key cũ đã nằm trong payload).
INSERT INTO "permission_audits" ("id", "role_id", "permission_id", "user_id", "action", "changed_by", "payload", "created_at")
SELECT 'pa_029_revoke_' || md5(r."role_id"), r."role_id", p."id", NULL, 'REVOKE', NULL,
  jsonb_build_object('permissionKey', 'report.view', 'reason', 'Tách report.view thành quyền theo từng báo cáo (029)'),
  NOW()
FROM (
  SELECT rp."role_id"
  FROM "role_permissions" rp
  JOIN "permissions" pv ON pv."id" = rp."permission_id"
  WHERE pv."key" = 'report.view'
) r
JOIN "permissions" p ON p."key" = 'report.view';

DELETE FROM "role_permissions"
WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "key" = 'report.view');

DELETE FROM "permissions" WHERE "key" = 'report.view';
