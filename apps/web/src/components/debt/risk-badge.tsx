import { Badge } from "@/components/ui/badge";

export const RISK_LABEL: Record<string, string> = {
  LOW: "Rủi ro thấp",
  MEDIUM: "Rủi ro trung bình",
  HIGH: "Rủi ro cao",
};

const RISK_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "destructive",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Derived Data tính ở FE, không lưu thêm (CLAUDE.md mục 13) — cùng công thức
// đã định nghĩa ở knowledge/modules/debt.md mục "daysOverdue, riskLevel".
// Dùng cho danh sách (GET /receivables không trả sẵn 2 field này); trang chi
// tiết (GET /receivables/:id) đã có sẵn daysOverdue/riskLevel từ BE, không cần
// tính lại.
export function computeDaysOverdue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / MS_PER_DAY);
}

export function computeRiskLevel(daysOverdue: number | null): string | null {
  if (daysOverdue === null || daysOverdue <= 0) return null;
  if (daysOverdue <= 7) return "LOW";
  if (daysOverdue <= 30) return "MEDIUM";
  return "HIGH";
}

interface RiskBadgeProps {
  riskLevel: string | null;
}

export function RiskBadge({ riskLevel }: RiskBadgeProps) {
  if (!riskLevel) return null;
  return (
    <Badge variant={RISK_VARIANT[riskLevel] ?? "outline"}>
      {RISK_LABEL[riskLevel] ?? riskLevel}
    </Badge>
  );
}
