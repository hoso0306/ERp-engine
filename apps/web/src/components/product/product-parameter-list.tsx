"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import {
  ProductParameterDialog,
  type ProductParameter,
} from "./product-parameter-dialog";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ProductParameterListProps {
  productId: string;
}

const typeLabels: Record<string, string> = {
  NUMBER: "Số",
  TEXT: "Văn bản",
  ENUM: "Danh sách",
  BOOLEAN: "Có/Không",
};

export function ProductParameterList({ productId }: ProductParameterListProps) {
  const [parameters, setParameters] = useState<ProductParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductParameter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductParameter | null>(null);

  const fetchParameters = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/parameters`);
      if (!res.ok) return;
      const data = await res.json();
      setParameters(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchParameters();
  }, [fetchParameters]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `${API_URL}/api/products/${productId}/parameters/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể xoá thông số.");
        return;
      }
      toast.success("Đã xoá thông số.");
      fetchParameters();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Thông số sản phẩm</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm thông số
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : parameters.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có thông số nào.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">STT</TableHead>
                <TableHead>Tên biến</TableHead>
                <TableHead>Nhãn</TableHead>
                <TableHead>Kiểu</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead className="text-center">Bắt buộc</TableHead>
                <TableHead className="text-center">Báo giá</TableHead>
                <TableHead className="text-center">Định mức</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parameters.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{p.name}</TableCell>
                  <TableCell>{p.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabels[p.type] ?? p.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.unit || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.isRequired ? (
                      <Badge variant="default">Bắt buộc</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {p.usedInPricing ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {p.usedInMaterial ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditTarget(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductParameterDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        productId={productId}
        onSaved={fetchParameters}
      />

      <ProductParameterDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        productId={productId}
        parameter={editTarget}
        onSaved={fetchParameters}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá thông số"
        description={`Bạn có chắc muốn xoá thông số "${deleteTarget?.label}" (${deleteTarget?.name})?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
