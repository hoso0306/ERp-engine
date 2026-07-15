"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Copy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import {
  MaterialRequirementItemDialog,
  type MaterialRequirementItem,
} from "@/components/product/material-requirement-item-dialog";
import { ExcelImportDialog } from "@/components/product/excel-import-dialog";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api";

interface ImportedMaterialRequirementRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  expression: string;
  condition: string | null;
  wastePercent: number;
  roundStep: number | null;
  note: string | null;
}

interface ProductParameter {
  id: string;
  name: string;
  label: string;
  type: string;
  usedInMaterial: boolean;
  options: { value: string; label: string | null }[];
}

interface MaterialRequirementVersion {
  id: string;
  versionNumber: number;
  name: string | null;
  status: string;
  note: string | null;
  items: MaterialRequirementItem[];
  materialRequirement: { productId: string };
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Nháp", variant: "outline" },
  ACTIVE: { label: "Đang dùng", variant: "default" },
  ARCHIVED: { label: "Lưu trữ", variant: "secondary" },
};

export default function MaterialRequirementVersionPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<MaterialRequirementVersion | null>(null);
  const [parameters, setParameters] = useState<ProductParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaterialRequirementItem | null>(null);
  const [deleteItemOpen, setDeleteItemOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MaterialRequirementItem | null>(null);

  const [activating, setActivating] = useState(false);
  const [deleteVersionOpen, setDeleteVersionOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Preview state
  const [previewInputs, setPreviewInputs] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    inputParams: Record<string, number>;
    items: {
      materialCode: string;
      materialName: string;
      unit: { name: string } | null;
      expression: string;
      baseQty: number;
      wastePercent: number;
      wastedQty: number;
      roundStep: number | null;
      finalQty: number;
      unitPrice: number;
      itemCost: number;
    }[];
    totalCost: number;
  } | null>(null);

  const loadVersion = useCallback(async () => {
    try {
      const data = await apiGet<MaterialRequirementVersion>(
        `/products/${productId}/material-requirement/versions/${versionId}`,
      );
      setVersion(data);
      setName(data.name ?? "");
      setNote(data.note ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tìm thấy phiên bản.");
    } finally {
      setLoading(false);
    }
  }, [productId, versionId]);

  useEffect(() => {
    loadVersion();
    apiGet<ProductParameter[]>(`/products/${productId}/parameters`)
      .then((data) => setParameters(data))
      .catch(() => {});
  }, [productId, loadVersion]);

  const isDraft = version?.status === "DRAFT";
  const status = version ? (statusMap[version.status] ?? statusMap.DRAFT) : statusMap.DRAFT;

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await apiPatch<MaterialRequirementVersion>(
        `/products/${productId}/material-requirement/versions/${versionId}`,
        { name: name.trim() || null, note: note.trim() || null },
      );
      setVersion(updated);
      toast.success("Đã lưu.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const updated = await apiPatch<MaterialRequirementVersion>(
        `/products/${productId}/material-requirement/versions/${versionId}/activate`,
      );
      setVersion(updated);
      toast.success("Đã kích hoạt phiên bản.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể kích hoạt.");
    } finally {
      setActivating(false);
    }
  }

  async function handleDuplicate() {
    if (!version) return;
    setDuplicating(true);
    try {
      const newVersion = await apiPost<MaterialRequirementVersion>(
        `/products/${productId}/material-requirement/versions/${versionId}/duplicate`,
      );
      toast.success(
        `Đã tạo phiên bản Nháp mới (v${newVersion.versionNumber}) từ v${version.versionNumber}, tiếp tục chỉnh sửa tại đây.`,
      );
      router.push(`/products/${productId}/material-requirement/versions/${newVersion.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tạo phiên bản nháp.");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDeleteVersion() {
    try {
      await apiDelete(`/products/${productId}/material-requirement/versions/${versionId}`);
      toast.success("Đã xoá phiên bản.");
      router.push(`/products/${productId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá.");
    }
  }

  async function handleDeleteItem() {
    if (!deleteItemTarget) return;
    try {
      await apiDelete(
        `/products/${productId}/material-requirement/versions/${versionId}/items/${deleteItemTarget.id}`,
      );
      toast.success("Đã xoá Item.");
      loadVersion();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá Item.");
    }
  }

  async function handleApplyImport(rows: ImportedMaterialRequirementRow[]) {
    await apiPut(`/products/${productId}/material-requirement/versions/${versionId}/items`, {
      rows: rows.map(({ materialId, expression, condition, wastePercent, roundStep, note }) => ({
        materialId,
        expression,
        condition,
        wastePercent,
        roundStep,
        note,
      })),
    });
    toast.success(`Đã áp dụng ${rows.length} dòng từ Excel.`);
    loadVersion();
  }

  async function handlePreview() {
    const params: Record<string, number> = {};
    for (const [k, v] of Object.entries(previewInputs)) {
      const n = parseFloat(v);
      if (!isNaN(n)) params[k] = n;
    }

    setPreviewing(true);
    setPreviewResult(null);
    try {
      const result = await apiPost<NonNullable<typeof previewResult>>(
        `/products/${productId}/material-requirement/versions/${versionId}/preview`,
        params,
      );
      setPreviewResult(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tính định mức.");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !version) return <ErrorState description={error ?? "Không tìm thấy."} onRetry={loadVersion} />;

  const numberParams = parameters.filter((p) => p.type === "NUMBER" && p.usedInMaterial);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" render={<Link href={`/products/${productId}`} />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              Định mức vật liệu — v{version.versionNumber}
              {version.name ? ` (${version.name})` : ""}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft ? (
            <>
              <Button onClick={handleActivate} disabled={activating}>
                {activating ? "Đang kích hoạt..." : "Kích hoạt"}
              </Button>
              <Button variant="destructive" onClick={() => setDeleteVersionOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xoá
              </Button>
            </>
          ) : (
            <Button onClick={handleDuplicate} disabled={duplicating}>
              <Copy className="mr-2 h-4 w-4" />
              {duplicating ? "Đang tạo bản nháp..." : "Sửa"}
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Thông tin phiên bản</h2>
        <div className="space-y-2">
          <Label htmlFor="ver-name">Tên phiên bản</Label>
          <Input
            id="ver-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isDraft}
            placeholder="ví dụ: Định mức chuẩn 2025"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ver-note">Ghi chú</Label>
          <Textarea
            id="ver-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!isDraft}
            rows={3}
          />
        </div>

        {/* Available variables */}
        {parameters.filter((p) => p.usedInMaterial).length > 0 && (
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Biến có thể dùng trong Expression/Điều kiện:</p>
            <p className="font-mono">
              {parameters.filter((p) => p.usedInMaterial).map((p) => p.name).join(", ")}
            </p>
          </div>
        )}

        {isDraft && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Danh sách vật tư</h2>
          {isDraft && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1 h-4 w-4" />
                Nhập từ Excel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditItem(null);
                  setItemDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Thêm Item
              </Button>
            </div>
          )}
        </div>

        {version.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có Item nào.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vật tư</TableHead>
                  <TableHead>Expression</TableHead>
                  <TableHead>Điều kiện</TableHead>
                  <TableHead className="text-right w-24">Hao hụt (%)</TableHead>
                  <TableHead className="text-right w-28">Round Step</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  {isDraft && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {version.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.material.code}
                      </span>
                      <br />
                      <span className="text-sm">{item.material.name}</span>
                      {item.material.unit && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          ({item.material.unit.name})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate">
                      {item.expression}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">
                      {item.condition || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {Number(item.wastePercent) > 0 ? `${item.wastePercent}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {item.roundValue !== null ? item.roundValue : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.note || "—"}
                    </TableCell>
                    {isDraft && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditItem(item);
                              setItemDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setDeleteItemTarget(item);
                              setDeleteItemOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Preview định mức</h2>

        {numberParams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không có thông số NUMBER nào được đánh dấu "Dùng cho định mức".
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {numberParams.map((p) => (
                <div key={p.id} className="space-y-1">
                  <Label htmlFor={`preview-${p.name}`} className="text-xs">
                    {p.label}{" "}
                    <span className="font-mono text-muted-foreground">({p.name})</span>
                  </Label>
                  <Input
                    id={`preview-${p.name}`}
                    type="number"
                    step="any"
                    value={previewInputs[p.name] ?? ""}
                    onChange={(e) =>
                      setPreviewInputs((prev) => ({ ...prev, [p.name]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <Button onClick={handlePreview} disabled={previewing || version.items.length === 0}>
              {previewing ? "Đang tính..." : "Tính định mức"}
            </Button>

            {previewResult && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vật tư</TableHead>
                        <TableHead className="text-right">Số lượng gốc</TableHead>
                        <TableHead className="text-right">Sau hao hụt</TableHead>
                        <TableHead className="text-right">Sau làm tròn</TableHead>
                        <TableHead className="text-right">Đơn giá</TableHead>
                        <TableHead className="text-right">Thành tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <span className="text-sm">{item.materialName}</span>
                            {item.unit && (
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                ({item.unit.name})
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.baseQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.wastedQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {item.finalQty.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.unitPrice > 0
                              ? item.unitPrice.toLocaleString("vi-VN")
                              : <span className="text-muted-foreground">Chưa có giá</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.unitPrice > 0
                              ? item.itemCost.toLocaleString("vi-VN")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Tổng giá vốn</p>
                    <p className="text-2xl font-bold">
                      {previewResult.totalCost.toLocaleString("vi-VN")} ₫
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <MaterialRequirementItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        productId={productId}
        versionId={versionId}
        parameters={parameters}
        item={editItem}
        onSaved={loadVersion}
      />

      <ConfirmDialog
        open={deleteItemOpen}
        onOpenChange={setDeleteItemOpen}
        title="Xoá Item"
        description={`Xoá vật tư "${deleteItemTarget?.material.name}"?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDeleteItem}
      />

      <ConfirmDialog
        open={deleteVersionOpen}
        onOpenChange={setDeleteVersionOpen}
        title="Xoá phiên bản"
        description={`Xoá phiên bản v${version.versionNumber}? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDeleteVersion}
      />

      <ExcelImportDialog<ImportedMaterialRequirementRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Nhập Định mức vật liệu từ Excel"
        description="File Excel yêu cầu cấu trúc giống file mẫu bên dưới. Mã vật tư phải khớp vật tư có sẵn — không tự tạo mới. Vật tư có sẵn không có trong file sẽ được giữ nguyên (upsert)."
        templateUrl={`/products/${productId}/material-requirement/versions/${versionId}/items/template`}
        previewUrl={`/products/${productId}/material-requirement/versions/${versionId}/items/import-preview`}
        columns={[
          { header: "Mã vật tư", render: (row) => `${row.materialCode} — ${row.materialName}` },
          { header: "Expression", render: (row) => <span className="font-mono text-xs">{row.expression}</span> },
          { header: "Condition", render: (row) => <span className="font-mono text-xs">{row.condition || "—"}</span> },
          { header: "Hao hụt (%)", render: (row) => row.wastePercent },
          { header: "Round Step", render: (row) => row.roundStep ?? "—" },
        ]}
        onApply={handleApplyImport}
      />
    </div>
  );
}
