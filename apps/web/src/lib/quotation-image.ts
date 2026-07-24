import { toCanvas } from "html-to-image";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Không thể tạo ảnh từ canvas."));
    }, "image/png");
  });
}

/**
 * Capture 1 DOM element thành 1 ảnh PNG duy nhất, từ trên xuống hết nội
 * dung (không cắt trang theo A4 — chốt 24/07/2026, ảnh chỉ dùng để gửi
 * Zalo/Messenger, không cần khớp khổ in).
 */
export async function captureQuotationImage(root: HTMLElement, pixelRatio = 3): Promise<Blob> {
  // Dùng document của chính root (có thể là iframe ẩn, khác document chính)
  // — mỗi document có FontFaceSet riêng.
  await root.ownerDocument?.fonts?.ready?.catch(() => {});

  // root dùng margin:"0 auto" để tự canh giữa trong parent — nếu không ép
  // width/height + xoá margin trên bản clone, html-to-image có thể đo sai
  // offset trái/phải và ảnh ra bị lệch/cắt (đã gặp thực tế 24/07/2026).
  const width = root.scrollWidth;
  const height = root.scrollHeight;
  const canvas = await toCanvas(root, {
    pixelRatio,
    backgroundColor: "#ffffff",
    cacheBust: false,
    width,
    height,
    style: { margin: "0", transform: "none" },
  });

  return canvasToBlob(canvas);
}

export function isClipboardImageSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    typeof window.ClipboardItem !== "undefined"
  );
}

export async function copyImageToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function downloadImageBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dựng iframe ẩn trỏ tới `src`, đợi load xong + font sẵn sàng, trả về
 * document bên trong để capture — dùng khi cần chụp ảnh báo giá ngay từ
 * trang chi tiết mà không mở tab mới (tái dùng đúng DOM của trang /print,
 * đảm bảo ảnh luôn đồng bộ với PDF).
 */
export function loadHiddenPrintFrame(src: string): Promise<{ frame: HTMLIFrameElement; doc: Document }> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.src = src;
    frame.style.position = "fixed";
    frame.style.top = "0";
    frame.style.left = "-9999px";
    frame.style.width = "1040px";
    frame.style.height = "1200px";
    frame.style.border = "0";
    frame.setAttribute("aria-hidden", "true");

    const timeout = setTimeout(() => {
      frame.remove();
      reject(new Error("Tải nội dung báo giá để chụp ảnh quá lâu."));
    }, 20000);

    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc) {
        clearTimeout(timeout);
        frame.remove();
        reject(new Error("Không truy cập được nội dung báo giá."));
        return;
      }
      // Trang /print tự fetch dữ liệu sau khi mount — đợi tới khi container
      // xuất hiện trong DOM (poll ngắn) trước khi coi là sẵn sàng chụp.
      const start = Date.now();
      const poll = setInterval(() => {
        const ready = doc.getElementById("quotation-print-content");
        if (ready) {
          clearInterval(poll);
          clearTimeout(timeout);
          resolve({ frame, doc });
        } else if (Date.now() - start > 15000) {
          clearInterval(poll);
          clearTimeout(timeout);
          frame.remove();
          reject(new Error("Không tải được nội dung báo giá để chụp ảnh."));
        }
      }, 150);
    };
    frame.onerror = () => {
      clearTimeout(timeout);
      frame.remove();
      reject(new Error("Không tải được trang báo giá."));
    };

    document.body.appendChild(frame);
  });
}
