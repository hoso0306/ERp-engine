import { Badge } from "@/components/ui/badge";

export const RECOVERY_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Còn trong kho",
  USED: "Đã sử dụng",
  DISPOSED: "Đã thanh lý",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  AVAILABLE: { label: RECOVERY_STATUS_LABEL.AVAILABLE, variant: "default" },
  USED:      { label: RECOVERY_STATUS_LABEL.USED,      variant: "secondary" },
  DISPOSED:  { label: RECOVERY_STATUS_LABEL.DISPOSED,  variant: "destructive" },
};

interface RecoveryInventoryStatusBadgeProps {
  status: string;
}

export function RecoveryInventoryStatusBadge({ status }: RecoveryInventoryStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
