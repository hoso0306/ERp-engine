import type { ReactNode } from "react";

// Card hoá từng khối Dashboard (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// mục 2) — dùng chung cho cả 5 khối (Hôm nay/Kinh doanh/Sản xuất/Tổng công
// nợ/Hàng hoàn), thay cho <section> nối tiếp như trước. Dùng token màu theme
// có sẵn (bg-card/border) — tự đổi đúng Light/Dark, không bịa palette mới.
// `accent` chỉ là dải viền trái mỏng để phân biệt nhẹ, không lòe loẹt.
interface DashboardCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  accent?: "default" | "warning";
  children: ReactNode;
}

const ACCENT_CLASS: Record<NonNullable<DashboardCardProps["accent"]>, string> = {
  default: "border-l-primary",
  warning: "border-l-destructive",
};

export function DashboardCard({
  title,
  description,
  actions,
  accent = "default",
  children,
}: DashboardCardProps) {
  return (
    <section
      className={`space-y-4 rounded-xl border border-l-4 ${ACCENT_CLASS[accent]} bg-card p-4 shadow-sm sm:p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
