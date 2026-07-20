"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { useAuth } from "@/context/auth-context";
import { Loading } from "@/components/shared";
import { ForcedChangePasswordScreen } from "@/components/auth/forced-change-password-screen";
import { BreadcrumbProvider } from "@/context/breadcrumb-context";
import { useBranding } from "@/lib/use-branding";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();
  const branding = useBranding();

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
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <Header />
          {/* relative + isolate: tạo stacking context riêng cho watermark bên
              dưới (zIndex:-1 chỉ so với nội dung TRONG main, không phụ thuộc
              layout shell ngoài — xem cách làm tương tự ở print/page.tsx báo
              giá). Áp dụng chung cho mọi trang qua layout thay vì lặp lại ở
              từng page. */}
          <main className="relative isolate flex-1 overflow-auto p-6">
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
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}
