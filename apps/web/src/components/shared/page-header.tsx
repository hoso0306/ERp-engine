"use client";

import { useSetBreadcrumbExtra } from "@/context/breadcrumb-context";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  // Nhãn riêng cho breadcrumb khi khác với title hiển thị trên trang (vd
  // trang Công nợ có title dài "Công nợ — DH00123", breadcrumb chỉ cần mã).
  breadcrumbLabel?: string;
}

export function PageHeader({ title, description, actions, breadcrumbLabel }: PageHeaderProps) {
  useSetBreadcrumbExtra({ label: breadcrumbLabel ?? title });

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
