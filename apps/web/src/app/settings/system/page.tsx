"use client";

import { useEffect, useState, useCallback } from "react";
import { Loading, ErrorState } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsTabs } from "@/components/setting/settings-tabs";
import { SettingModuleForm, type SettingRow } from "@/components/setting/setting-module-form";
import { apiGet } from "@/lib/api";

// Nhãn hiển thị cho module — chỉ để dịch tên tiếng Việt, KHÔNG dùng để lọc/giới
// hạn danh sách module hiển thị (danh sách module luôn lấy động từ GET /settings).
const MODULE_LABEL: Record<string, string> = {
  Dashboard: "Dashboard",
  Notification: "Thông báo",
  Document: "Tài liệu in ấn",
  Security: "Bảo mật",
  Backup: "Sao lưu",
};

export default function SettingsSystemPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [moduleTab, setModuleTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SettingRow[]>("/settings");
      setSettings(data);
      setModuleTab((current) => current ?? data[0]?.module ?? null);
    } catch {
      setError("Không thể tải cấu hình hệ thống.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Nhóm động theo field `module` — không hardcode danh sách (setting.md).
  const modules = Array.from(new Set(settings.map((s) => s.module)));

  return (
    <div className="space-y-6">
      <SettingsTabs active="system" />
      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchSettings} />}
      {!loading && !error && modules.length > 0 && moduleTab && (
        <Tabs value={moduleTab} onValueChange={setModuleTab}>
          <TabsList>
            {modules.map((m) => (
              <TabsTrigger key={m} value={m}>{MODULE_LABEL[m] ?? m}</TabsTrigger>
            ))}
          </TabsList>
          {modules.map((m) => (
            <TabsContent key={m} value={m} className="mt-4">
              <SettingModuleForm
                module={m}
                settings={settings.filter((s) => s.module === m)}
                onSaved={fetchSettings}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
