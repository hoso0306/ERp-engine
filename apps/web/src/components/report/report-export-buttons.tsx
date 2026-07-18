"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { downloadAuthenticatedFile } from "@/lib/download";

interface ReportExportButtonsProps {
  // Slug khớp đúng endpoint GET /reports/:name/export (report.controller.ts).
  reportName: string;
  from: string;
  to: string;
  groupBy?: string;
}

// Dùng chung cho toàn bộ 11 trang report (Task 06/08) — Excel/PDF luôn cùng
// bộ lọc đang xem trên trang, không thêm tham số riêng.
export function ReportExportButtons({ reportName, from, to, groupBy }: ReportExportButtonsProps) {
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  async function handleExport(format: "xlsx" | "pdf") {
    setExporting(format);
    try {
      const params = new URLSearchParams({ from, to, format });
      if (groupBy) params.set("groupBy", groupBy);
      await downloadAuthenticatedFile(
        apiUrl(`/reports/${reportName}/export?${params}`),
        `${reportName}.${format === "pdf" ? "pdf" : "xlsx"}`,
      );
    } catch {
      toast.error("Không thể tải file export.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("xlsx")}>
        {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Excel
      </Button>
      <Button variant="outline" size="sm" disabled={exporting !== null} onClick={() => handleExport("pdf")}>
        {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        PDF
      </Button>
    </div>
  );
}
