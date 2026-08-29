"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { navigation } from "@/config/navigation";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/lib/use-branding";

// So khớp active theo tiền tố có ranh giới rõ ràng (tránh "/settings-other"
// khớp nhầm "/settings"), rồi chọn href DÀI NHẤT khớp trong TOÀN BỘ menu
// (không chỉ trong nhóm) — cần thiết từ khi có "Tài khoản của tôi"
// (/settings/me) cùng nhóm với "Cài đặt" (/settings): cả 2 href đều là tiền
// tố của "/settings/me", nếu so khớp độc lập từng mục sẽ sáng đèn cả 2 cùng
// lúc, chỉ đúng 1 mục cụ thể nhất mới nên sáng.
function findActiveHref(pathname: string, allItems: { href: string }[]): string | null {
  let best: string | null = null;
  for (const item of allItems) {
    const matches = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const branding = useBranding();
  const activeHref = findActiveHref(
    pathname,
    navigation.flatMap((group) => group.items),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          {branding?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain bg-white" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              E
            </div>
          )}
          <span className="truncate text-sm font-semibold">Rèm Thăng Long</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
          );
          if (visibleItems.length === 0) return null;

          return (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const isActive = item.href === activeHref;

                  // Module chưa có trang (BE sẵn, FE thuộc milestone sau):
                  // disable + badge "Đang phát triển" — không dẫn vào trang trống.
                  if (item.disabled) {
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          tooltip={`${item.title} — Đang phát triển`}
                          aria-disabled
                          className="cursor-not-allowed opacity-50 hover:bg-transparent"
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground group-data-[collapsible=icon]:hidden">
                            Đang phát triển
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="truncate text-xs text-muted-foreground">v0.0.1</p>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
