"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import {
  DerivedParameterDialog,
  type DerivedParameter,
} from "@/components/product/derived-parameter-dialog";

export function DerivedParameterSection({ productId }: { productId: string }) {
  const [items, setItems] = useState<DerivedParameter[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DerivedParameter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DerivedParameter | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await apiGet<DerivedParameter[]>(`/products/${productId}/derived-parameters`);
      setItems(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/products/${productId}/derived-parameters/${deleteTarget.id}`);
      toast.success("Đã xoá.");
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Biến phái sinh (dùng chung cho báo giá &amp; định mức vật tư)
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm biến
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có biến phái sinh nào.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên biến</TableHead>
                <TableHead>Công thức</TableHead>
                <TableHead className="w-20">Đơn vị</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {d.expression}
                  </TableCell>
                  <TableCell className="text-sm">{d.unit || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditTarget(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(d)}>
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

      <DerivedParameterDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        productId={productId}
        onSaved={loadData}
      />
      <DerivedParameterDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        productId={productId}
        item={editTarget}
        onSaved={loadData}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá biến phái sinh"
        description={`Xoá biến "${deleteTarget?.name}"?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
