"use client";

import * as React from "react";
import { ChevronDown, FileDown, Image as ImageIcon, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  captureQuotationImage, copyImageToClipboard, downloadImageBlob,
  isClipboardImageSupported, loadHiddenPrintFrame,
} from "@/lib/quotation-image";

interface ExportQuotationMenuProps {
  quotationId: string;
  quotationCode: string;
  // "inline": DOM chứng từ đã render sẵn tại trang gọi (trang /print) — chụp
  // trực tiếp qua containerId. "iframe": trang gọi (chi tiết báo giá) không
  // có sẵn DOM này — tự tải ẩn từ /quotations/{id}/print rồi mới chụp, đảm
  // bảo ảnh luôn xuất từ đúng 1 mẫu dùng cho PDF, không tồn tại mẫu thứ 2.
  mode: "inline" | "iframe";
  containerId?: string;
  onExportPdf: () => void;
}

export function ExportQuotationMenu({
  quotationId, quotationCode, mode, containerId = "quotation-print-content", onExportPdf,
}: ExportQuotationMenuProps) {
  const [busy, setBusy] = React.useState(false);

  async function resolveCaptureRoot(): Promise<{ root: HTMLElement; cleanup: () => void }> {
    if (mode === "inline") {
      const root = document.getElementById(containerId);
      if (!root) throw new Error("Không tìm thấy nội dung báo giá để chụp ảnh.");
      return { root, cleanup: () => {} };
    }
    const { frame, doc } = await loadHiddenPrintFrame(`/quotations/${quotationId}/print`);
    const root = doc.getElementById(containerId);
    if (!root) {
      frame.remove();
      throw new Error("Không tìm thấy nội dung báo giá để chụp ảnh.");
    }
    return { root, cleanup: () => frame.remove() };
  }

  // Luôn chụp 1 ảnh duy nhất từ trên xuống hết nội dung (chốt 24/07/2026) —
  // không cắt trang theo A4, ảnh chỉ dùng để gửi Zalo/Messenger.
  async function runCaptureAndDeliver() {
    setBusy(true);
    try {
      const { root, cleanup } = await resolveCaptureRoot();
      let blob: Blob;
      try {
        blob = await captureQuotationImage(root);
      } finally {
        cleanup();
      }
      if (isClipboardImageSupported()) {
        await copyImageToClipboard(blob);
        toast.success("✅ Đã sao chép ảnh báo giá.", {
          description: "Mở Zalo, Messenger... và nhấn Ctrl + V để gửi cho khách.",
        });
      } else {
        downloadImageBlob(blob, `${quotationCode}.png`);
        toast.info("Trình duyệt không hỗ trợ sao chép ảnh vào clipboard — đã tải ảnh PNG về máy.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tạo được ảnh báo giá.");
    } finally {
      setBusy(false);
    }
  }

  function handleExportBoth() {
    // Gọi onExportPdf() đồng bộ ngay trong sự kiện click — window.open/print()
    // cần user-gesture còn nguyên vẹn, nếu đợi sau 1 await trình duyệt có thể
    // chặn như popup. Việc chụp/copy ảnh chạy tiếp ngay sau đó.
    onExportPdf();
    void runCaptureAndDeliver();
  }

  return (
    <div className="inline-flex">
      <Button
        variant="outline"
        className="rounded-r-none"
        disabled={busy}
        onClick={() => void runCaptureAndDeliver()}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
        Sao chép ảnh báo giá
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="rounded-l-none border-l-0"
              disabled={busy}
              aria-label="Thêm lựa chọn xuất báo giá"
            />
          }
        >
          <ChevronDown className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onExportPdf}>
            <FileDown />
            Xuất PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportBoth}>
            <Layers />
            Xuất cả PDF và ảnh
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
