"use client";

import { useState, useRef } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiPost, apiUrl, ApiError } from "@/lib/api";
import { downloadAuthenticatedFile } from "@/lib/download";

interface ImportError {
  row: number;
  message: string;
}

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, onImported }: CustomerImportDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      await downloadAuthenticatedFile(apiUrl("/customers/template"), "mau-import-khach-hang.xlsx");
    } catch {
      toast.error("Không thể tải file mẫu.");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel.");
      return;
    }

    setUploading(true);
    setErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const json = await apiPost<{ created: number; updated: number; errors: ImportError[] }>(
        "/customers/import",
        formData,
      );

      setErrors(json.errors ?? []);

      const parts: string[] = [];
      if (json.created > 0) parts.push(`Tạo mới ${json.created}`);
      if (json.updated > 0) parts.push(`Cập nhật ${json.updated}`);
      const summary = parts.length > 0 ? parts.join(", ") : "Không có khách hàng nào được import";

      if (json.errors?.length > 0) {
        toast.error(`${summary}. Còn ${json.errors.length} dòng lỗi bên dưới.`);
      } else {
        toast.success(`${summary}.`);
        onOpenChange(false);
      }

      if (json.created > 0 || json.updated > 0) onImported();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setErrors([]); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import khách hàng từ Excel</DialogTitle>
          <DialogDescription>
            File Excel yêu cầu cấu trúc giống file mẫu bên dưới. Hãy tải về và chỉnh sửa.
          </DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
        >
          <Download className="mr-2 h-4 w-4" />
          {downloadingTemplate ? "Đang tải..." : "Tải file mẫu (.xlsx)"}
        </Button>

        <Input ref={fileRef} type="file" accept=".xlsx,.xls" />

        {errors.length > 0 && (
          <div className="max-h-96 overflow-auto rounded-md bg-red-50 p-4 text-sm dark:bg-red-900/20">
            {errors.map((err, i) => (
              <p key={i} className="text-red-700 dark:text-red-400">
                {err.row > 0 ? `Dòng ${err.row}: ` : ""}{err.message}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleImport} disabled={uploading}>
            {uploading ? "Đang import..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
