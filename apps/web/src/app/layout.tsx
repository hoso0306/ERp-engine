
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://erp.thanglongstar.com"),
  title: "Thăng Long Star ERP",
  description: "Hệ thống ERP quản lý nội bộ công ty Thăng Long Star",
  openGraph: {
    title: "Thăng Long Star ERP",
    description: "Hệ thống ERP quản lý nội bộ công ty Thăng Long Star",
    url: "https://erp.thanglongstar.com",
    siteName: "Thăng Long Star ERP",
    images: [
      {
        url: "/og-image.png",
        width: 566,
        height: 441,
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <AuthProvider>
          <TooltipProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
