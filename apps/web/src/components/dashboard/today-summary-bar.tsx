"use client";

import { useCallback, useEffect, useState } from "react";
import { todayISO, Loading, ErrorState } from "@/components/shared";
import { apiGet } from "@/lib/api";
import { StatTile } from "./stat-tile";
import { DashboardCard } from "./dashboard-card";
import { DashboardRangeFilter, rangeLabel } from "./dashboard-range-filter";

// Dải "Hôm nay" — 027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 5: giờ có
// bộ lọc riêng, mặc định "Hôm nay" nhưng đổi được (vd "Hôm qua"). Tiêu đề
// card đổi động theo filter đang chọn (rangeLabel()). Mỗi số null khi thiếu
// quyền view của module sở hữu tương ứng (xem dashboard.controller.ts) — ẩn
// đúng tile đó, không ẩn cả khối.
export interface TodaySummary {
  newOrders: number | null;
  shippedOrders: number | null;
  cashInToday: number | null;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function TodaySummaryBar() {
  const [dateFrom, setDateFrom] = useState<string | undefined>(todayISO());
  const [dateTo, setDateTo] = useState<string | undefined>(todayISO());
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const json = await apiGet<TodaySummary>(`/dashboard/today?${params}`);
      setToday(json);
    } catch {
      setError("Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const label = rangeLabel(dateFrom, dateTo);

  const tiles = today
    ? [
        today.newOrders !== null && (
          <StatTile key="newOrders" label="Đơn mới" value={String(today.newOrders)} sub={label} />
        ),
        today.shippedOrders !== null && (
          <StatTile
            key="shippedOrders"
            label="Đơn đã giao xe"
            value={String(today.shippedOrders)}
            sub={label}
          />
        ),
        today.cashInToday !== null && (
          <StatTile
            key="cashInToday"
            label="Tiền đã thu"
            value={formatMoney(today.cashInToday)}
            sub={label}
          />
        ),
      ].filter(Boolean)
    : [];

  return (
    <DashboardCard
      title={label}
      actions={
        <DashboardRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={(r) => {
            setDateFrom(r.from);
            setDateTo(r.to);
          }}
        />
      }
    >
      {loading && !today && <Loading />}
      {error && !today && <ErrorState description={error} onRetry={fetchToday} />}
      {today && tiles.length === 0 && (
        <p className="text-sm text-muted-foreground">Không có quyền xem số liệu này.</p>
      )}
      {today && tiles.length > 0 && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{tiles}</div>}
    </DashboardCard>
  );
}
