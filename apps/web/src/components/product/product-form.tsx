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
import { apiGet, apiPost, ApiError } from "@/lib/api";

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

export function ProductForm() {
  const router = useRouter();
  const [productTypes, setProductTypes] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [productionCenters, setProductionCenters] = useState<ProductionCenterOption[]>([]);
  const [productTypeId, setProductTypeId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [productionCenterId, setProductionCenterId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<Option[]>("/product-types").then(setProductTypes).catch(() => {});
    apiGet<Option[]>("/units").then(setUnits).catch(() => {});
    apiGet<ProductionCenterOption[]>("/production-centers").then(setProductionCenters).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      productTypeId,
      unitId,
      productionCenterId,
    };

    const description = form.get("description");
    if (description && String(description).trim()) {
      body.description = String(description).trim();
    }

    try {
      await apiPost("/products", body);
      toast.success("Tạo sản phẩm thành công.");
      router.push("/products");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tạo sản phẩm.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin sản phẩm</legend>

        <div className="space-y-2">
          <Label htmlFor="name">Tên sản phẩm *</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Loại sản phẩm *</Label>
            <Select value={productTypeId} onValueChange={(v) => setProductTypeId(v ?? "")} required>
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
            <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")} required>
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
          <Select value={productionCenterId} onValueChange={(v) => setProductionCenterId(v ?? "")} required>
            <SelectTrigger>
              <SelectValue placeholder="Chọn xưởng sản xuất" />
            </SelectTrigger>
            <SelectContent>
              {productionCenters.filter((c) => c.isActive !== false).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Mô tả</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting || !productTypeId || !unitId || !productionCenterId}>
          {submitting ? "Đang lưu..." : "Tạo sản phẩm"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
