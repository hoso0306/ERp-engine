"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { ReportRangeFilter, ReportExportButtons, defaultReportRange } from "@/components/report";

// Xuất dữ liệu backup — Thanh toán (report.md mục "Xuất dữ liệu backup").
// Ngoài catalog 14 báo cáo phân tích: liệt kê TOÀN BỘ Payment trong kỳ —
// không có màn hình xem trước, chỉ xuất file.
export default function PaymentsListBackupPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xuất dữ liệu backup — Thanh toán"
        description="Toàn bộ lịch sử thu tiền trong khoảng thời gian đã chọn"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="payments-list" from={from} to={to} />
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        Chọn khoảng ngày (theo ngày thu tiền) rồi bấm Excel/PDF để tải file. Không giới hạn số dòng.
      </p>
    </div>
  );
}
