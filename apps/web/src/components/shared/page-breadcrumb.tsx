"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navigation } from "@/config/navigation";

function getPageTitle(pathname: string): string | null {
  for (const group of navigation) {
    for (const item of group.items) {
      if (item.href === pathname) return item.title;
      if (item.href !== "/" && pathname.startsWith(item.href)) return item.title;
    }
  }
  return null;
}

export function PageBreadcrumb() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const title = getPageTitle(pathname);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>
            Dashboard
          </BreadcrumbLink>
        </BreadcrumbItem>
        {title && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
