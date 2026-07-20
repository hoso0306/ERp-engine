import { getStoredToken, storeToken, clearStoredToken } from "./auth-cookie";

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

export class ApiError extends Error {
  status: number;
  // Body lỗi gốc từ BE (vd errorCode, staleItems...) — dùng khi 1 endpoint trả
  // thêm field ngoài {statusCode, message} để FE xử lý riêng (xem
  // quotations/[id]/page.tsx handleApprove — PRICING_VERSION_STALE).
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?redirect=${redirect}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Bỏ qua trang splash "Visit Site" của ngrok free tier (ERR_NGROK_6024) —
  // ngrok chặn mọi request không có header này bằng 1 trang HTML thay vì
  // forward tới backend thật, kể cả gọi bằng fetch() chứ không phải điều
  // hướng trình duyệt. Header vô hại khi API không chạy qua ngrok.
  headers.set("ngrok-skip-browser-warning", "true");

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Sliding session: mỗi request hợp lệ được server cấp lại token mới (xem
  // apps/api/src/auth/auth.guard.ts) — âm thầm thay token cũ để phiên chỉ hết
  // hạn khi không còn hoạt động, không phải hạn cứng từ lúc đăng nhập.
  const refreshedToken = res.headers.get("X-Refreshed-Token");
  if (refreshedToken) storeToken(refreshedToken);

  // Chỉ coi 401 là "phiên hết hạn" khi request có đính token (đang dùng phiên
  // cũ mà bị từ chối). Nếu không có token — vd lúc gọi /auth/login — 401 nghĩa
  // là sai tài khoản/mật khẩu, không phải hết hạn; để rơi xuống nhánh dưới cho
  // hiển thị đúng message backend trả (còn mấy lần thử, bị khoá...).
  if (res.status === 401 && token) {
    clearStoredToken();
    redirectToLogin();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
  }

  if (!res.ok) {
    let message = `Có lỗi xảy ra (${res.status}).`;
    let body: unknown;
    try {
      body = await res.json();
      const parsedMessage = (body as { message?: string | string[] })?.message;
      message = Array.isArray(parsedMessage) ? parsedMessage.join(", ") : parsedMessage ?? message;
    } catch {
      /* response không phải JSON */
    }
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function jsonBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: jsonBody(body) });
}

export function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: jsonBody(body) });
}

export function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: jsonBody(body) });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

// Dùng cho các chỗ không gọi qua fetch (vd window.open để tải file
// export/template) — vẫn cần baseURL nhất quán với client này.
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
