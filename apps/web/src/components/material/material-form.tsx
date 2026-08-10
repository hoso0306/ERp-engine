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

interface Unit {
  id: string;
  name: string;
}

interface ProductionCenterOption {
  id: string;
  name: string;
}

// <input type="number"> chỉ nhận dấu chấm thập phân, chặn/bỏ qua dấu phẩy
// tuỳ trình duyệt — người Việt hay gõ dấu phẩy (vd "1,5"). Dùng type="text" +
// tự chuẩn hoá dấu phẩy thành dấu chấm cho 2 ô Giá bán lẻ/Hệ số quy đổi.
function normalizeDecimalInput(raw: string): string {
  let v = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  return v;
}

export function MaterialForm() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [centers, setCenters] = useState<ProductionCenterOption[]>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025).
  const [isRetailable, setIsRetailable] = useState(false);
  const [retailUnitId, setRetailUnitId] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [retailConversionFactor, setRetailConversionFactor] = useState("");
  // Giá theo đơn vị gốc, "đóng băng" tại thời điểm đổi sang đơn vị bán lẻ khác
  // đơn vị gốc — dùng làm gốc quy đổi mỗi khi hệ số/đơn vị bán lẻ đổi tiếp,
  // để tránh nhân dồn (compounding) qua nhiều lần đổi hệ số liên tiếp.
  const [basePrice, setBasePrice] = useState("");

  // Gợi ý giá bán lẻ (chốt 2026-08-10): giá gốc × hệ số quy đổi, tự tính lại
  // mỗi khi đổi đơn vị bán lẻ hoặc sửa hệ số — vẫn cho sửa tay sau đó.
  function suggestRetailPrice(base: string, factor: string) {
    const b = Number(base);
    const f = Number(factor);
    if (!base || !factor || Number.isNaN(b) || Number.isNaN(f) || f <= 0) return;
    setRetailPrice(String(Math.round(b * f)));
  }

  function onRetailUnitChange(newUnitId: string) {
    if (newUnitId !== unitId && retailUnitId === unitId) {
      setBasePrice(retailPrice);
      suggestRetailPrice(retailPrice, retailConversionFactor);
    } else if (newUnitId === unitId) {
      setBasePrice(retailPrice);
    }
    setRetailUnitId(newUnitId);
  }

  function onRetailConversionFactorChange(value: string) {
    setRetailConversionFactor(value);
    if (retailUnitId && retailUnitId !== unitId) {
      suggestRetailPrice(basePrice, value);
    }
  }

  useEffect(() => {
    apiGet<Unit[]>("/units").then(setUnits).catch(() => {});
    apiGet<ProductionCenterOption[]>("/production-centers").then(setCenters).catch(() => {});
  }, []);

  function toggleCenter(id: string) {
    setSelectedCenterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      unitId,
    };

    const note = form.get("note");
    if (note && String(note).trim()) body.note = String(note).trim();

    if (retailPrice.trim()) body.retailPrice = Number(retailPrice);

    const minimumStock = form.get("minimumStock");
    if (minimumStock && String(minimumStock).trim()) body.minimumStock = Number(minimumStock);

    if (selectedCenterIds.length > 0) body.productionCenterIds = selectedCenterIds;

    body.isRetailable = isRetailable;
    if (isRetailable) {
      if (retailUnitId && retailUnitId !== unitId) {
        body.retailUnitId = retailUnitId;
        if (retailConversionFactor.trim()) {
          body.retailConversionFactor = Number(retailConversionFactor);
        }
      }
      const retailVatRate = form.get("retailVatRate");
      if (retailVatRate && String(retailVatRate).trim()) {
        body.retailVatRate = Number(retailVatRate);
      }
    }

    try {
      await apiPost("/materials", body);
      toast.success("Tạo vật tư thành công.");
      router.push("/materials");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tạo vật tư.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin vật tư</legend>

        <div className="space-y-2">
          <Label htmlFor="name">Tên vật tư *</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="space-y-2">
          <Label>Đơn vị tính *</Label>
          <Select value={unitId} onValueChange={(v) => setUnitId(v ?? "")} required>
            <SelectTrigger className="w-64">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="retailPrice">
              Giá bán lẻ (₫){" "}
              {!isRetailable && <span className="text-muted-foreground">(tuỳ chọn)</span>}
            </Label>
            <Input
              id="retailPrice"
              name="retailPrice"
              type="text"
              inputMode="decimal"
              required={isRetailable}
              value={retailPrice}
              onChange={(e) => {
                const v = normalizeDecimalInput(e.target.value);
                setRetailPrice(v);
                if (!retailUnitId || retailUnitId === unitId) setBasePrice(v);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Dùng khi bán lẻ vật tư. Giá vốn sản xuất vẫn tính theo giá nhập.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumStock">
              Tồn kho tối thiểu <span className="text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input id="minimumStock" name="minimumStock" type="number" min="0" step="any" />
            <p className="text-xs text-muted-foreground">
              Tồn kho dưới mức này sẽ hiện cảnh báo.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isRetailable}
              onChange={(e) => setIsRetailable(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Cho phép bán lẻ (hiện trong nút &quot;Thêm vật tư&quot; ở Báo giá)
          </label>

          {isRetailable && (
            <div className="grid grid-cols-2 gap-4 pl-6">
              <div className="space-y-2">
                <Label>
                  Đơn vị bán lẻ <span className="text-muted-foreground">(mặc định = đơn vị gốc)</span>
                </Label>
                <Select value={retailUnitId || unitId} onValueChange={(v) => onRetailUnitChange(v ?? "")}>
                  <SelectTrigger className="w-56">
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
              {retailUnitId && retailUnitId !== unitId && (
                <div className="space-y-2">
                  <Label htmlFor="retailConversionFactor">Hệ số quy đổi *</Label>
                  <Input
                    id="retailConversionFactor"
                    name="retailConversionFactor"
                    type="text"
                    inputMode="decimal"
                    required
                    value={retailConversionFactor}
                    onChange={(e) => onRetailConversionFactorChange(normalizeDecimalInput(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 đơn vị bán lẻ = bao nhiêu đơn vị gốc (vd nhôm: 1 mét = 0,35 kg). Giá bán lẻ sẽ
                    tự tính lại = giá theo đơn vị gốc × hệ số này, vẫn sửa tay được sau đó.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="retailVatRate">
                  % VAT bán lẻ <span className="text-muted-foreground">(mặc định 10%)</span>
                </Label>
                <Input
                  id="retailVatRate"
                  name="retailVatRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue="10"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Xưởng sản xuất sử dụng <span className="text-muted-foreground">(để lọc, chọn nhiều)</span>
          </Label>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border p-3">
            {centers.length === 0 && (
              <span className="text-sm text-muted-foreground">Chưa có xưởng nào.</span>
            )}
            {centers.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCenterIds.includes(c.id)}
                  onChange={() => toggleCenter(c.id)}
                  className="h-4 w-4 accent-primary"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Ghi chú</Label>
          <Textarea id="note" name="note" rows={3} />
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">
        Mã vật tư sẽ được tạo tự động (NL000001, NL000002, ...).
      </p>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting || !unitId}>
          {submitting ? "Đang lưu..." : "Tạo vật tư"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/materials")}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
