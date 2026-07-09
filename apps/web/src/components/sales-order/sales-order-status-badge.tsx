import { Badge } from "@/components/ui/badge";

export const SALES_ORDER_STATUS_LABEL: Record<string, string> = {
  IN_PRODUCTION: "Đang sản xuất",
  PRODUCTION_COMPLETED: "Hoàn thành SX",
  SHIPPED: "Đã gửi xe",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  IN_PRODUCTION:        { label: SALES_ORDER_STATUS_LABEL.IN_PRODUCTION,        variant: "outline" },
  PRODUCTION_COMPLETED: { label: SALES_ORDER_STATUS_LABEL.PRODUCTION_COMPLETED, variant: "secondary" },
  SHIPPED:              { label: SALES_ORDER_STATUS_LABEL.SHIPPED,              variant: "default" },
  DELIVERED:            { label: SALES_ORDER_STATUS_LABEL.DELIVERED,            variant: "default" },
  CANCELLED:            { label: SALES_ORDER_STATUS_LABEL.CANCELLED,            variant: "destructive" },
};

interface SalesOrderStatusBadgeProps {
  status: string;
}

export function SalesOrderStatusBadge({ status }: SalesOrderStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
