"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PricingRuleItemDialog,
  type PricingRuleItem,
} from "@/components/product/pricing-rule-item-dialog";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, apiDelete, ApiError } from "@/lib/api";

interface ProductParameter {
  id: string;
  name: string;
  label: string;
  type: string;
  unit: string | null;
}

interface PricingRuleVersion {
  id: string;
  versionNumber: number;
  name: string | null;
  expression: string | null;
  priceRoundType: string;
  priceRoundValue: number | null;
  status: string;
  note: string | null;
  items: PricingRuleItem[];
  pricingRule: { productId: string };
}

interface PreviewResult {
  inputParams: Record<string, number>;
  adjustedParams: Record<string, number>;
  rawPrice: number;
  finalPrice: number;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Nháp", variant: "outline" },
  ACTIVE: { label: "Đang dùng", variant: "default" },
  ARCHIVED: { label: "Lưu trữ", variant: "secondary" },
};

const ruleTypeLabels: Record<string, string> = {
  MIN_AREA: "MIN_AREA",
  MIN_DIMENSION: "MIN_DIMENSION",
};

const roundTypeLabels: Record<string, string> = {
  NONE: "Không làm tròn",
  CEIL: "Làm tròn lên",
  FLOOR: "Làm tròn xuống",
  ROUND: "Làm tròn",
};

