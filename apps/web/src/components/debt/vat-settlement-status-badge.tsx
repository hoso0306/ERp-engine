import { Badge } from "@/components/ui/badge";

export const VAT_SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  PAID: "Đã thanh toán",
  INVOICED: "Đã xuất hóa đơn",
  CANCELLED: "Đã huỷ",
};

const VAT_SETTLEMENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SENT: "outline",
  PAID: "default",
  INVOICED: "default",
  CANCELLED: "destructive",
};

interface VatSettlementStatusBadgeProps {
  status: string;
}

export function VatSettlementStatusBadge({ status }: VatSettlementStatusBadgeProps) {
  return (
    <Badge variant={VAT_SETTLEMENT_STATUS_VARIANT[status] ?? "outline"}>
      {VAT_SETTLEMENT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
