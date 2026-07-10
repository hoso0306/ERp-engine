"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyForm } from "@/components/setting/company-form";
import { RunningNumberTable } from "@/components/setting/running-number-table";
import { SettingModuleForm, type SettingRow } from "@/components/setting/setting-module-form";
import { apiGet } from "@/lib/api";

interface RunningNumber {
  id: string;
  type: string;
  prefix: string;
  lastNumber: number;
  paddingLength: number;
  enabled: boolean;
}

// Nhãn hiển thị cho module — chỉ để dịch tên tiếng Việt, KHÔNG dùng để lọc/giới
// hạn danh sách module hiển thị (danh sách module luôn lấy động từ GET /settings).
const MODULE_LABEL: Record<string, string> = {
  Dashboard: "Dashboard",
  Notification: "Thông báo",
  Document: "Tài liệu in ấn",
  Security: "Bảo mật",
  Backup: "Sao lưu",
};

export default function SettingsPage() {
  const [tab, setTab] = useState("company");

  const [runningNumbers, setRunningNumbers] = useState<RunningNumber[]>([]);
  const [rnLoading, setRnLoading] = useState(true);
  const [rnError, setRnError] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [settingModuleTab, setSettingModuleTab] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const fetchRunningNumbers = useCallback(async () => {
    setRnLoading(true);
    setRnError(null);
    try {
      const data = await apiGet<RunningNumber[]>("/settings/running-numbers");
      setRunningNumbers(data);
    } catch {
      setRnError("Không thể tải bộ số chứng từ.");
    } finally {
      setRnLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const data = await apiGet<SettingRow[]>("/settings");
      setSettings(data);
      setSettingModuleTab((current) => current ?? data[0]?.module ?? null);
    } catch {
      setSettingsError("Không thể tải cấu hình hệ thống.");
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "running-numbers") fetchRunningNumbers();
  }, [tab, fetchRunningNumbers]);

  useEffect(() => {
    if (tab === "system") fetchSettings();
  }, [tab, fetchSettings]);

  // Nhóm động theo field `module` — không hardcode danh sách (setting.md).
  const settingModules = Array.from(new Set(settings.map((s) => s.module)));

  return (
    <div className="space-y-6">
      <PageHeader title="Cài đặt" description="Cấu hình thông tin công ty và hệ thống" />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="company">Công ty</TabsTrigger>
          <TabsTrigger value="running-numbers">Bộ số chứng từ</TabsTrigger>
          <TabsTrigger value="system">Cấu hình hệ thống</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyForm />
        </TabsContent>

        <TabsContent value="running-numbers" className="mt-4">
          {rnLoading && <Loading />}
          {rnError && <ErrorState description={rnError} onRetry={fetchRunningNumbers} />}
          {!rnLoading && !rnError && (
            <RunningNumberTable runningNumbers={runningNumbers} onSaved={fetchRunningNumbers} />
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          {settingsLoading && <Loading />}
          {settingsError && <ErrorState description={settingsError} onRetry={fetchSettings} />}
          {!settingsLoading && !settingsError && settingModules.length > 0 && settingModuleTab && (
            <Tabs value={settingModuleTab} onValueChange={setSettingModuleTab}>
              <TabsList>
                {settingModules.map((m) => (
                  <TabsTrigger key={m} value={m}>{MODULE_LABEL[m] ?? m}</TabsTrigger>
                ))}
              </TabsList>
              {settingModules.map((m) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
