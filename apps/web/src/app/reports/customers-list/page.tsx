"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { ReportRangeFilter, ReportExportButtons, defaultReportRange } from "@/components/report";

// Xuất dữ liệu backup — Khách hàng (report.md mục "Xuất dữ liệu backup").
// Ngoài catalog 14 báo cáo phân tích: liệt kê TOÀN BỘ Customer tạo trong kỳ
// (loại khách đã xoá mềm, cùng hành vi GET /customers/export) — không có
// màn hình xem trước, chỉ xuất file.
export default function CustomersListBackupPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xuất dữ liệu backup — Khách hàng"
        description="Toàn bộ khách hàng tạo trong khoảng thời gian đã chọn"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="customers-list" from={from} to={to} />
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        Chọn khoảng ngày (theo ngày tạo khách hàng) rồi bấm Excel/PDF để tải file. Không giới hạn số dòng.
      </p>
    </div>
  );
}
