"use client";

import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  PiggyBank,
  CreditCard,
  ShoppingCart,
  Package,
  LineChart,
  Boxes,
  UserRound,
  Users,
  RotateCcw,
  DatabaseBackup,
  Receipt,
  Banknote,
  Contact,
  type LucideIcon,
  Factory,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared";
import { useAuth } from "@/context/auth-context";
import { REPORT_PERMISSIONS } from "@/config/report-permissions";

interface ReportLink {
  title: string;
  description: string;
  href: string;
  // Quyền xem thẻ này (029 — mỗi thẻ một quyền, xem config/report-permissions.ts).
  permission: string;
  icon: LucideIcon;
}

interface ReportGroup {
  label: string;
  reports: ReportLink[];
}

// 4 nhóm báo cáo theo report.md "Danh mục báo cáo" — D1 (Kho) không có trong
// danh sách vì tạm gỡ (014-bao-cao.md "Kiến trúc").
const REPORT_GROUPS: ReportGroup[] = [
  {
    label: "Tài chính",
    reports: [
      { title: "Doanh thu", description: "Tổng doanh thu, so sánh kỳ trước", href: "/reports/revenue", permission: REPORT_PERMISSIONS.revenue, icon: TrendingUp },
      { title: "Tiền mặt về", description: "Tiền thật đã thu, theo phương thức", href: "/reports/cash-in", permission: REPORT_PERMISSIONS.cashIn, icon: Wallet },
      { title: "Lợi nhuận kế hoạch", description: "Lợi nhuận kế hoạch, tỷ suất", href: "/reports/profit", permission: REPORT_PERMISSIONS.profit, icon: PiggyBank },
      { title: "Công nợ", description: "Số dư hiện tại và phát sinh trong kỳ", href: "/reports/debt", permission: REPORT_PERMISSIONS.debt, icon: CreditCard },
    ],
  },
  {
    label: "Bán hàng",
    reports: [
      { title: "Đơn hàng", description: "Số đơn theo trạng thái, đúng/trễ hạn", href: "/reports/orders", permission: REPORT_PERMISSIONS.orders, icon: ShoppingCart },
      { title: "Doanh thu theo sản phẩm", description: "Cơ cấu doanh thu, top sản phẩm", href: "/reports/revenue-by-product", permission: REPORT_PERMISSIONS.revenueByProduct, icon: Package },
      { title: "Tốc độ phát triển", description: "Doanh thu, tiền về, lợi nhuận theo tháng/năm", href: "/reports/growth", permission: REPORT_PERMISSIONS.growth, icon: LineChart },
      { title: "Tăng trưởng theo nhóm sản phẩm", description: "Doanh thu theo nhóm sản phẩm, theo tháng", href: "/reports/growth-by-product-type", permission: REPORT_PERMISSIONS.growthByProductType, icon: Boxes },
    ],
  },
  {
    label: "Con người",
    reports: [
      { title: "Doanh thu theo nhân viên", description: "Doanh thu mang về theo người phụ trách", href: "/reports/revenue-by-employee", permission: REPORT_PERMISSIONS.revenueByEmployee, icon: UserRound },
      { title: "Doanh thu theo khách hàng", description: "Top khách hàng, khách mới trong kỳ", href: "/reports/revenue-by-customer", permission: REPORT_PERMISSIONS.revenueByCustomer, icon: Users },
    ],
  },
  {
    label: "Vận hành",
    reports: [
      { title: "Hàng hoàn", description: "Số phiếu, giá trị hoàn, top lý do", href: "/reports/returns", permission: REPORT_PERMISSIONS.returns, icon: RotateCcw },
    ],
  },
  {
    // Nhóm Sản xuất (sprint-04/028).
    label: "Sản xuất",
    reports: [
      { title: "Doanh thu theo xưởng", description: "Doanh thu từng xưởng, chi tiết theo thời gian", href: "/reports/production-centers", permission: REPORT_PERMISSIONS.revenueByProductionCenter, icon: Factory },
    ],
  },
  {
    // Ngoài catalog 14 báo cáo phân tích (report.md) — export danh sách thô,
    // đầy đủ (kể cả đơn huỷ), phục vụ backup dữ liệu định kỳ.
    label: "Xuất dữ liệu backup",
    reports: [
      { title: "Khách hàng", description: "Toàn bộ khách hàng tạo trong kỳ", href: "/reports/customers-list", permission: REPORT_PERMISSIONS.customersList, icon: Contact },
      { title: "Đơn hàng", description: "Toàn bộ đơn hàng trong kỳ, kể cả đơn đã huỷ", href: "/reports/orders-list", permission: REPORT_PERMISSIONS.ordersList, icon: DatabaseBackup },
      { title: "Công nợ", description: "Toàn bộ phiếu công nợ trong kỳ", href: "/reports/receivables-list", permission: REPORT_PERMISSIONS.receivablesList, icon: Receipt },
      { title: "Thanh toán", description: "Toàn bộ lịch sử thu tiền trong kỳ", href: "/reports/payments-list", permission: REPORT_PERMISSIONS.paymentsList, icon: Banknote },
    ],
  },
];

export default function ReportsLandingPage() {
  const { hasPermission } = useAuth();
  // Chỉ hiện thẻ có quyền; nhóm không còn thẻ nào thì ẩn cả nhóm (029).
  const visibleGroups = REPORT_GROUPS.map((group) => ({
    ...group,
    reports: group.reports.filter((report) => hasPermission(report.permission)),
  })).filter((group) => group.reports.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Báo cáo" description="Phân tích theo kỳ, phục vụ ra quyết định" />

      {visibleGroups.length === 0 && (
        <EmptyState title="Chưa có quyền xem báo cáo" description="Liên hệ Owner/Admin để được cấp quyền xem báo cáo." />
      )}

      {visibleGroups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h3 className="text-lg font-semibold">{group.label}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.reports.map((report) => (
              <Link
                key={report.href}
                href={report.href}
                className="group rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent"
              >
                <report.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                <p className="mt-3 text-sm font-medium">{report.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
