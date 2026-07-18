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
  UserCog,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  // Trang chưa được xây (BE đã có, FE thuộc milestone sau — xem
  // workbench/roadmap.md): hiển thị badge "Đang phát triển", không cho bấm.
  disabled?: boolean;
  // Permission key (resource.action, xem knowledge/modules/permission.md)
  // cần có để thấy mục menu này. Không khai báo = luôn hiển thị cho mọi User
  // đã đăng nhập — áp dụng cho Sản phẩm/Vật tư/Danh mục vì hệ thống hiện
  // KHÔNG có permission key nào cho các resource này (không có trong seed
  // PERMISSION_CATALOG của apps/api/prisma/seed.ts) — không tự suy đoán
  // thêm permission mới ở milestone FE này.
  requiredPermission?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: "Điều hành",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredPermission: "dashboard.view" },
      { title: "Báo cáo", href: "/reports", icon: BarChart3, requiredPermission: "report.view" },
    ],
  },
  {
    label: "Kinh doanh",
    items: [
      { title: "Khách hàng", href: "/customers", icon: Users, requiredPermission: "customer.view" },
      { title: "Báo giá", href: "/quotations", icon: FileText, requiredPermission: "quotation.view" },
      { title: "Đơn hàng", href: "/orders", icon: ShoppingCart, requiredPermission: "sales-order.view" },
      { title: "Công nợ", href: "/debts", icon: CreditCard, requiredPermission: "debt.view" },
      { title: "Hàng hoàn", href: "/returns", icon: RotateCcw, requiredPermission: "return.view" },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { title: "Sản phẩm", href: "/products", icon: Package },
      { title: "Vật tư", href: "/materials", icon: Boxes },
      { title: "Sản xuất", href: "/production", icon: Factory, requiredPermission: "production.view" },
      // Module Kho tạm gỡ khỏi triển khai (18/07/2026, xem warehouse.md mục
      // "Trạng thái triển khai") — hiển thị badge "Đang phát triển", không cho
      // bấm (route /warehouse cũng đã ẩn ở app/_warehouse).
      { title: "Kho", href: "/warehouse", icon: Warehouse, disabled: true, requiredPermission: "warehouse.view" },
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
      { title: "Cài đặt", href: "/settings", icon: Settings, requiredPermission: "settings.view" },
      { title: "Người dùng", href: "/settings/users", icon: UserCog, requiredPermission: "user.view" },
      { title: "Vai trò", href: "/settings/roles", icon: ShieldCheck, requiredPermission: "role.view" },
    ],
  },
];
