"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { useAuth } from "@/context/auth-context";
import { Loading } from "@/components/shared";
import { ForcedChangePasswordScreen } from "@/components/auth/forced-change-password-screen";
import { BreadcrumbProvider } from "@/context/breadcrumb-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();

  // /login và mọi trang in (kết thúc bằng /print) tự quản layout riêng,
  // không có sidebar/header — bắt buộc để bản in không bị chèn sidebar
  // (009-in-phieu-san-xuat.md: sidebar chiếm chỗ làm nội dung phiếu bị
  // cắt khi in thật).
  if (pathname === "/login" || pathname.endsWith("/print")) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (user?.mustChangePassword) {
    return <ForcedChangePasswordScreen />;
  }

  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
