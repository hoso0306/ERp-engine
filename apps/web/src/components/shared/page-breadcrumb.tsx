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
import { useBreadcrumbExtra } from "@/context/breadcrumb-context";

function getPageTitle(pathname: string): { title: string; href: string } | null {
  for (const group of navigation) {
    for (const item of group.items) {
      if (item.href === pathname) return { title: item.title, href: item.href };
      if (item.href !== "/" && pathname.startsWith(item.href)) {
        return { title: item.title, href: item.href };
      }
    }
  }
  return null;
}

export function PageBreadcrumb() {
  const pathname = usePathname();
  const extra = useBreadcrumbExtra();

  if (pathname === "/") return null;

  const page = getPageTitle(pathname);
  // Trang danh sách tự truyền PageHeader title trùng hệt tên nhóm điều hướng
  // (vd /products có title="Sản phẩm" giống nav) — bỏ qua, tránh lặp "Sản
  // phẩm > Sản phẩm". Chỉ hiện đoạn động khi nó THỰC SỰ khác (tên bản ghi cụ thể).
  const showExtra = !!extra && extra.label !== page?.title;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>
            Trang chủ
          </BreadcrumbLink>
        </BreadcrumbItem>
        {page && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {showExtra ? (
                <BreadcrumbLink render={<Link href={page.href} />}>{page.title}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{page.title}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {showExtra && extra && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{extra.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
