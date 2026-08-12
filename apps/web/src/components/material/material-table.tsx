"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/shared";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, ApiError } from "@/lib/api";

interface Material {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  unitId: string;
  unit: { id: string; name: string } | null;
  currentStock: number | string;
  minimumStock: number | string | null;
  retailPrice: number | string | null;
  // Giá nhập mặc định — API list trả 1 phần tử isDefault mới nhất.
  prices?: { price: number | string }[];
  productionCenters?: { productionCenter: { id: string; name: string } }[];
  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025).
  isRetailable?: boolean;
  retailUnitId?: string | null;
  retailConversionFactor?: number | string | null;
  retailVatRate?: number | string | null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MaterialTableProps {
  materials: Material[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Bật/tắt "Cho phép bán lẻ" ngay trong bảng (chốt 28/07/2026) — sau khi đổi
  // thành công gọi lại để load lại danh sách.
  onRefresh: () => void;
}

interface Unit {
  id: string;
  name: string;
}

interface ProductionCenterOption {
  id: string;
  name: string;
}

// Dialog xác nhận + cấu hình nhanh khi bật/tắt "Cho phép bán lẻ" ngay trong
// bảng danh sách — cùng field như form Chỉnh sửa vật tư (material-edit-form.tsx),
// chỉ rút gọn cho thao tác nhanh tại chỗ.
function RetailEnableDialog({
  material,
  open,
  onOpenChange,
  onDone,
}: {
  material: Material | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [retailUnitId, setRetailUnitId] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [retailConversionFactor, setRetailConversionFactor] = useState("");
  const [retailVatRate, setRetailVatRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !material) return;
    apiGet<Unit[]>("/units").then(setUnits).catch(() => {});
    // Prefill từ dữ liệu đã có sẵn trên vật tư (vd đã nhập retailPrice từ
    // trước nhưng chưa bật isRetailable) — không bắt nhập lại từ đầu. Đặt
    // trong setTimeout để tránh cascading render (set-state-in-effect).
    const timer = setTimeout(() => {
      setRetailUnitId(material.retailUnitId || material.unitId);
      setRetailPrice(material.retailPrice !== null ? String(Number(material.retailPrice)) : "");
      setRetailConversionFactor(
        material.retailConversionFactor !== null && material.retailConversionFactor !== undefined
          ? String(Number(material.retailConversionFactor))
          : "",
      );
      // Mặc định 10% (chốt 28/07/2026) nếu vật tư chưa từng cấu hình VAT bán
      // lẻ (giá trị 0 — mặc định DB trước migration này) — giữ nguyên nếu đã
      // có mức khác 0 (người dùng đã tự sửa từ trước).
      const existingVat =
        material.retailVatRate !== null && material.retailVatRate !== undefined
          ? Number(material.retailVatRate)
          : 0;
      setRetailVatRate(existingVat > 0 ? String(existingVat) : "10");
    }, 0);
    return () => clearTimeout(timer);
  }, [open, material]);

  if (!material) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!retailPrice.trim() || Number(retailPrice) <= 0) {
      toast.error("Giá bán lẻ phải lớn hơn 0.");
      return;
    }
    const needsFactor = retailUnitId !== material!.unitId;
    if (needsFactor && (!retailConversionFactor.trim() || Number(retailConversionFactor) <= 0)) {
      toast.error("Đơn vị bán lẻ khác đơn vị gốc thì phải nhập hệ số quy đổi lớn hơn 0.");
      return;
    }
    setSubmitting(true);
    try {
      await apiPatch(`/materials/${material!.id}`, {
        isRetailable: true,
        retailPrice: Number(retailPrice),
        retailUnitId: needsFactor ? retailUnitId : null,
        retailConversionFactor: needsFactor ? Number(retailConversionFactor) : null,
        retailVatRate: retailVatRate.trim() ? Number(retailVatRate) : 0,
      });
      toast.success("Đã bật cho phép bán lẻ.");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật vật tư.");
    } finally {
      setSubmitting(false);
    }
  }

  const showFactor = retailUnitId && retailUnitId !== material.unitId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cho phép bán lẻ — {material.name}</DialogTitle>
        </DialogHeader>
        <form id="retail-enable-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="retail-enable-price">Giá bán lẻ (₫) *</Label>
            <Input
              id="retail-enable-price"
              type="number"
              min="0"
              value={retailPrice}
              onChange={(e) => setRetailPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>
              Đơn vị bán lẻ <span className="text-muted-foreground">(mặc định = đơn vị gốc)</span>
            </Label>
            <Select value={retailUnitId} onValueChange={(v) => setRetailUnitId(v ?? "")}>
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
          {showFactor && (
            <div className="space-y-2">
              <Label htmlFor="retail-enable-factor">Hệ số quy đổi *</Label>
              <Input
                id="retail-enable-factor"
                type="number"
                min="0"
                step="any"
                value={retailConversionFactor}
                onChange={(e) => setRetailConversionFactor(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                1 đơn vị bán lẻ = bao nhiêu đơn vị gốc (vd nhôm: 1 mét = 0,35 kg).
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="retail-enable-vat">
              % VAT bán lẻ <span className="text-muted-foreground">(mặc định 10%)</span>
            </Label>
            <Input
              id="retail-enable-vat"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={retailVatRate}
              onChange={(e) => setRetailVatRate(e.target.value)}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="retail-enable-form" disabled={submitting}>
            {submitting ? "Đang lưu..." : "Bật bán lẻ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Popover chọn nhanh Xưởng ngay tại bảng danh sách — cùng logic thay toàn bộ
// danh sách (productionCenterIds) như form Sửa vật tư, chỉ rút gọn UI để
// không phải mở trang chi tiết/sửa cho thao tác đổi xưởng đơn giản.
function ProductionCenterQuickEdit({
  material,
  allCenters,
  onSaved,
}: {
  material: Material;
  allCenters: ProductionCenterOption[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setSelectedIds((material.productionCenters ?? []).map((pc) => pc.productionCenter.id));
    }, 0);
    return () => clearTimeout(timer);
  }, [open, material.productionCenters]);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSave() {
    setSaving(true);
    try {
      await apiPatch(`/materials/${material.id}`, { productionCenterIds: selectedIds });
      toast.success("Đã cập nhật xưởng.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật xưởng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
            aria-label="Đổi xưởng"
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent className="w-64 space-y-3">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">XƯỞNG SẢN XUẤT</div>
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {allCenters.length === 0 && (
            <span className="text-sm text-muted-foreground">Chưa có xưởng nào.</span>
          )}
          {allCenters.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="h-4 w-4 accent-primary"
              />
              {c.name}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MaterialTable({ materials, meta, onPageChange, onRefresh }: MaterialTableProps) {
  const router = useRouter();
  const [enableTarget, setEnableTarget] = useState<Material | null>(null);
  const [disableTarget, setDisableTarget] = useState<Material | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [allCenters, setAllCenters] = useState<ProductionCenterOption[]>([]);

  useEffect(() => {
    apiGet<ProductionCenterOption[]>("/production-centers").then(setAllCenters).catch(() => {});
  }, []);

  function onToggle(m: Material) {
    if (m.isRetailable) {
      setDisableTarget(m);
    } else {
      setEnableTarget(m);
    }
  }

  async function confirmDisable() {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await apiPatch(`/materials/${disableTarget.id}`, { isRetailable: false });
      toast.success("Đã tắt cho phép bán lẻ.");
      setDisableTarget(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật vật tư.");
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã VT</TableHead>
              <TableHead>Tên vật tư</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead className="text-right">Giá nhập</TableHead>
              <TableHead className="text-right">Giá bán lẻ</TableHead>
              <TableHead className="text-right">Tồn kho</TableHead>
              <TableHead className="text-center">Cho phép bán lẻ</TableHead>
              <TableHead>Xưởng</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => {
              return (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => router.push(`/materials/${m.id}`)}
              >
                <TableCell className="font-mono text-xs">{m.code}</TableCell>
                <TableCell className="max-w-64 truncate font-medium" title={m.name}>
                  {m.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.unit?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {m.prices && m.prices.length > 0 ? formatMoney(Number(m.prices[0].price)) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {m.retailPrice !== null ? formatMoney(Number(m.retailPrice)) : "—"}
                </TableCell>
                {/* Module Kho tạm gỡ khỏi triển khai (18/07/2026 — warehouse.md
                    "Trạng thái triển khai"): tồn kho để trống, không cảnh báo
                    "Dưới mức" vì không còn nghiệp vụ nhập/xuất cập nhật số này. */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!!m.isRetailable}
                    onCheckedChange={() => onToggle(m)}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-1">
                    {(m.productionCenters ?? []).length > 0
                      ? (m.productionCenters ?? []).map((pc) => (
                          <Badge key={pc.productionCenter.id} variant="secondary" className="text-[10px]">
                            {pc.productionCenter.name}
                          </Badge>
                        ))
                      : <span className="text-muted-foreground text-sm">—</span>}
                    <ProductionCenterQuickEdit material={m} allCenters={allCenters} onSaved={onRefresh} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={m.isActive ? "default" : "secondary"}>
                    {m.isActive ? "Đang dùng" : "Ngừng dùng"}
                  </Badge>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {materials.length} / {meta.total} vật tư
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <RetailEnableDialog
        material={enableTarget}
        open={enableTarget !== null}
        onOpenChange={(open) => { if (!open) setEnableTarget(null); }}
        onDone={onRefresh}
      />

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => { if (!open) setDisableTarget(null); }}
        title="Tắt cho phép bán lẻ"
        description={`Vật tư "${disableTarget?.name ?? ""}" sẽ không còn xuất hiện ở nút "Thêm vật tư" trong Báo giá. Xác nhận tắt?`}
        variant="destructive"
        confirmLabel={disabling ? "Đang lưu..." : "Xác nhận"}
        onConfirm={confirmDisable}
      />
    </div>
  );
}
