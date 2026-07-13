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

interface ProductOption {
  id: string;
  code: string;
  name: string;
  parameters: ProductParam[];
}

interface ExistingItem {
  id: string;
  productId: string;
  quantity: number;
  systemPrice: number;
  groupDiscount: number;
  additionalDiscountPercent: number;
  additionalDiscountAmount: number;
  discountReason: string | null;
  discountBy: string | null;
  finalPrice: number;
  parameters: { name: string; label: string; value: string; unit: string | null }[];
}

interface QuotationItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: string;
  groupDiscount: number;
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
  groupDiscount,
  item,
  onSaved,
}: QuotationItemDialogProps) {
  const isEdit = !!item;

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("1");

  // Discount fields (Task 04)
  const [addlDiscountPct, setAddlDiscountPct] = useState("0");
  const [addlDiscountAmt, setAddlDiscountAmt] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [discountBy, setDiscountBy] = useState("");

  const [systemPrice, setSystemPrice] = useState<number | null>(null);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [adjustedVariables, setAdjustedVariables] = useState<Record<string, number>>({});
  const [priceWarnings, setPriceWarnings] = useState<string[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load active products (lightweight list, no parameters)
  useEffect(() => {
    if (!open) return;
    apiGet<{ data: ProductOption[] }>("/products?status=ACTIVE&limit=200")
      .then((json) => setProducts(json.data ?? []))
      .catch(() => {});
  }, [open]);

  // Fetch parameters for a given productId and update selectedProduct
  const loadProductParameters = useCallback(async (id: string) => {
    const base = products.find((p) => p.id === id);
    if (!base) return;
    try {
      const params = await apiGet<ProductParam[]>(`/products/${id}/parameters`);
      setSelectedProduct({ ...base, parameters: params ?? [] });
      return params;
    } catch {
      setSelectedProduct({ ...base, parameters: [] });
      return [];
    }
  }, [products]);

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (item) {
      setProductId(item.productId);
      setQuantity(String(item.quantity));
      setSystemPrice(item.systemPrice);
      setAddlDiscountPct(String(item.additionalDiscountPercent ?? 0));
      setAddlDiscountAmt(String(item.additionalDiscountAmount ?? 0));
      setDiscountReason(item.discountReason ?? "");
      setDiscountBy(item.discountBy ?? "");
      const vals: Record<string, string> = {};
      for (const p of item.parameters) vals[p.name] = p.value;
      setParamValues(vals);
    } else {
      setProductId("");
      setSelectedProduct(null);
      setParamValues({});
      setQuantity("1");
      setAddlDiscountPct("0");
      setAddlDiscountAmt("0");
      setDiscountReason("");
      setDiscountBy("");
      setSystemPrice(null);
    }
    setUnitPrice(null);
    setAdjustedVariables({});
    setPriceWarnings([]);
  }, [open, item]);

  // Sync selectedProduct (with parameters) when products load or productId changes
  useEffect(() => {
    if (productId && products.length > 0) {
      loadProductParameters(productId).then((params) => {
        if (!item && params) {
          const defaults: Record<string, string> = {};
          for (const p of params) defaults[p.name] = p.defaultValue ?? "";
          setParamValues(defaults);
        }
      });
    }
  }, [productId, products]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculatePrice = useCallback(async () => {
    if (!productId || !selectedProduct) return;
    const parameters = Object.entries(paramValues).map(([name, value]) => ({ name, value }));
    if (parameters.length === 0) return;

    setPriceLoading(true);
    try {
      const data = await apiPost<{
        systemPrice: number;
        unitPrice: number | null;
        adjustedVariables: Record<string, number>;
        warnings: string[];
      }>("/pricing-engine/calculate", { productId, parameters });
      setSystemPrice(data.systemPrice);
      setUnitPrice(data.unitPrice);
      setAdjustedVariables(data.adjustedVariables ?? {});
      setPriceWarnings(data.warnings ?? []);
    } catch {
      setSystemPrice(null);
      setUnitPrice(null);
      setAdjustedVariables({});
      setPriceWarnings([]);
    } finally {
      setPriceLoading(false);
    }
  }, [productId, paramValues, selectedProduct]);

  useEffect(() => {
    if (!open || !productId) return;
    const timer = setTimeout(calculatePrice, 400);
    return () => clearTimeout(timer);
  }, [open, productId, paramValues, calculatePrice]);

  async function handleProductChange(id: string | null) {
    setProductId(id ?? "");
    setSystemPrice(null);
    setUnitPrice(null);
    setAdjustedVariables({});
    setPriceWarnings([]);
    if (!id) {
      setSelectedProduct(null);
      setParamValues({});
      return;
    }
    const params = await loadProductParameters(id);
    const defaults: Record<string, string> = {};
    for (const p of params ?? []) defaults[p.name] = p.defaultValue ?? "";
    setParamValues(defaults);
  }

  // Price preview calculation
  const pct = parseFloat(addlDiscountPct) || 0;
  const amt = parseFloat(addlDiscountAmt) || 0;
  const qty = parseFloat(quantity) || 0;

  const afterGroup =
    systemPrice !== null ? systemPrice * (1 - groupDiscount / 100) : null;
  const afterAddlPct = afterGroup !== null ? afterGroup * (1 - pct / 100) : null;
  const finalPrice = afterAddlPct !== null ? afterAddlPct - amt : null;
  const finalPriceSafe = finalPrice !== null ? Math.max(0, Math.round(finalPrice)) : null;
  const subtotal = finalPriceSafe !== null ? Math.round(finalPriceSafe * qty) : null;
  const finalNegative = finalPrice !== null && finalPrice < 0;

  const hasAddlDiscount = pct > 0 || amt > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Vui lòng chọn sản phẩm."); return; }
    if (!quantity || parseFloat(quantity) <= 0) { toast.error("Số lượng phải lớn hơn 0."); return; }
    if (hasAddlDiscount && !discountReason.trim()) {
      toast.error("Lý do giảm giá là bắt buộc khi áp dụng chiết khấu thêm.");
      return;
    }

    const parameters = Object.entries(paramValues).map(([name, value]) => ({ name, value }));
    const body: Record<string, unknown> = {
      productId,
      quantity: parseFloat(quantity),
      parameters,
      additionalDiscountPercent: pct,
      additionalDiscountAmount: amt,
    };
    if (discountReason.trim()) body.discountReason = discountReason.trim();
    if (discountBy.trim()) body.discountBy = discountBy.trim();

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
            <Select value={productId} onValueChange={handleProductChange} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn sản phẩm..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parameters */}
          {selectedProduct && selectedProduct.parameters.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">Thông số sản phẩm</p>
              <div className="grid grid-cols-2 gap-3">
                {selectedProduct.parameters.map((p) => (
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

          {/* Additional Discount (Task 04) */}
          <Separator />
          <p className="text-sm font-medium">Giảm thêm <span className="text-muted-foreground font-normal">(tuỳ chọn)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="addl-pct" className="text-sm">Theo % (0–100)</Label>
              <Input
                id="addl-pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={addlDiscountPct}
                onChange={(e) => setAddlDiscountPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addl-amt" className="text-sm">Theo số tiền (₫)</Label>
              <Input
                id="addl-amt"
                type="number"
                min="0"
                step="1000"
                value={addlDiscountAmt}
                onChange={(e) => setAddlDiscountAmt(e.target.value)}
              />
            </div>
          </div>

          {hasAddlDiscount && (
            <div className="space-y-1.5">
              <Label htmlFor="discount-reason" className="text-sm">
                Lý do giảm giá *
              </Label>
              <Textarea
                id="discount-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Khách hàng thân thiết, đơn hàng lớn..."
                required
              />
            </div>
          )}

          {hasAddlDiscount && (
            <div className="space-y-1.5">
              <Label htmlFor="discount-by" className="text-sm">Người thực hiện</Label>
              <Input
                id="discount-by"
                value={discountBy}
                onChange={(e) => setDiscountBy(e.target.value)}
                placeholder="Tên người duyệt chiết khấu..."
              />
            </div>
          )}

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
                const label = selectedProduct?.parameters.find((p) => p.name === key)?.label ?? key;
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
              {groupDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>CK nhóm ({groupDiscount}%)</span>
                  <span className="font-mono text-destructive">
                    {systemPrice !== null
                      ? "−" + formatMoney(Math.round(systemPrice * (groupDiscount / 100)))
                      : "—"}
                  </span>
                </div>
              )}
              {pct > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Giảm thêm ({pct}%)</span>
                  <span className="font-mono text-destructive">
                    {afterGroup !== null
                      ? "−" + formatMoney(Math.round(afterGroup * (pct / 100)))
                      : "—"}
                  </span>
                </div>
              )}
              {amt > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Giảm thêm (số tiền)</span>
                  <span className="font-mono text-destructive">−{formatMoney(amt)}</span>
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
