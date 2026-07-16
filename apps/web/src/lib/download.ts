import { getStoredToken, storeToken } from "./auth-cookie";

/**
 * Tải file từ endpoint có AuthGuard — không thể dùng window.open/<a href>
 * (điều hướng trình duyệt thuần không đính kèm được header Authorization,
 * trong khi token app lưu ở cookie riêng chỉ được gắn thủ công qua fetch).
 * Fetch kèm token → lấy blob → trigger download qua <a download>. Tên file
 * lấy từ header Content-Disposition server trả về (cần CORS exposedHeaders,
 * xem apps/api/src/main.ts), fallback nếu không đọc được.
 */
export async function downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
  const token = getStoredToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error("Không thể tải file.");
  }

  const refreshedToken = res.headers.get("X-Refreshed-Token");
  if (refreshedToken) storeToken(refreshedToken);

  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
