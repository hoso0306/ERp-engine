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
import { Pencil, Trash2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import { CustomerProductDiscountDialog } from "./customer-product-discount-dialog";
import { toast } from "sonner";
import { apiDelete, ApiError } from "@/lib/api";

interface CustomerProductDiscount {
  id: string;
  discountPercent: number;
  product: { id: string; code: string; name: string };
}

interface CustomerProductDiscountListProps {
  customerId: string;
  discounts: CustomerProductDiscount[];
  onChanged: () => void;
}

// Card "Chiết khấu sản phẩm" trên trang chi tiết khách hàng (Sprint 04, chốt
// 16/07/2026) — THAY THẾ CK nhóm, cấu hình riêng khách × sản phẩm.
export function CustomerProductDiscountList({
  customerId,
  discounts,
  onChanged,
}: CustomerProductDiscountListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerProductDiscount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerProductDiscount | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/customers/${customerId}/product-discounts/${deleteTarget.id}`);
      toast.success("Đã xoá chiết khấu.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá chiết khấu.");
    }
  }

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Chiết khấu sản phẩm</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm chiết khấu
        </Button>
      </div>

      {discounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa cấu hình chiết khấu cho sản phẩm nào.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã SP</TableHead>
                <TableHead>Tên sản phẩm</TableHead>
                <TableHead className="text-right">Chiết khấu</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {d.product.code}
                  </TableCell>
                  <TableCell className="font-medium">{d.product.name}</TableCell>
                  <TableCell className="text-right">{Number(d.discountPercent)}%</TableCell>
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

      <CustomerProductDiscountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        customerId={customerId}
        onSaved={onChanged}
      />

      <CustomerProductDiscountDialog
        key={editTarget?.id}
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        customerId={customerId}
        discount={editTarget}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá chiết khấu"
        description={`Bạn có chắc muốn xoá chiết khấu cho sản phẩm "${deleteTarget?.product.name}"?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
