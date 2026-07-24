import { Suspense } from "react";
import { LoginForm } from "./login-form";

interface Branding {
  companyName: string | null;
  logo: string | null;
}

// Fetch trên server tại request time để logo có sẵn ngay trong HTML đầu
// tiên — tránh nháy fallback trong lúc chờ client fetch (xem use-branding.ts,
// vẫn dùng cho Sidebar sau khi đã đăng nhập).
async function getInitialLogo(): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/branding`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Branding;
    return data.logo ?? null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const initialLogo = await getInitialLogo();

  return (
    <Suspense fallback={null}>
      <LoginForm initialLogo={initialLogo} />
    </Suspense>
  );
}
