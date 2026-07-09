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
  // Trang chưa được xây (BE đã có, FE thuộc milestone sau — xem
  // workbench/roadmap.md): hiển thị badge "Đang phát triển", không cho bấm.
  disabled?: boolean;
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
      { title: "Đơn hàng", href: "/orders", icon: ShoppingCart, disabled: true },
      { title: "Công nợ", href: "/debts", icon: CreditCard, disabled: true },
      { title: "Hàng hoàn", href: "/returns", icon: RotateCcw, disabled: true },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { title: "Sản phẩm", href: "/products", icon: Package },
      { title: "Vật tư", href: "/materials", icon: Boxes },
      { title: "Sản xuất", href: "/production", icon: Factory, disabled: true },
      { title: "Kho", href: "/warehouse", icon: Warehouse, disabled: true },
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
      { title: "Báo cáo", href: "/reports", icon: BarChart3, disabled: true },
      { title: "Cài đặt", href: "/settings", icon: Settings, disabled: true },
    ],
  },
];
