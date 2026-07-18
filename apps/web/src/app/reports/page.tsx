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
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared";

interface ReportLink {
  title: string;
  description: string;
  href: string;
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
      { title: "Doanh thu", description: "Tổng doanh thu, so sánh kỳ trước", href: "/reports/revenue", icon: TrendingUp },
      { title: "Tiền mặt về", description: "Tiền thật đã thu, theo phương thức", href: "/reports/cash-in", icon: Wallet },
      { title: "Lợi nhuận kế hoạch", description: "Lợi nhuận kế hoạch, tỷ suất", href: "/reports/profit", icon: PiggyBank },
      { title: "Công nợ", description: "Số dư hiện tại và phát sinh trong kỳ", href: "/reports/debt", icon: CreditCard },
    ],
  },
  {
    label: "Bán hàng",
    reports: [
      { title: "Đơn hàng", description: "Số đơn theo trạng thái, đúng/trễ hạn", href: "/reports/orders", icon: ShoppingCart },
      { title: "Doanh thu theo sản phẩm", description: "Cơ cấu doanh thu, top sản phẩm", href: "/reports/revenue-by-product", icon: Package },
      { title: "Tốc độ phát triển", description: "Doanh thu, tiền về, lợi nhuận theo tháng/năm", href: "/reports/growth", icon: LineChart },
      { title: "Tăng trưởng theo nhóm sản phẩm", description: "Doanh thu theo nhóm sản phẩm, theo tháng", href: "/reports/growth-by-product-type", icon: Boxes },
    ],
  },
  {
    label: "Con người",
    reports: [
      { title: "Doanh thu theo nhân viên", description: "Doanh thu mang về theo người phụ trách", href: "/reports/revenue-by-employee", icon: UserRound },
      { title: "Doanh thu theo khách hàng", description: "Top khách hàng, khách mới trong kỳ", href: "/reports/revenue-by-customer", icon: Users },
    ],
  },
  {
    label: "Vận hành",
    reports: [
      { title: "Hàng hoàn", description: "Số phiếu, giá trị hoàn, top lý do", href: "/reports/returns", icon: RotateCcw },
    ],
  },
];

export default function ReportsLandingPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Báo cáo" description="Phân tích theo kỳ, phục vụ ra quyết định" />

      {REPORT_GROUPS.map((group) => (
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
