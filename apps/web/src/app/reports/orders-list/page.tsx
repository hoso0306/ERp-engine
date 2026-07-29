"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared";
import { ReportRangeFilter, ReportExportButtons, defaultReportRange } from "@/components/report";

// Xuất dữ liệu backup — Đơn hàng (report.md mục "Xuất dữ liệu backup").
// Ngoài catalog 14 báo cáo phân tích: liệt kê TOÀN BỘ SalesOrder trong kỳ,
// kể cả đơn đã huỷ — không có màn hình xem trước, chỉ xuất file.
export default function OrdersListBackupPage() {
  const initial = defaultReportRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xuất dữ liệu backup — Đơn hàng"
        description="Toàn bộ đơn hàng trong khoảng thời gian đã chọn, bao gồm cả đơn đã huỷ"
        actions={
          <div className="flex items-center gap-2">
            <ReportRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <ReportExportButtons reportName="orders-list" from={from} to={to} />
          </div>
        }
      />
      <p className="text-sm text-muted-foreground">
        Chọn khoảng ngày (theo ngày tạo đơn) rồi bấm Excel/PDF để tải file. Không giới hạn số dòng.
      </p>
    </div>
  );
}
