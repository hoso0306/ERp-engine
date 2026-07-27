"use client";

import { CompanyForm } from "@/components/setting/company-form";
import { SettingsTabs } from "@/components/setting/settings-tabs";

export default function SettingsCompanyPage() {
  return (
    <div className="space-y-6">
      <SettingsTabs active="company" />
      <CompanyForm />
    </div>
  );
}
