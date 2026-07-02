"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Option {
  id: string;
  name: string;
}

interface ProductionCenterOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface ProductData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productTypeId: string;
  unitId: string;
  productionCenterId: string | null;
  status: string;
}

interface ProductEditFormProps {
  product: ProductData;
}

export function ProductEditForm({ product }: ProductEditFormProps) {
  const router = useRouter();
  const [productTypes, setProductTypes] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [productionCenters, setProductionCenters] = useState<ProductionCenterOption[]>([]);
  const [productTypeId, setProductTypeId] = useState(product.productTypeId);
  const [unitId, setUnitId] = useState(product.unitId);
  const [productionCenterId, setProductionCenterId] = useState(product.productionCenterId ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/product-types`)
      .then((r) => r.json())
      .then(setProductTypes)
      .catch(() => {});
    fetch(`${API_URL}/api/units`)
      .then((r) => r.json())
      .then(setUnits)
      .catch(() => {});
    fetch(`${API_URL}/api/production-centers`)
      .then((r) => r.json())
      .then(setProductionCenters)
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      productTypeId,
      unitId,
      productionCenterId: productionCenterId || undefined,
      description: form.get("description") || null,
    };

    try {
      const res = await fetch(`${API_URL}/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể cập nhật sản phẩm.");
        return;
      }

      toast.success("Cập nhật thành công.");
      router.push(`/products/${product.id}`);
      router.refresh();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin sản phẩm</legend>

        <div className="space-y-2">
          <Label>Mã sản phẩm</Label>
          <Input value={product.code} disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Tên sản phẩm *</Label>
          <Input id="name" name="name" defaultValue={product.name} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Loại sản phẩm *</Label>
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
          </div>
          <div className="space-y-2">
            <Label>Đơn vị tính *</Label>
            <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn đơn vị" />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Xưởng sản xuất *</Label>
          <Select value={productionCenterId} onValueChange={(v) => setProductionCenterId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn xưởng sản xuất" />
            </SelectTrigger>
            <SelectContent>
              {productionCenters.filter((c) => c.isActive).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={product.description ?? ""}
          />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/products/${product.id}`)}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
