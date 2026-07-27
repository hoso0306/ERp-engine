"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SETTINGS_TABS = [
  { value: "company", href: "/settings/company", label: "Công ty" },
  { value: "running-numbers", href: "/settings/running-numbers", label: "Bộ số chứng từ" },
  { value: "system", href: "/settings/system", label: "Cấu hình hệ thống" },
  { value: "users", href: "/settings/users", label: "Người dùng" },
  { value: "roles", href: "/settings/roles", label: "Vai trò" },
] as const;

export type SettingsTabValue = (typeof SETTINGS_TABS)[number]["value"];

export function SettingsTabs({ active }: { active: SettingsTabValue }) {
  return (
    <>
      <PageHeader title="Cài đặt" description="Cấu hình thông tin công ty và hệ thống" />

      <Tabs value={active}>
        <TabsList>
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} render={<Link href={t.href} />}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}
