import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:     { label: "Nháp",        variant: "secondary" },
  SENT:      { label: "Đã gửi",      variant: "default" },
  APPROVED:  { label: "Đã duyệt",    variant: "default" },
  CANCELLED: { label: "Đã huỷ",      variant: "destructive" },
};

interface QuotationStatusBadgeProps {
  status: string;
}

export function QuotationStatusBadge({ status }: QuotationStatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
