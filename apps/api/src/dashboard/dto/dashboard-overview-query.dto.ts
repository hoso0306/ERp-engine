// Bộ lọc đầu trang Dashboard (rà soát bộ lọc thời gian, chốt 18/07/2026,
// 007-bo-loc-thoi-gian-dashboard.md) — ISO date string (yyyy-mm-dd).
export class DashboardOverviewQueryDto {
  from?: string;
  to?: string;
}
