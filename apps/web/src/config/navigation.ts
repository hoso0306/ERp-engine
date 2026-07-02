import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  FileText,
  ShoppingCart,
  Warehouse,
  Factory,
  CreditCard,
  RotateCcw,
  BarChart3,
  Settings,
  Ruler,
  Tag,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Điều hành",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "Kinh doanh",
    items: [
      { title: "Khách hàng", href: "/customers", icon: Users },
      { title: "Báo giá", href: "/quotations", icon: FileText },
      { title: "Đơn hàng", href: "/orders", icon: ShoppingCart },
      { title: "Công nợ", href: "/debts", icon: CreditCard },
      { title: "Hàng hoàn", href: "/returns", icon: RotateCcw },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { title: "Sản phẩm", href: "/products", icon: Package },
      { title: "Nguyên liệu", href: "/materials", icon: Boxes },
      { title: "Sản xuất", href: "/production", icon: Factory },
      { title: "Kho", href: "/warehouse", icon: Warehouse },
    ],
  },
  {
    label: "Danh mục",
    items: [
      { title: "Xưởng sản xuất", href: "/production-centers", icon: Building2 },
      { title: "Loại sản phẩm", href: "/product-types", icon: Tag },
      { title: "Đơn vị tính", href: "/units", icon: Ruler },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { title: "Báo cáo", href: "/reports", icon: BarChart3 },
      { title: "Cài đặt", href: "/settings", icon: Settings },
    ],
  },
];
