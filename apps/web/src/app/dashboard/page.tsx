"use client";

import { PageHeader } from "@/components/shared";
import { SalesOverviewPanel } from "@/components/dashboard/sales-overview-panel";
import { ProductionOverviewPanel } from "@/components/dashboard/production-overview-panel";
import { DebtOverviewPanel } from "@/components/dashboard/debt-overview-panel";
import { ReturnOverviewPanel } from "@/components/dashboard/return-overview-panel";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { TodaySummaryBar } from "@/components/dashboard/today-summary-bar";

// 027-thiet-ke-lai-dashboard-bo-loc-rieng.md — bỏ hẳn bộ lọc + state chung ở
// trang này. Mỗi khối (Hôm nay/Cảnh báo/Kinh doanh/Sản xuất/Tổng công nợ/
// Hàng hoàn) giờ là 1 panel tự chủ hoàn toàn: tự fetch route riêng của mình
// (GET /dashboard/today|alerts|sales|production|debt|returns), tự quản lý
// filter/loading/error/permission-gating riêng, độc lập với các panel khác.
// Trang này chỉ còn nhiệm vụ mount đúng thứ tự (Hôm nay → Cảnh báo → Kinh
// doanh → Sản xuất → Tổng công nợ → Hàng hoàn).
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tổng quan tình hình kinh doanh, sản xuất và công nợ"
      />

      <div className="space-y-6">
        <TodaySummaryBar />
        <AlertsPanel />
        <SalesOverviewPanel />
        <ProductionOverviewPanel />
        <DebtOverviewPanel />
        <ReturnOverviewPanel />
      </div>
    </div>
  );
}
