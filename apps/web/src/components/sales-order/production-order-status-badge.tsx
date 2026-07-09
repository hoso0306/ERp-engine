import { Badge } from "@/components/ui/badge";

export const PRODUCTION_ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ sản xuất",
  IN_PRODUCTION: "Đang sản xuất",
  PRODUCTION_COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã huỷ",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING:              { label: PRODUCTION_ORDER_STATUS_LABEL.PENDING,              variant: "outline" },
  IN_PRODUCTION:        { label: PRODUCTION_ORDER_STATUS_LABEL.IN_PRODUCTION,        variant: "secondary" },
  PRODUCTION_COMPLETED: { label: PRODUCTION_ORDER_STATUS_LABEL.PRODUCTION_COMPLETED, variant: "default" },
  CANCELLED:            { label: PRODUCTION_ORDER_STATUS_LABEL.CANCELLED,           variant: "destructive" },
};

interface ProductionOrderStatusBadgeProps {
  status: string;
}

export function ProductionOrderStatusBadge({ status }: ProductionOrderStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
