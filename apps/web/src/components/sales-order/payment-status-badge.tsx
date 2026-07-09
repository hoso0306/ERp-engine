import { Badge } from "@/components/ui/badge";

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  UNPAID:          { label: PAYMENT_STATUS_LABEL.UNPAID,          variant: "destructive" },
  PARTIALLY_PAID:  { label: PAYMENT_STATUS_LABEL.PARTIALLY_PAID,  variant: "secondary" },
  PAID:            { label: PAYMENT_STATUS_LABEL.PAID,            variant: "default" },
};

interface PaymentStatusBadgeProps {
  status: string;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
