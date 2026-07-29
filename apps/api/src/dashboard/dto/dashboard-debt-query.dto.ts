// from/to (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 3-4) — khối Tổng
// công nợ giờ có bộ lọc riêng, chỉ ảnh hưởng 2 tile "phát sinh" mới, không
// đụng các tile số dư cũ (xem dashboard.service.ts getDebtDashboard()).
export class DashboardDebtQueryDto {
  upcomingDueDays?: string;
  from?: string;
  to?: string;
}
