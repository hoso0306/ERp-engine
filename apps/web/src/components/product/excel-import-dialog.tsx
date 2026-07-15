"use client";

import { useRef, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiPost, apiUrl, ApiError } from "@/lib/api";

interface ImportError {
  row: number;
  message: string;
}

interface ExcelImportDialogColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface ExcelImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  templateUrl: string;
  previewUrl: string;
  columns: ExcelImportDialogColumn<T>[];
  onApply: (rows: T[]) => Promise<void>;
}

/**
 * Dialog Import Excel dùng chung cho Price Matrix + Material Requirement
 * (Sprint 03 Việc 2). Luồng: Đọc file → Preview (validate, KHÔNG ghi DB) →
 * chỉ cho Áp dụng khi 0 lỗi. Áp dụng tái dùng API ghi có sẵn của mỗi màn
 * hình (PATCH .../matrix hoặc PUT .../items) qua prop onApply.
 */
export function ExcelImportDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  templateUrl,
  previewUrl,
  columns,
  onApply,
}: ExcelImportDialogProps<T>) {
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [rows, setRows] = useState<T[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setErrors([]);
    setPreviewed(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel.");
      return;
    }

    setUploading(true);
    setPreviewed(false);
    setRows([]);
    setErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await apiPost<{ rows: T[]; errors: ImportError[] }>(previewUrl, formData);
      setRows(result.rows);
      setErrors(result.errors);
      setPreviewed(true);
      if (result.errors.length > 0) {
        toast.error(`File có ${result.errors.length} dòng lỗi — sửa hết mới áp dụng được.`);
      } else {
        toast.success(`Đọc được ${result.rows.length} dòng hợp lệ.`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể đọc file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(rows);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể áp dụng.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => window.open(apiUrl(templateUrl), "_blank")}
        >
          <Download className="mr-2 h-4 w-4" />
          Tải file mẫu (.xlsx)
        </Button>

        <div className="flex gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.xls" className="flex-1" />
          <Button variant="outline" onClick={handlePreview} disabled={uploading}>
            {uploading ? "Đang đọc..." : "Đọc file"}
          </Button>
        </div>

        {previewed && rows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.header}>{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col.header} className="text-sm">
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {errors.length > 0 && (
          <div className="max-h-40 overflow-auto rounded-md bg-red-50 p-3 text-sm dark:bg-red-900/20">
            {errors.map((err, i) => (
              <p key={i} className="text-red-700 dark:text-red-400">
                Dòng {err.row}: {err.message}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            onClick={handleApply}
            disabled={!previewed || errors.length > 0 || rows.length === 0 || applying}
          >
            {applying ? "Đang áp dụng..." : "Áp dụng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
