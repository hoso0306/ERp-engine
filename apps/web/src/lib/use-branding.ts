"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

interface Branding {
  companyName: string | null;
  logo: string | null;
}

// GET /settings/branding — endpoint công khai (không cần đăng nhập), chỉ trả
// companyName + logo. Dùng ở Sidebar và trang Login.
export function useBranding() {
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    apiGet<Branding>("/settings/branding")
      .then(setBranding)
      .catch(() => setBranding(null));
  }, []);

  return branding;
}
