"use client";

import Link from "next/link";
import { navigation } from "@/config/navigation";
import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/shared";
import { useBranding } from "@/lib/use-branding";

export default function HomePage() {
  const { hasPermission } = useAuth();
  const branding = useBranding();

  const groups = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
      ),
    }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Chưa có quyền truy cập"
        description="Tài khoản của bạn chưa được cấp quyền truy cập tính năng nào — liên hệ Owner/Admin."
      />
    );
  }

  return (
    // relative + isolate: tạo stacking context riêng cho watermark bên dưới
    // (zIndex:-1 chỉ so với nội dung TRONG div này, không phụ thuộc layout
    // shell ngoài — xem cách làm ở print/page.tsx báo giá).
    <div className="relative isolate space-y-8">
      {branding?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logo}
          alt=""
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            objectFit: "contain",
            opacity: 0.08,
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
      )}
      {groups.map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {group.items.map((item) =>
              item.disabled ? (
                <div
                  key={item.href}
                  className="flex cursor-not-allowed flex-col items-center gap-2 rounded-lg border p-4 text-center opacity-50"
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                    Đang phát triển
                  </span>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50"
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{item.title}</span>
                </Link>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
