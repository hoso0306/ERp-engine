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

interface Unit {
  id: string;
  name: string;
}

interface ProductionCenterOption {
  id: string;
  name: string;
}

export function MaterialForm() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [centers, setCenters] = useState<ProductionCenterOption[]>([]);
  const [selectedCenterIds, setSelectedCenterIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/units`)
      .then((r) => r.json())
      .then(setUnits)
      .catch(() => {});
    fetch(`${API_URL}/api/production-centers`)
      .then((r) => r.json())
      .then(setCenters)
      .catch(() => {});
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

    const retailPrice = form.get("retailPrice");
    if (retailPrice && String(retailPrice).trim()) body.retailPrice = Number(retailPrice);

    const minimumStock = form.get("minimumStock");
    if (minimumStock && String(minimumStock).trim()) body.minimumStock = Number(minimumStock);

    if (selectedCenterIds.length > 0) body.productionCenterIds = selectedCenterIds;

    try {
      const res = await fetch(`${API_URL}/api/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể tạo vật tư.");
        return;
      }

      toast.success("Tạo vật tư thành công.");
      router.push("/materials");
    } catch {
      toast.error("Lỗi kết nối server.");
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
              Giá bán lẻ (₫) <span className="text-muted-foreground">(tuỳ chọn)</span>
            </Label>
            <Input id="retailPrice" name="retailPrice" type="number" min="0" step="1000" />
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
