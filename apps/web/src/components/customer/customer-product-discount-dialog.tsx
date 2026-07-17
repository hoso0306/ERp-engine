"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductTypeahead, ProductOption } from "@/components/quotation/product-typeahead";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";

interface CustomerProductDiscount {
  id: string;
  discountPercent: number;
  product: ProductOption;
}

interface CustomerProductDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  discount?: CustomerProductDiscount | null;
  onSaved: () => void;
}

// Thêm/sửa % chiết khấu cho 1 sản phẩm của khách hàng (Sprint 04, chốt
// 16/07/2026) — sản phẩm chỉ chọn được khi thêm mới, không đổi khi sửa.
export function CustomerProductDiscountDialog({
  open,
  onOpenChange,
  customerId,
  discount,
  onSaved,
}: CustomerProductDiscountDialogProps) {
  const isEdit = !!discount;
  const [submitting, setSubmitting] = useState(false);
  const [product, setProduct] = useState<ProductOption | null>(discount?.product ?? null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isEdit && !product) {
      toast.error("Vui lòng chọn sản phẩm.");
      return;
    }

    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const discountPercent = Number(form.get("discountPercent"));

    try {
      if (isEdit) {
        await apiPatch(`/customers/${customerId}/product-discounts/${discount.id}`, {
          discountPercent,
        });
      } else {
        await apiPost(`/customers/${customerId}/product-discounts`, {
          productId: product!.id,
          discountPercent,
        });
      }

      toast.success(isEdit ? "Cập nhật chiết khấu thành công." : "Thêm chiết khấu thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu chiết khấu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa chiết khấu" : "Thêm chiết khấu sản phẩm"}</DialogTitle>
        </DialogHeader>

        <form id="customer-product-discount-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Sản phẩm *</Label>
            {isEdit ? (
              <div className="rounded-lg border px-3 py-2 text-sm">
                <span className="font-mono text-muted-foreground">{discount.product.code}</span>
                <span className="ml-2 font-medium">{discount.product.name}</span>
              </div>
            ) : (
              <ProductTypeahead value={product} onChange={setProduct} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discountPercent">Chiết khấu (%) *</Label>
            <Input
              id="discountPercent"
              name="discountPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              defaultValue={discount?.discountPercent ?? 0}
              required
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="customer-product-discount-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm chiết khấu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
