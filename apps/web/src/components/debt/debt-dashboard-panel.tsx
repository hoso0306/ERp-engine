"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

interface DebtDashboard {
  totalReceivable: number;
  overdue: { customerCount: number; totalAmount: number };
  overdue30: { customerCount: number; totalAmount: number };
  creditExceeded: { customerCount: number; totalAmount: number };
  topDebtors: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    totalRemaining: number;
  }[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger";
}

function StatTile({ label, value, sub, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function DebtDashboardPanel() {
  const [data, setData] = useState<DebtDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DebtDashboard>("/receivables/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Tổng còn phải thu" value={formatMoney(data.totalReceivable)} />
        <StatTile
          label="Quá hạn"
          value={formatMoney(data.overdue.totalAmount)}
          sub={`${data.overdue.customerCount} khách hàng`}
          tone={data.overdue.totalAmount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Quá hạn trên 30 ngày"
          value={formatMoney(data.overdue30.totalAmount)}
          sub={`${data.overdue30.customerCount} khách hàng`}
          tone={data.overdue30.totalAmount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Vượt hạn mức tín dụng"
          value={formatMoney(data.creditExceeded.totalAmount)}
          sub={`${data.creditExceeded.customerCount} khách hàng`}
          tone={data.creditExceeded.totalAmount > 0 ? "danger" : "default"}
        />
      </div>

      {data.topDebtors.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium mb-3">Top khách nợ nhiều nhất</p>
          <ol className="space-y-2">
            {data.topDebtors.map((d, idx) => (
              <li key={d.customerId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                  <span className="font-medium">{d.customerName}</span>
                  <span className="text-xs text-muted-foreground">{d.customerPhone}</span>
                </span>
                <span className="font-mono text-destructive">{formatMoney(d.totalRemaining)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
