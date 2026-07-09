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

export function MaterialForm() {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/units`)
      .then((r) => r.json())
      .then(setUnits)
      .catch(() => {});
  }, []);

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
