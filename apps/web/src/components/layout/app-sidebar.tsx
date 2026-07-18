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

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const branding = useBranding();

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
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

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
