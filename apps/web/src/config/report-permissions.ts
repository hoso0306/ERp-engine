// Phân quyền theo từng báo cáo (workbench/sprint-04/029) — mỗi thẻ ở trang
// /reports là một quyền `report.<slug>`, slug trùng đúng route API
// (`GET /reports/:slug`, `/reports/:slug/export`). Phải khớp
// REPORT_PERMISSION_ACTIONS trong apps/api/prisma/seed.ts.
export const REPORT_PERMISSIONS = {
  revenue: "report.revenue",
  cashIn: "report.cash-in",
  profit: "report.profit",
  debt: "report.debt",
  orders: "report.orders",
  revenueByProduct: "report.revenue-by-product",
  growth: "report.growth",
  growthByProductType: "report.growth-by-product-type",
  revenueByEmployee: "report.revenue-by-employee",
  revenueByCustomer: "report.revenue-by-customer",
  returns: "report.returns",
  revenueByProductionCenter: "report.revenue-by-production-center",
  customersList: "report.customers-list",
  ordersList: "report.orders-list",
  receivablesList: "report.receivables-list",
  paymentsList: "report.payments-list",
} as const;

export const ALL_REPORT_PERMISSIONS: string[] = Object.values(REPORT_PERMISSIONS);
