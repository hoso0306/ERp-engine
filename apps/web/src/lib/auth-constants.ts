// Dùng chung giữa client code (lib/api.ts, context/auth-context.tsx) và
// proxy.ts (nodejs runtime) — không được import bất kỳ API nào phụ thuộc
// `document`/`window` từ file này.
export const AUTH_COOKIE_NAME = "erp_token";
export const AUTH_COOKIE_FALLBACK_MAX_AGE = 60 * 60 * 8; // 8h — dùng khi không decode được `exp` từ JWT
