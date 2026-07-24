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
import { Badge } from "@/components/ui/badge";
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
import { downloadAuthenticatedFile } from "@/lib/download";

interface ImportError {
  row: number;
  message: string;
}

interface ChangedField {
  label: string;
  newValue: string;
}

interface PreviewItem {
  row: number;
  action: "create" | "update";
  name: string;
  phone: string;
  changedFields: ChangedField[];
}

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, onImported }: CustomerImportDialogProps) {
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [previewed, setPreviewed] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [counts, setCounts] = useState({ toCreate: 0, toUpdate: 0 });
  const [errors, setErrors] = useState<ImportError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPreviewed(false);
    setItems([]);
    setCounts({ toCreate: 0, toUpdate: 0 });
    setErrors([]);
  }

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

  // Preview chạy đúng logic thật (validate + so khớp DB) nhưng không ghi DB
  // (chốt 24/07/2026) — để người dùng thấy trước chính xác dòng nào tạo
  // mới, dòng nào cập nhật kèm field nào sẽ được điền, trước khi xác nhận.
  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel.");
      return;
    }

    setPreviewing(true);
    reset();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await apiPost<{
        toCreate: number;
        toUpdate: number;
        errors: ImportError[];
        items: PreviewItem[];
      }>("/customers/import/preview", formData);

      setItems(result.items);
      setCounts({ toCreate: result.toCreate, toUpdate: result.toUpdate });
      setErrors(result.errors);
      setPreviewed(true);

      if (result.toCreate === 0 && result.toUpdate === 0) {
        toast.error("Không có dòng nào hợp lệ để import.");
      } else {
        toast.success(`Xem trước: tạo mới ${result.toCreate}, cập nhật ${result.toUpdate}.`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể đọc file.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirmImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Vui lòng chọn file Excel.");
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const json = await apiPost<{ created: number; updated: number; errors: ImportError[] }>(
        "/customers/import",
        formData,
      );

      const parts: string[] = [];
      if (json.created > 0) parts.push(`Tạo mới ${json.created}`);
      if (json.updated > 0) parts.push(`Cập nhật ${json.updated}`);
      const summary = parts.length > 0 ? parts.join(", ") : "Không có khách hàng nào được import";

      if (json.errors?.length > 0) {
        setErrors(json.errors);
        toast.error(`${summary}. Còn ${json.errors.length} dòng lỗi.`);
      } else {
        toast.success(`${summary}.`);
        onOpenChange(false);
        reset();
      }

      if (json.created > 0 || json.updated > 0) onImported();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
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
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import khách hàng từ Excel</DialogTitle>
          <DialogDescription>
            File Excel yêu cầu cấu trúc giống file mẫu bên dưới. Tải về, điền dữ liệu, xem trước rồi mới xác nhận import.
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

        <div className="flex gap-2">
          <Input ref={fileRef} type="file" accept=".xlsx,.xls" className="flex-1" onChange={reset} />
          <Button variant="outline" onClick={handlePreview} disabled={previewing}>
            {previewing ? "Đang đọc..." : "Xem trước"}
          </Button>
        </div>

        {previewed && items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sẽ tạo mới <strong className="text-foreground">{counts.toCreate}</strong> khách hàng, cập nhật{" "}
              <strong className="text-foreground">{counts.toUpdate}</strong> khách hàng đã có.
            </p>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Dòng</TableHead>
                    <TableHead className="w-28">Hành động</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead className="w-36">SĐT</TableHead>
                    <TableHead>Thay đổi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.row}>
                      <TableCell className="text-sm text-muted-foreground">{item.row}</TableCell>
                      <TableCell>
                        <Badge variant={item.action === "create" ? "default" : "secondary"}>
                          {item.action === "create" ? "Tạo mới" : "Cập nhật"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell className="text-sm">{item.phone}</TableCell>
                      <TableCell className="text-sm">
                        {item.action === "create"
                          ? "Khách mới — toàn bộ dữ liệu trong file"
                          : item.changedFields.length > 0
                            ? item.changedFields.map((f) => `${f.label}: ${f.newValue}`).join(", ")
                            : "Không có field nào thay đổi"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="max-h-48 overflow-auto rounded-md bg-red-50 p-3 text-sm dark:bg-red-900/20">
            {errors.map((err, i) => (
              <p key={i} className="text-red-700 dark:text-red-400">
                {err.row > 0 ? `Dòng ${err.row}: ` : ""}{err.message}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            onClick={handleConfirmImport}
            disabled={!previewed || (counts.toCreate === 0 && counts.toUpdate === 0) || submitting}
          >
            {submitting ? "Đang import..." : "Xác nhận Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
