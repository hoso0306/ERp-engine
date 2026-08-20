"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { ConfirmDialog, Pagination } from "@/components/shared";
import { toast } from "sonner";
import { apiPatch, ApiError } from "@/lib/api";

interface Product {
  id: string;
  code: string;
  name: string;
  productType: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  deletedAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProductDeletedTableProps {
  products: Product[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
  onRestored: () => void;
}

export function ProductDeletedTable({
  products,
  meta,
  onPageChange,
  onLimitChange,
  onRestored,
}: ProductDeletedTableProps) {
  const [restoreTarget, setRestoreTarget] = useState<Product | null>(null);

  async function handleRestore() {
    if (!restoreTarget) return;
    try {
      await apiPatch(`/products/${restoreTarget.id}/restore`);
      toast.success("Đã khôi phục sản phẩm.");
      onRestored();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể khôi phục sản phẩm.");
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã SP</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Loại sản phẩm</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Ngày xoá</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.productType?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.unit?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(p.deletedAt).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRestoreTarget(p)}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Khôi phục
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {products.length} / {meta.total} sản phẩm đã xoá
        </p>
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={onPageChange}
          limit={onLimitChange ? meta.limit : undefined}
          onLimitChange={onLimitChange}
        />
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Khôi phục sản phẩm"
        description={`Bạn có chắc muốn khôi phục "${restoreTarget?.name}" (${restoreTarget?.code})?`}
        confirmLabel="Khôi phục"
        onConfirm={handleRestore}
      />
    </>
  );
}
