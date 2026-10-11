-- Nhắc khách lâu không mua (sprint-04/028) — data migration, không đổi schema.
-- 3 ngưỡng số ngày theo Customer.priority. ON CONFLICT DO NOTHING: an toàn
-- khi môi trường đã có dòng này từ prisma db seed.
INSERT INTO "settings" ("id", "module", "key", "value", "default_value", "value_type", "description", "created_at", "updated_at")
VALUES
  ('setting_customer_reminder_high',   'Customer', 'reminderDaysHigh',   '30', '30', 'NUMBER', 'Nhắc khách ưu tiên Cao khi không mua hàng quá số ngày này',        NOW(), NOW()),
  ('setting_customer_reminder_medium', 'Customer', 'reminderDaysMedium', '60', '60', 'NUMBER', 'Nhắc khách ưu tiên Trung bình khi không mua hàng quá số ngày này', NOW(), NOW()),
  ('setting_customer_reminder_low',    'Customer', 'reminderDaysLow',    '90', '90', 'NUMBER', 'Nhắc khách ưu tiên Thấp khi không mua hàng quá số ngày này',       NOW(), NOW())
ON CONFLICT ("module", "key") DO NOTHING;
