"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { downloadAuthenticatedFile } from "@/lib/download";

interface ReceivableExportButtonProps {
  // "/receivables/export" (Theo đơn hàng) hoặc "/receivables/by-customer/export"
  // (Theo khách hàng) — cùng backend build file khớp đúng bộ lọc đang xem.
  endpoint: string;
  buildParams: () => URLSearchParams;
  format: "pdf" | "xlsx";
}

const FORMAT_CONFIG = {
  pdf: { label: "In PDF", icon: FileDown, extension: "pdf" },
  xlsx: { label: "Xuất Excel", icon: FileSpreadsheet, extension: "xlsx" },
} as const;

// Xuất file (PDF/Excel) đúng bộ lọc đang xem trên trang (rà soát tab Công
// nợ, 27/08/2026) — TOÀN BỘ kết quả khớp bộ lọc, không chỉ trang hiện tại
// (cùng cách "Xuất Excel" ở trang Đơn hàng đang làm).
export function ReceivableExportButton({ endpoint, buildParams, format }: ReceivableExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { label, icon: Icon, extension } = FORMAT_CONFIG[format];

  async function handleExport() {
    setLoading(true);
    try {
      const params = buildParams();
      params.set("format", format);
      await downloadAuthenticatedFile(apiUrl(`${endpoint}?${params}`), `cong-no.${extension}`);
    } catch {
      toast.error(`Không thể tải file ${format === "pdf" ? "PDF" : "Excel"}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={handleExport}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}
