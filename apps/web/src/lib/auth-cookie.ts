import { AUTH_COOKIE_NAME, AUTH_COOKIE_FALLBACK_MAX_AGE } from "./auth-constants";

// Cookie không-httpOnly (client tự set sau khi login) — cho phép middleware.ts
// đọc được để guard route ở server, khớp rủi ro XSS với localStorage (không
// tệ hơn). Xem workbench/sprint-02/003-fe-dang-nhap.md mục "Kết quả khảo sát".
function decodeJwtExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as { exp?: number };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function storeToken(token: string): void {
  const exp = decodeJwtExpiry(token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const maxAge = exp && exp > nowSeconds ? exp - nowSeconds : AUTH_COOKIE_FALLBACK_MAX_AGE;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function clearStoredToken(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}
