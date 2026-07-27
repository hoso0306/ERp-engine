"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import { ProductTypeahead, type ProductOption } from "@/components/quotation/product-typeahead";

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

export interface OpeningBalanceLineDraft {
  key: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  parameters: { name: string; value: string }[];
  systemPrice: number;
  discountPercent: number;
  surchargeAfterDiscount: number;
  finalPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
}

interface OpeningBalanceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onAdd: (line: OpeningBalanceLineDraft) => void;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

// opening-balance.md — "Phục dựng hoá đơn" cho Công nợ đầu kỳ. Tái dùng đúng
// UX chọn sản phẩm + tính giá của QuotationItemDialog, nhưng KHÔNG gọi API
// lưu ngay như Quotation — chỉ tính giá preview rồi trả dòng về cho page cha
// gom vào 1 mảng, submit 1 lần duy nhất qua POST /vat-settlements/from-opening-balance.
export function OpeningBalanceLineDialog({
  open,
  onOpenChange,
  customerId,
  onAdd,
}: OpeningBalanceLineDialogProps) {
  const [productId, setProductId] = useState("");
  const [pickedProduct, setPickedProduct] = useState<ProductOption | null>(null);
  const [productParams, setProductParams] = useState<ProductParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("1");

  const [discountPercent, setDiscountPercent] = useState(0);
  const [systemPrice, setSystemPrice] = useState<number | null>(null);
  const [surchargeAfterDiscount, setSurchargeAfterDiscount] = useState(0);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number>(0);
  const [adjustedVariables, setAdjustedVariables] = useState<Record<string, number>>({});
  const [priceWarnings, setPriceWarnings] = useState<string[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);

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

  function reset() {
    setProductId("");
    setPickedProduct(null);
    setProductParams([]);
    setParamValues({});
    setQuantity("1");
    setDiscountPercent(0);
    setSystemPrice(null);
    setUnitPrice(null);
    setVatRate(0);
    setSurchargeAfterDiscount(0);
    setAdjustedVariables({});
    setPriceWarnings([]);
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  useEffect(() => {
    if (!productId) return;
    loadProductParameters(productId).then((params) => {
      const defaults: Record<string, string> = {};
      for (const p of params) defaults[p.name] = p.defaultValue ?? "";
      setParamValues(defaults);
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
        surchargeAfterDiscount: number;
      }>("/pricing-engine/calculate", { productId, parameters });
      setSystemPrice(data.systemPrice);
      setUnitPrice(data.unitPrice);
      setVatRate(data.vatRate ?? 0);
      setAdjustedVariables(data.adjustedVariables ?? {});
      setPriceWarnings(data.warnings ?? []);
      setSurchargeAfterDiscount(data.surchargeAfterDiscount ?? 0);
    } catch {
      setSystemPrice(null);
      setUnitPrice(null);
      setVatRate(0);
      setAdjustedVariables({});
      setPriceWarnings([]);
      setSurchargeAfterDiscount(0);
    } finally {
      setPriceLoading(false);
    }
  }, [productId, paramValues, productParams]);

  useEffect(() => {
    if (!open || !productId) return;
    const timer = setTimeout(calculatePrice, 400);
    return () => clearTimeout(timer);
  }, [open, productId, paramValues, calculatePrice]);

  // Snapshot % Chiết khấu Khách hàng × Loại sản phẩm — cùng logic Quotation.
  useEffect(() => {
    if (!productId || !customerId) {
      setDiscountPercent(0);
      return;
    }
    apiGet<{ discountPercent: number }>(
      `/customers/${customerId}/product-discounts/lookup?productId=${productId}`,
    )
      .then((d) => setDiscountPercent(d.discountPercent ?? 0))
      .catch(() => setDiscountPercent(0));
  }, [productId, customerId]);

  function handleProductChange(product: ProductOption | null) {
    setPickedProduct(product);
    setProductId(product?.id ?? "");
    setSystemPrice(null);
    setUnitPrice(null);
    setVatRate(0);
    setAdjustedVariables({});
    setPriceWarnings([]);
    setSurchargeAfterDiscount(0);
    if (!product) {
      setProductParams([]);
      setParamValues({});
    }
  }

  const qty = parseFloat(quantity) || 0;
  const finalPrice =
    systemPrice !== null
      ? systemPrice * (1 - discountPercent / 100) + surchargeAfterDiscount
      : null;
  const finalPriceSafe = finalPrice !== null ? Math.max(0, Math.round(finalPrice)) : null;
  const subtotal = finalPriceSafe !== null ? Math.round(finalPriceSafe * qty) : null;
  const finalNegative = finalPrice !== null && finalPrice < 0;
  const vatAmount = subtotal !== null ? Math.round(subtotal * (vatRate / 100)) : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !pickedProduct) { toast.error("Vui lòng chọn sản phẩm."); return; }
    if (!quantity || qty <= 0) { toast.error("Số lượng phải lớn hơn 0."); return; }
    if (systemPrice === null || finalPriceSafe === null || subtotal === null || vatAmount === null) {
      toast.error("Đang tính giá, vui lòng chờ.");
      return;
    }

    onAdd({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productId,
      productCode: pickedProduct.code,
      productName: pickedProduct.name,
      quantity: qty,
      parameters: Object.entries(paramValues).map(([name, value]) => ({ name, value })),
      systemPrice,
      discountPercent,
      surchargeAfterDiscount,
      finalPrice: finalPriceSafe,
      subtotal,
      vatRate,
      vatAmount,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Thêm dòng sản phẩm</DialogTitle>
        </DialogHeader>

        <form id="ob-line-form" onSubmit={onSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Sản phẩm *</Label>
            <ProductTypeahead value={pickedProduct} onChange={handleProductChange} />
          </div>

          {productParams.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-medium">Thông số sản phẩm</p>
              <div className="grid grid-cols-2 gap-3">
                {productParams.map((p) => (
                  <div key={p.name} className="space-y-1.5">
                    <Label htmlFor={`ob-param-${p.name}`} className="text-sm">
                      {p.label}
                      {p.isRequired && " *"}
                      {p.unit && <span className="text-muted-foreground ml-1">({p.unit})</span>}
                    </Label>
                    {p.type === "ENUM" ? (
                      <Select
                        value={paramValues[p.name] ?? ""}
                        onValueChange={(v) => setParamValues((prev) => ({ ...prev, [p.name]: v ?? "" }))}
                      >
                        <SelectTrigger id={`ob-param-${p.name}`}>
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
                        id={`ob-param-${p.name}`}
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

          <div className="space-y-2">
            <Label htmlFor="ob-line-qty">Số lượng *</Label>
            <Input
              id="ob-line-qty"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <Separator />
          <div className="space-y-1.5">
            <Label className="text-sm">Chiết khấu</Label>
            <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
              {discountPercent > 0
                ? `${discountPercent}% (theo cấu hình khách hàng × loại sản phẩm)`
                : "Chưa cấu hình chiết khấu cho loại sản phẩm này"}
            </div>
          </div>

          {priceWarnings.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
              {priceWarnings.map((w, idx) => (
                <p key={idx} className="text-xs text-amber-800">⚠ {w}</p>
              ))}
            </div>
          )}

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
              {surchargeAfterDiscount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Phụ phí (sau chiết khấu)</span>
                  <span className="font-mono">{formatMoney(surchargeAfterDiscount)}</span>
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
                  <span className="font-mono">{subtotal !== null ? formatMoney(subtotal) : "—"}</span>
                </div>
              )}
              {qty > 0 && !finalNegative && vatRate > 0 && (
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>VAT ({vatRate}%) — sẽ đưa vào Quyết toán VAT</span>
                  <span className="font-mono">{vatAmount !== null ? formatMoney(vatAmount) : "—"}</span>
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="ob-line-form"
            disabled={priceLoading || !productId || finalNegative}
          >
            Thêm dòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
