"use client";

import { PageHeader } from "@/components/shared";
import { MaterialForm } from "@/components/material/material-form";

export default function NewMaterialPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Thêm nguyên liệu" description="Tạo nguyên liệu mới" />
      <MaterialForm />
    </div>
  );
}
