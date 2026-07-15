"use client";

import Link from "next/link";
import { navigation } from "@/config/navigation";
import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/shared";

export default function HomePage() {
  const { hasPermission } = useAuth();

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
    <div className="space-y-8">
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
