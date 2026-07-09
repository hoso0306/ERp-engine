"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { useAuth } from "@/context/auth-context";
import { Loading } from "@/components/shared";
import { ForcedChangePasswordScreen } from "@/components/auth/forced-change-password-screen";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();

  // /login tự quản layout riêng, không có sidebar/header.
  if (pathname === "/login") {
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
