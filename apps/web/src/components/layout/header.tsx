"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PageBreadcrumb } from "@/components/shared";
import { UserMenu } from "./user-menu";
import { HeaderStatusIndicator } from "./header-status-indicator";
import { HeaderClock } from "./header-clock";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 relative">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center gap-2">
        <PageBreadcrumb />
        {pathname === "/" && (
          <h1 className="text-sm font-medium">Trang chủ</h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        <HeaderClock />
        <UserMenu />
      </div>
      <HeaderStatusIndicator />
    </header>
  );
}
