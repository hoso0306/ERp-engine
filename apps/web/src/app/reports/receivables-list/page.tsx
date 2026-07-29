"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { ReportRangeFilter, ReportExportButtons, defaultReportRange } from "@/components/report";

// Xuất dữ liệu backup — Công nợ (report.md mục "Xuất dữ liệu backup").
// Ngoài catalog 14 báo cáo phân tích: liệt kê TOÀN BỘ Receivable trong kỳ,
// kể cả công nợ của đơn đã huỷ — không có màn hình xem trước, chỉ xuất file.
export default function ReceivablesListBackupPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xuất dữ liệu backup — Công nợ"
        description="Toàn bộ phiếu công nợ trong khoảng thời gian đã chọn, bao gồm cả đơn đã huỷ"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="receivables-list" from={from} to={to} />
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        Chọn khoảng ngày (theo ngày tạo công nợ) rồi bấm Excel/PDF để tải file. Không giới hạn số dòng.
      </p>
    </div>
  );
}
