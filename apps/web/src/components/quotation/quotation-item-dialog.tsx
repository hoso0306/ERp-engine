"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";
import { ProductTypeahead, type ProductOption } from "./product-typeahead";

interface ProductParam {
  id: string;
  name: string;
  label: string;
  type: string;
  unit: string | null;
  defaultValue: string | null;
  isRequired: boolean;
  displayOrder: number;
  options: { value: string; label: string | null }[];
}

interface ExistingItem {
  id: string;
  productId: string;
  quantity: number;
  systemPrice: number;
  discountPercent: number;
  note: string | null;
  finalPrice: number;
  vatRate: number;
  parameters: { name: string; label: string; value: string; unit: string | null }[];
}

interface QuotationItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  customerId: string;
  item?: ExistingItem | null;
  onSaved: () => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export function QuotationItemDialog({
  open,
  onOpenChange,
  quotationId,
  customerId,
  item,
  onSaved,
}: QuotationItemDialogProps) {
  const isEdit = !!item;

  const [productId, setProductId] = useState("");
  const [pickedProduct, setPickedProduct] = useState<ProductOption | null>(null);
  const [productParams, setProductParams] = useState<ProductParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("1");

  // Chiết khấu Khách hàng × Sản phẩm (Sprint 04, chốt 16/07/2026) — read-only,
  // lookup từ Master Data khi thêm mới; khi sửa dùng lại snapshot cũ (không
  // lookup lại, giống hệt cách groupDiscount cũ hoạt động).
  const [discountPercent, setDiscountPercent] = useState(0);
  const [note, setNote] = useState("");

  const [systemPrice, setSystemPrice] = useState<number | null>(null);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number>(0);
  const [adjustedVariables, setAdjustedVariables] = useState<Record<string, number>>({});
  const [priceWarnings, setPriceWarnings] = useState<string[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch parameters for a given productId
  const loadProductParameters = useCallback(async (id: string) => {
    try {
      const params = await apiGet<ProductParam[]>(`/products/${id}/parameters`);
      setProductParams(params ?? []);
      return params;
    } catch {
      setProductParams([]);
      return [];
    }
  }, []);

  // Populate form when editing — sản phẩm không đổi được lúc sửa (Select cũ đã
  // disabled={isEdit}), nên chỉ cần lấy code/name để hiển thị trong Typeahead.
  useEffect(() => {
    if (!open) return;
    if (item) {
      setProductId(item.productId);
      apiGet<ProductOption>(`/products/${item.productId}`)
        .then((p) => setPickedProduct({ id: p.id, code: p.code, name: p.name }))
        .catch(() => setPickedProduct(null));
      setQuantity(String(item.quantity));
      setSystemPrice(item.systemPrice);
      setVatRate(item.vatRate ?? 0);
      setDiscountPercent(Number(item.discountPercent ?? 0));
      setNote(item.note ?? "");
      const vals: Record<string, string> = {};
      for (const p of item.parameters) vals[p.name] = p.value;
      setParamValues(vals);
    } else {
      setProductId("");
      setPickedProduct(null);
      setProductParams([]);
      setParamValues({});
      setQuantity("1");
      setDiscountPercent(0);
      setNote("");
      setSystemPrice(null);
      setVatRate(0);
    }
    setUnitPrice(null);
    setAdjustedVariables({});
    setPriceWarnings([]);
  }, [open, item]);

  // Nạp thông số + giá trị mặc định khi productId đổi (chọn mới hoặc lúc sửa mở lên)
  useEffect(() => {
    if (!productId) return;
    loadProductParameters(productId).then((params) => {
      if (!item && params) {
        const defaults: Record<string, string> = {};
        for (const p of params) defaults[p.name] = p.defaultValue ?? "";
        setParamValues(defaults);
      }
    });
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculatePrice = useCallback(async () => {
    if (!productId || productParams.length === 0) return;
    const parameters = Object.entries(paramValues).map(([name, value]) => ({ name, value }));
    if (parameters.length === 0) return;

    setPriceLoading(true);
    try {
      const data = await apiPost<{
        systemPrice: number;
        unitPrice: number | null;
        vatRate: number;
        adjustedVariables: Record<string, number>;
        warnings: string[];
      }>("/pricing-engine/calculate", { productId, parameters });
      setSystemPrice(data.systemPrice);
      setUnitPrice(data.unitPrice);
      setVatRate(data.vatRate ?? 0);
      setAdjustedVariables(data.adjustedVariables ?? {});
      setPriceWarnings(data.warnings ?? []);
    } catch {
      setSystemPrice(null);
      setUnitPrice(null);
      setVatRate(0);
      setAdjustedVariables({});
      setPriceWarnings([]);
    } finally {
      setPriceLoading(false);
    }
  }, [productId, paramValues, productParams]);

  useEffect(() => {
    if (!open || !productId) return;
    const timer = setTimeout(calculatePrice, 400);
    return () => clearTimeout(timer);
  }, [open, productId, paramValues, calculatePrice]);

  // Lookup % chiết khấu Khách hàng × Sản phẩm — chỉ khi THÊM MỚI. Sửa dòng
  // giữ nguyên discountPercent đã snapshot (không lookup lại).
  useEffect(() => {
    if (isEdit) return;
    if (!productId || !customerId) {
      setDiscountPercent(0);
      return;
    }
    apiGet<{ discountPercent: number }>(
      `/customers/${customerId}/product-discounts/lookup?productId=${productId}`,
    )
      .then((d) => setDiscountPercent(d.discountPercent ?? 0))
      .catch(() => setDiscountPercent(0));
  }, [productId, customerId, isEdit]);

  function handleProductChange(product: ProductOption | null) {
    setPickedProduct(product);
    setProductId(product?.id ?? "");
    setSystemPrice(null);
    setUnitPrice(null);
    setVatRate(0);
    setAdjustedVariables({});
    setPriceWarnings([]);
    if (!product) {
      setProductParams([]);
      setParamValues({});
    }
  }

  // Price preview calculation
  const qty = parseFloat(quantity) || 0;

  const finalPrice =
    systemPrice !== null ? systemPrice * (1 - discountPercent / 100) : null;
  const finalPriceSafe = finalPrice !== null ? Math.max(0, Math.round(finalPrice)) : null;
  const subtotal = finalPriceSafe !== null ? Math.round(finalPriceSafe * qty) : null;
  const finalNegative = finalPrice !== null && finalPrice < 0;

  // VAT tính SAU chiết khấu (trên subtotal), mirror calcVatAmount() ở BE
  // (quotation-workflow.service.ts) — chỉ để preview trước khi submit.
  const vatAmount = subtotal !== null ? Math.round(subtotal * (vatRate / 100)) : null;
  const grandTotal = subtotal !== null && vatAmount !== null ? subtotal + vatAmount : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Vui lòng chọn sản phẩm."); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error("Số lượng phải lớn hơn 0."); return; }

    const parameters = Object.entries(paramValues).map(([name, value]) => ({ name, value }));
    const body: Record<string, unknown> = {
      productId,
      quantity: parseFloat(quantity),
      parameters,
      note: note.trim() || null,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiPatch(`/quotations/${quotationId}/items/${item!.id}`, body);
      } else {
        await apiPost(`/quotations/${quotationId}/items`, body);
      }

      toast.success(isEdit ? "Cập nhật thành công." : "Thêm sản phẩm thành công.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
        </DialogHeader>

        <form id="item-form" onSubmit={onSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Product */}
          <div className="space-y-2">
            <Label>Sản phẩm *</Label>
            <ProductTypeahead value={pickedProduct} onChange={handleProductChange} disabled={isEdit} />
          </div>

          {/* Parameters */}
          {productParams.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">Thông số sản phẩm</p>
              <div className="grid grid-cols-2 gap-3">
                {productParams.map((p) => (
                  <div key={p.name} className="space-y-1.5">
                    <Label htmlFor={`param-${p.name}`} className="text-sm">
                      {p.label}
                      {p.isRequired && " *"}
                      {p.unit && <span className="text-muted-foreground ml-1">({p.unit})</span>}
                    </Label>
                    {p.type === "ENUM" ? (
                      <Select
                        value={paramValues[p.name] ?? ""}
                        onValueChange={(v) => setParamValues((prev) => ({ ...prev, [p.name]: v ?? "" }))}
                      >
                        <SelectTrigger id={`param-${p.name}`}>
                          <SelectValue placeholder="Chọn..." />
                        </SelectTrigger>
                        <SelectContent>
                          {p.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label ?? o.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`param-${p.name}`}
                        type={p.type === "NUMBER" ? "number" : "text"}
                        value={paramValues[p.name] ?? ""}
                        onChange={(e) =>
                          setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
                        }
                        placeholder={p.defaultValue ?? ""}
                        required={p.isRequired}
                        step="any"
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="qty">Số lượng *</Label>
            <Input
              id="qty"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          {/* Chiết khấu Khách hàng × Sản phẩm (Sprint 04) — read-only, lookup từ Master Data */}
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-sm">Chiết khấu</Label>
            <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
              {discountPercent > 0
                ? `${discountPercent}% (theo cấu hình khách hàng × sản phẩm)`
                : "Chưa cấu hình chiết khấu cho sản phẩm này"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-note" className="text-sm">Ghi chú</Label>
            <Textarea
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú thêm cho dòng sản phẩm này (tuỳ chọn)..."
            />
          </div>

          {/* Cảnh báo Validation Rule (Task 11) */}
          {priceWarnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
              {priceWarnings.map((w, idx) => (
                <p key={idx} className="text-xs text-amber-800">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Price preview */}
          {productId && (
            <div className="rounded-md bg-muted p-3 space-y-1.5 text-sm">
              {unitPrice !== null && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Đơn giá</span>
                  <span className="font-mono">{formatMoney(unitPrice)}/m²</span>
                </div>
              )}
              {Object.entries(adjustedVariables).map(([key, adjustedValue]) => {
                const rawValue = Number(paramValues[key]);
                const wasAdjusted = !isNaN(rawValue) && rawValue !== adjustedValue;
                if (!wasAdjusted) return null;
                const label = productParams.find((p) => p.name === key)?.label ?? key;
                return (
                  <p key={key} className="text-xs text-muted-foreground">
                    Tính theo tối thiểu — {label}: {rawValue} → {adjustedValue}
                  </p>
                );
              })}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giá hệ thống</span>
                <span className="font-mono">
                  {priceLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : systemPrice !== null ? formatMoney(systemPrice) : "—"}
                </span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Chiết khấu ({discountPercent}%)</span>
                  <span className="font-mono text-destructive">
                    {systemPrice !== null
                      ? "−" + formatMoney(Math.round(systemPrice * (discountPercent / 100)))
                      : "—"}
                  </span>
                </div>
              )}
              <div className={`flex justify-between border-t pt-1.5 font-medium ${finalNegative ? "text-destructive" : ""}`}>
                <span>Giá bán</span>
                <span className="font-mono">
                  {finalNegative
                    ? "Âm — kiểm tra lại"
                    : finalPriceSafe !== null ? formatMoney(finalPriceSafe) : "—"}
                </span>
              </div>
              {qty > 0 && !finalNegative && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Thành tiền ({qty} sp)</span>
                  <span className="font-mono">
                    {subtotal !== null ? formatMoney(subtotal) : "—"}
                  </span>
                </div>
              )}
              {qty > 0 && !finalNegative && vatRate > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>VAT ({vatRate}%)</span>
                    <span className="font-mono">
                      {vatAmount !== null ? formatMoney(vatAmount) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Tổng thanh toán</span>
                    <span className="font-mono">
                      {grandTotal !== null ? formatMoney(grandTotal) : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="item-form"
            disabled={submitting || !productId || priceLoading || finalNegative}
          >
            {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Thêm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
