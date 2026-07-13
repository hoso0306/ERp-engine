"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiPatch, ApiError } from "@/lib/api";

interface EnumParameter {
  name: string;
  label: string;
  type: string;
  usedInPricing: boolean;
  options: { value: string; label: string | null }[];
}

export interface PriceMatrixRow {
  dimensions: Record<string, string>;
  unitPrice: number;
}

/**
 * Bảng giá ma trận (Sprint 03 Task 10) — hàng = tổ hợp mọi giá trị của các
 * tham số ENUM dùng cho báo giá (tích Descartes), cột = đơn giá/m². Nhìn như
 * Excel, nhập trực tiếp. Lưu bulk-replace qua PATCH .../matrix.
 */
export function PriceMatrixEditor({
  productId,
  versionId,
  parameters,
  matrixRows,
  isDraft,
  onSaved,
}: {
  productId: string;
  versionId: string;
  parameters: EnumParameter[];
  matrixRows: PriceMatrixRow[];
  isDraft: boolean;
  onSaved: () => void;
}) {
  const enumParams = useMemo(
    () => parameters.filter((p) => p.type === "ENUM" && p.usedInPricing && p.options.length > 0),
    [parameters],
  );

  const combos = useMemo(() => {
    if (enumParams.length === 0) return [];
    let rows: Record<string, string>[] = [{}];
    for (const param of enumParams) {
      const next: Record<string, string>[] = [];
      for (const row of rows) {
        for (const opt of param.options) {
          next.push({ ...row, [param.name]: opt.value });
        }
      }
      rows = next;
    }
    return rows;
  }, [enumParams]);

  const [prices, setPrices] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<number, string> = {};
    combos.forEach((combo, idx) => {
      const match = matrixRows.find((r) =>
        enumParams.every((p) => r.dimensions[p.name] === combo[p.name]),
      );
      if (match) next[idx] = String(match.unitPrice);
    });
    setPrices(next);
  }, [combos, matrixRows, enumParams]);

  function optionLabel(param: EnumParameter, value: string): string {
    return param.options.find((o) => o.value === value)?.label ?? value;
  }

  async function handleSave() {
    const rows = combos
      .map((combo, idx) => ({ dimensions: combo, unitPrice: Number(prices[idx] || 0) }))
      .filter((r) => r.unitPrice > 0);

    setSaving(true);
    try {
      await apiPatch(`/products/${productId}/pricing-rule/versions/${versionId}/matrix`, { rows });
      toast.success("Đã lưu bảng giá.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu bảng giá.");
    } finally {
      setSaving(false);
    }
  }

  if (enumParams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sản phẩm chưa có thông số kiểu ENUM (màu, kiểu mở...) dùng cho báo giá — chưa thể tạo Bảng giá ma
        trận. Có thể dùng Expression bên trên làm cách tính giá tạm thời.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border max-h-[28rem] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {enumParams.map((p) => (
                <TableHead key={p.name}>{p.label}</TableHead>
              ))}
              <TableHead className="w-48">Đơn giá (đ/m²)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map((combo, idx) => (
              <TableRow key={idx}>
                {enumParams.map((p) => (
                  <TableCell key={p.name} className="text-sm">
                    {optionLabel(p, combo[p.name])}
                  </TableCell>
                ))}
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step="1000"
                    value={prices[idx] ?? ""}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    placeholder="Chưa có giá"
                    disabled={!isDraft}
                    className="font-mono"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isDraft && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu bảng giá"}
          </Button>
        </div>
      )}
    </div>
  );
}
