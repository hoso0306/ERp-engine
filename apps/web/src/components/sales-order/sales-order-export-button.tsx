"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { downloadAuthenticatedFile } from "@/lib/download";
import { useAuth } from "@/context/auth-context";

interface SalesOrderExportButtonProps {
  search: string;
  status: string | null;
  // "self" | "all" | userId cụ thể — cùng state với bộ lọc "Người phụ trách".
  ownerId: string;
  createdFrom: string;
  createdTo: string;
  deliveryFrom: string;
  deliveryTo: string;
}

// Xuất Excel đúng bộ lọc đang xem trên trang Đơn hàng — ẩn hoàn toàn nếu
// không có quyền sales-order.export. Xuất theo người khác/"Tất cả" (bộ lọc
// vẫn xem được, không giới hạn) chỉ chặn ở BƯỚC XUẤT nếu thiếu
// sales-order.export-all, chặn sớm phía FE để khỏi tốn round-trip.
export function SalesOrderExportButton({
  search,
  status,
  ownerId,
  createdFrom,
  createdTo,
  deliveryFrom,
  deliveryTo,
}: SalesOrderExportButtonProps) {
  const { user, hasPermission } = useAuth();
  const canExport = hasPermission("sales-order.export");
  const canExportAll = hasPermission("sales-order.export-all");
  const [exporting, setExporting] = useState(false);

  if (!canExport) return null;

  const isOwnFilter = ownerId === "self" || ownerId === user?.id;

  async function handleExport() {
    if (!isOwnFilter && !canExportAll) {
      toast.error("Bạn chỉ xem được đơn của người khác, không xuất Excel được — chọn lại \"Của tôi\" để xuất.");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (!isOwnFilter) params.set("ownerId", ownerId);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      if (createdFrom) params.set("from", createdFrom);
      if (createdTo) params.set("to", createdTo);
      if (deliveryFrom) params.set("deliveryFrom", deliveryFrom);
      if (deliveryTo) params.set("deliveryTo", deliveryTo);
      await downloadAuthenticatedFile(
        apiUrl(`/sales-orders/export?${params}`),
        "don-hang.xlsx",
      );
    } catch {
      toast.error("Không thể tải file export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
      Xuất Excel
    </Button>
  );
}
