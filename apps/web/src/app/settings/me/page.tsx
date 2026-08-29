"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, DateRangeFilter, Loading, ErrorState } from "@/components/shared";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import {
  EmployeeRevenueBarChart,
  type EmployeeRevenueBarRow,
} from "@/components/dashboard/employee-revenue-bar-chart";
import { Mail, Phone, ArrowUpRight, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface MySummary {
  revenue: number;
  orderCount: number;
  totalRemainingDebt: number;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRangeThisMonth(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: iso(start), to: iso(end) };
}

// "So với kỳ trước" (rà soát nghiệp vụ 27/08/2026 — thêm cho vui) — kỳ liền
// trước, CÙNG ĐỘ DÀI với khoảng đang chọn (vd chọn 1 tháng → so với 1 tháng
// liền trước, không cố định "tháng trước" theo lịch).
function previousRange(dateFrom: string, dateTo: string): { from: string; to: string } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

// Trang "Tài khoản của tôi" (rà soát nghiệp vụ 27/08/2026) — mục riêng ở
// sidebar, đặt ngay dưới "Cài đặt" (sửa 28/08/2026: ban đầu làm thành 1 tab
// lồng trong trang Settings, đổi sang mục sidebar độc lập theo yêu cầu — xem
// config/navigation.ts, KHÔNG gắn requiredPermission vì trang này dành cho
// MỌI người dùng đã đăng nhập, không phân biệt role/quyền, kể cả role không
// có settings.view (không thấy "Cài đặt") vẫn phải thấy trang này. Doanh
// số/công nợ CHỈ hiện
// số của CHÍNH người xem — BE tự lấy userId từ JWT (GET /dashboard/me/summary),
// không nhận ownerId từ query nên không cần sales-order.view-cost/debt.view.
// Riêng biểu đồ so sánh nhân viên (lộ số NGƯỜI KHÁC) vẫn giữ nguyên gate
// sales-order.view-cost như khối "Doanh số theo nhân viên" trên Dashboard.
export default function MyAccountPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canViewEmployeeChart = hasPermission("sales-order.view-cost");

  const initial = presetRangeThisMonth();
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [summary, setSummary] = useState<MySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "So với kỳ trước" — fetch riêng, lỗi/chưa xong không chặn số chính hiển
  // thị (chỉ là phần thêm cho vui, không phải số liệu cốt lõi).
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null);

  const [employeeRows, setEmployeeRows] = useState<EmployeeRevenueBarRow[] | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setSummary(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const json = await apiGet<MySummary>(`/dashboard/me/summary?${params}`);
      setSummary(json);
    } catch {
      setError("Không thể tải số liệu cá nhân.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setPrevRevenue(null);
      return;
    }
    const prev = previousRange(dateFrom, dateTo);
    const params = new URLSearchParams({ from: prev.from, to: prev.to });
    apiGet<MySummary>(`/dashboard/me/summary?${params}`)
      .then((json) => setPrevRevenue(json.revenue))
      .catch(() => setPrevRevenue(null));
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!canViewEmployeeChart || !dateFrom || !dateTo) {
      setEmployeeRows(null);
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    apiGet<EmployeeRevenueBarRow[] | null>(`/dashboard/sales/by-employee?${params}`)
      .then((json) => setEmployeeRows(json ?? []))
      .catch(() => setEmployeeRows([]))
      .finally(() => setChartLoading(false));
  }, [canViewEmployeeChart, dateFrom, dateTo]);

  // Xếp hạng (rà soát nghiệp vụ 27/08/2026 — thêm cho vui) — suy ra từ chính
  // employeeRows đã fetch cho biểu đồ so sánh (đã sort revenue giảm dần ở
  // BE), không gọi thêm API. Chỉ có khi có quyền xem biểu đồ (cần thấy số
  // NGƯỜI KHÁC mới xếp hạng được) — cùng gate sales-order.view-cost.
  const myRank =
    employeeRows && user
      ? employeeRows.findIndex((e) => e.ownerId === user.id) + 1
      : 0;

  const revenueDeltaPercent =
    prevRevenue !== null && prevRevenue > 0 && summary
      ? Math.round(((summary.revenue - prevRevenue) / prevRevenue) * 100)
      : null;

  function goToMyOrders() {
    const params = new URLSearchParams({
      ownerId: "self",
      createdFrom: dateFrom,
      createdTo: dateTo,
      // Loại đơn Đã huỷ (đề bài yêu cầu 5) — orders/page.tsx đọc excludeStatus
      // từ URL, khác với tab trạng thái (status) mặc định.
      excludeStatus: "CANCELLED",
    });
    router.push(`/orders?${params}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tài khoản của tôi" description="Số liệu và thông tin cá nhân của riêng bạn" />

      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <p className="text-xl font-semibold">Xin chào, {user?.name || user?.email}!</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {user?.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> {user.email}
            </span>
          )}
          {user?.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-4 w-4" /> {user.phone}
            </span>
          )}
        </div>
      </div>

      <DashboardCard
        title="Doanh số của tôi"
        description="Đã trừ phần Công ty hỗ trợ hàng hoàn/giảm trừ công nợ — bấm vào để xem danh sách đơn hàng tương ứng"
        actions={
          <DateRangeFilter
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
          />
        }
      >
        {!dateFrom || !dateTo ? (
          <p className="text-sm text-muted-foreground">Vui lòng chọn khoảng thời gian cụ thể.</p>
        ) : loading ? (
          <Loading />
        ) : error ? (
          <ErrorState description={error} onRetry={fetchSummary} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={goToMyOrders}
              className="group flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  Doanh số ({summary?.orderCount ?? 0} đơn)
                </span>
                {myRank > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    <Trophy className="h-3 w-3" /> #{myRank}/{employeeRows?.length}
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-2xl font-bold">
                {formatMoney(summary?.revenue ?? 0)}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
              {revenueDeltaPercent !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    revenueDeltaPercent > 0
                      ? "text-green-600 dark:text-green-400"
                      : revenueDeltaPercent < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {revenueDeltaPercent > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : revenueDeltaPercent < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {revenueDeltaPercent > 0 ? "+" : ""}
                  {revenueDeltaPercent}% so với kỳ trước
                </span>
              )}
              <span className="text-xs text-primary underline underline-offset-2">Xem danh sách đơn hàng</span>
            </button>

            <div className="flex flex-col items-start gap-1 rounded-lg border p-4">
              <span className="text-sm text-muted-foreground">Tổng công nợ đang quản lý</span>
              <span className="font-mono text-2xl font-bold">
                {formatMoney(summary?.totalRemainingDebt ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">Tính tại thời điểm hiện tại, không theo khoảng ngày</span>
            </div>
          </div>
        )}
      </DashboardCard>

      {canViewEmployeeChart && (
        <DashboardCard
          title="So sánh doanh số nhân viên"
          description="Chỉ hiện nhân viên đã phát sinh doanh số trong khoảng lọc ở trên"
        >
          {chartLoading ? (
            <Loading />
          ) : !employeeRows || employeeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có nhân viên nào phát sinh doanh số trong khoảng này.</p>
          ) : (
            <EmployeeRevenueBarChart data={employeeRows} />
          )}
        </DashboardCard>
      )}
    </div>
  );
}
