import { Badge } from "@/components/ui/badge";

export const RETURN_STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn tất",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PROCESSING: { label: RETURN_STATUS_LABEL.PROCESSING, variant: "outline" },
  COMPLETED:  { label: RETURN_STATUS_LABEL.COMPLETED,  variant: "secondary" },
};

interface ReturnStatusBadgeProps {
  status: string;
}

export function ReturnStatusBadge({ status }: ReturnStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
