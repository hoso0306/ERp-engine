"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

interface ProductTypeOption {
  id: string;
  name: string;
}

interface CustomerProductDiscount {
  id: string;
  discountPercent: number;
  productType: ProductTypeOption;
}

interface CustomerProductDiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  discount?: CustomerProductDiscount | null;
  onSaved: () => void;
}

// Thêm/sửa % chiết khấu cho 1 loại sản phẩm của khách hàng (Sprint 04, chốt
// 16/07/2026; đổi từ theo sản phẩm sang theo loại sản phẩm, chốt 24/07/2026)
// — loại sản phẩm chỉ chọn được khi thêm mới, không đổi khi sửa.
export function CustomerProductDiscountDialog({
  open,
  onOpenChange,
  customerId,
  discount,
  onSaved,
}: CustomerProductDiscountDialogProps) {
  const isEdit = !!discount;
  const [submitting, setSubmitting] = useState(false);
  const [productTypes, setProductTypes] = useState<ProductTypeOption[]>([]);
  const [productTypeId, setProductTypeId] = useState(discount?.productType.id ?? "");

  useEffect(() => {
    if (!open || isEdit) return;
    apiGet<ProductTypeOption[]>("/product-types").then(setProductTypes).catch(() => {});
  }, [open, isEdit]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isEdit && !productTypeId) {
      toast.error("Vui lòng chọn loại sản phẩm.");
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
          productTypeId,
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
          <DialogTitle>{isEdit ? "Chỉnh sửa chiết khấu" : "Thêm chiết khấu loại sản phẩm"}</DialogTitle>
        </DialogHeader>

        <form id="customer-product-discount-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Loại sản phẩm *</Label>
            {isEdit ? (
              <div className="rounded-lg border px-3 py-2 text-sm font-medium">
                {discount.productType.name}
              </div>
            ) : (
              <Select value={productTypeId} onValueChange={(v) => setProductTypeId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại sản phẩm" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
