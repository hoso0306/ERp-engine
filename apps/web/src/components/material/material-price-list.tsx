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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import { MaterialPriceDialog } from "./material-price-dialog";
import { toast } from "sonner";
import { apiDelete, ApiError } from "@/lib/api";

interface MaterialPrice {
  id: string;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  note: string | null;
}

interface MaterialPriceListProps {
  materialId: string;
  prices: MaterialPrice[];
  onChanged: () => void;
}

export function MaterialPriceList({ materialId, prices, onChanged }: MaterialPriceListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MaterialPrice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialPrice | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/materials/${materialId}/prices/${deleteTarget.id}`);
      toast.success("Đã xoá giá.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá giá.");
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("vi-VN");
  }

  function formatMoney(amount: number) {
    return amount.toLocaleString("vi-VN") + " đ";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Lịch sử giá</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm giá
        </Button>
      </div>

      {prices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có giá nào được thêm.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Giá mua</TableHead>
                <TableHead>Hiệu lực từ</TableHead>
                <TableHead>Hết hiệu lực</TableHead>
                <TableHead className="text-center">Mặc định</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{formatMoney(p.price)}</TableCell>
                  <TableCell>{formatDate(p.effectiveFrom)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.effectiveTo ? formatDate(p.effectiveTo) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.isDefault ? (
                      <Badge variant="default">Mặc định</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {p.note || "—"}
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

      <MaterialPriceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        materialId={materialId}
        onSaved={onChanged}
      />

      <MaterialPriceDialog
        key={editTarget?.id}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        materialId={materialId}
        price={editTarget}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá giá vật tư"
        description={`Bạn có chắc muốn xoá mức giá ${deleteTarget ? (deleteTarget.price).toLocaleString("vi-VN") + " đ" : ""}?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