export default function PricingRuleVersionPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const versionId = params.versionId as string;

  const [version, setVersion] = useState<PricingRuleVersion | null>(null);
  const [parameters, setParameters] = useState<ProductParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state (for DRAFT editing)
  const [formName, setFormName] = useState("");
  const [formExpr, setFormExpr] = useState("");
  const [formRoundType, setFormRoundType] = useState("NONE");
  const [formRoundValue, setFormRoundValue] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  // Rule Item dialog
  const [itemAddOpen, setItemAddOpen] = useState(false);
  const [itemEditTarget, setItemEditTarget] = useState<PricingRuleItem | null>(null);
  const [itemDeleteTarget, setItemDeleteTarget] = useState<PricingRuleItem | null>(null);

  // Delete version dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Preview
  const [previewParams, setPreviewParams] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const loadVersion = useCallback(async () => {
    try {
      const data = await apiGet<PricingRuleVersion>(
        `/products/${productId}/pricing-rule/versions/${versionId}`,
      );
      setVersion(data);
      setFormName(data.name ?? "");
      setFormExpr(data.expression ?? "");
      setFormRoundType(data.priceRoundType);
      setFormRoundValue(data.priceRoundValue != null ? String(data.priceRoundValue) : "");
      setFormNote(data.note ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tìm thấy phiên bản.");
    } finally {
      setLoading(false);
    }
  }, [productId, versionId]);

  useEffect(() => {
    loadVersion();
    apiGet<ProductParameter[]>(`/products/${productId}/parameters`)
      .then((data) => {
        setParameters(data);
        const init: Record<string, string> = {};
        data.filter((p) => p.type === "NUMBER").forEach((p) => { init[p.name] = ""; });
        setPreviewParams(init);
      })
      .catch(() => {});
  }, [productId, loadVersion]);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: formName.trim() || null,
        expression: formExpr.trim() || null,
        priceRoundType: formRoundType,
        priceRoundValue: formRoundValue ? Number(formRoundValue) : null,
        note: formNote.trim() || null,
      };
      const updated = await apiPatch<PricingRuleVersion>(
        `/products/${productId}/pricing-rule/versions/${versionId}`,
        body,
      );
      setVersion(updated);
      toast.success("Đã lưu thay đổi.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể lưu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const updated = await apiPatch<PricingRuleVersion>(
        `/products/${productId}/pricing-rule/versions/${versionId}/activate`,
      );
      setVersion(updated);
      toast.success("Đã kích hoạt phiên bản.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể kích hoạt.");
    } finally {
      setActivating(false);
    }
  }

  async function handleDeleteVersion() {
    try {
      await apiDelete(`/products/${productId}/pricing-rule/versions/${versionId}`);
      toast.success("Đã xoá phiên bản.");
      router.push(`/products/${productId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá.");
    }
  }

  async function handleDeleteItem() {
    if (!itemDeleteTarget) return;
    try {
      await apiDelete(
        `/products/${productId}/pricing-rule/versions/${versionId}/items/${itemDeleteTarget.id}`,
      );
      toast.success("Đã xoá Rule.");
      loadVersion();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá Rule.");
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewResult(null);
    try {
      const numericParams: Record<string, number> = {};
      for (const [k, v] of Object.entries(previewParams)) {
        if (v !== "") numericParams[k] = Number(v);
      }
      const result = await apiPost<PreviewResult>(
        `/products/${productId}/pricing-rule/versions/${versionId}/preview`,
        { params: numericParams },
      );
      setPreviewResult(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể tính giá.");
    } finally {
      setPreviewing(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={loadVersion} />;
  if (!version) return null;

  const isDraft = version.status === "DRAFT";
  const st = statusMap[version.status] ?? statusMap.DRAFT;
  const numberParams = parameters.filter((p) => p.type === "NUMBER");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href={`/products/${productId}`} />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              Quy tắc báo giá — v{version.versionNumber}
              {version.name ? ` · ${version.name}` : ""}
            </h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button onClick={handleActivate} disabled={activating}>
                {activating ? "Đang kích hoạt..." : "Kích hoạt"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Xoá
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Expression & Settings Form */}
      <div className="rounded-lg border p-6 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Cài đặt phiên bản</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="v-name">Tên phiên bản</Label>
            <Input
              id="v-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="ví dụ: Giá Q1/2025"
              disabled={!isDraft}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="v-expr">Expression *</Label>
          {parameters.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Biến có thể dùng:{" "}
              <code className="font-mono">
                {parameters.map((p) => p.name).join(", ")}
              </code>
              {parameters.some((p) => p.name === "width") &&
                parameters.some((p) => p.name === "height") && (
                  <>
                    ,{" "}
                    <code className="font-mono">area</code>{" "}
                    (= width × height, tự tính)
                  </>
                )}
            </p>
          )}
          <Textarea
            id="v-expr"
            value={formExpr}
            onChange={(e) => setFormExpr(e.target.value)}
            placeholder="ví dụ: area * unitPrice"
            rows={3}
            className="font-mono"
            disabled={!isDraft}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Làm tròn giá</Label>
            <Select
              value={formRoundType}
              onValueChange={(v) => setFormRoundType(v ?? "NONE")}
              disabled={!isDraft}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Không làm tròn</SelectItem>
                <SelectItem value="CEIL">Làm tròn lên</SelectItem>
                <SelectItem value="FLOOR">Làm tròn xuống</SelectItem>
                <SelectItem value="ROUND">Làm tròn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formRoundType !== "NONE" && (
            <div className="space-y-2">
              <Label htmlFor="v-round-val">Bước làm tròn (VND)</Label>
              <Input
                id="v-round-val"
                type="number"
                value={formRoundValue}
                onChange={(e) => setFormRoundValue(e.target.value)}
                placeholder="ví dụ: 1000"
                min={1}
                disabled={!isDraft}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="v-note">Ghi chú</Label>
          <Textarea
            id="v-note"
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            rows={2}
            disabled={!isDraft}
          />
        </div>

        {isDraft && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        )}
      </div>

      {/* Rule Items */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Danh sách Rule</h3>
          {isDraft && (
            <Button size="sm" onClick={() => setItemAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Thêm Rule
            </Button>
          )}
        </div>

        {version.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có Rule nào.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Thông số</TableHead>
                  <TableHead>Giá trị tối thiểu</TableHead>
                  <TableHead>Mô tả</TableHead>
                  {isDraft && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {version.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary">
                        {ruleTypeLabels[item.ruleType] ?? item.ruleType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.targetParameter || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{Number(item.value).toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.description || "—"}
                    </TableCell>
                    {isDraft && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setItemEditTarget(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setItemDeleteTarget(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        <h3 className="text-sm font-medium text-muted-foreground">Preview giá bán</h3>

        {numberParams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sản phẩm chưa có thông số kiểu NUMBER để nhập giá trị.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {numberParams.map((p) => (
                <div key={p.name} className="space-y-1">
                  <Label htmlFor={`pv-${p.name}`} className="text-xs">
                    {p.label}{p.unit ? ` (${p.unit})` : ""}
                  </Label>
                  <Input
                    id={`pv-${p.name}`}
                    type="number"
                    value={previewParams[p.name] ?? ""}
                    onChange={(e) =>
                      setPreviewParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>

            <Button onClick={handlePreview} disabled={previewing || !formExpr.trim()}>
              {previewing ? "Đang tính..." : "Tính giá bán"}
            </Button>

            {previewResult && (
              <div className="rounded-md bg-muted/40 p-4 space-y-3 text-sm">
                <div>
                  <p className="font-medium mb-1">Thông số sau khi áp dụng Rule:</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {Object.entries(previewResult.adjustedParams).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="font-mono text-muted-foreground">{k}</span>
                        <span>{Number(v).toLocaleString("vi-VN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá thô:</span>
                    <span>{previewResult.rawPrice.toLocaleString("vi-VN")} đ</span>
                  </div>
                  {formRoundType !== "NONE" && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{roundTypeLabels[formRoundType]} theo {formRoundValue || "?"} VND:</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-base">
                    <span>Giá bán:</span>
                    <span className="text-green-600">
                      {previewResult.finalPrice.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <PricingRuleItemDialog
        open={itemAddOpen}
        onOpenChange={setItemAddOpen}
        productId={productId}
        versionId={versionId}
        onSaved={loadVersion}
      />

      <PricingRuleItemDialog
        open={!!itemEditTarget}
        onOpenChange={(open) => !open && setItemEditTarget(null)}
        productId={productId}
        versionId={versionId}
        item={itemEditTarget}
        onSaved={loadVersion}
      />

      <ConfirmDialog
        open={!!itemDeleteTarget}
        onOpenChange={(open) => !open && setItemDeleteTarget(null)}
        title="Xoá Rule"
        description={`Bạn có chắc muốn xoá Rule "${itemDeleteTarget?.ruleType}"?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDeleteItem}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá phiên bản"
        description={`Bạn có chắc muốn xoá phiên bản v${version.versionNumber}?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDeleteVersion}
      />
    </div>
  );
}
