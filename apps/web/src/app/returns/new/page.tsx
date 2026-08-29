"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { SalesOrderTypeahead, type SalesOrderOption } from "@/components/sales-order/sales-order-typeahead";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
import { DebtAdjustmentGate } from "@/components/return/debt-adjustment-gate";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface SalesOrderItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  finalPrice: number;
  parameters: Parameter[];
}

interface SalesOrderDetail {
  id: string;
  code: string;
  customerName: string;
  status: string;
  items: SalesOrderItem[];
  receivable: { id: string } | null;
}

interface ReturnItemDetail {
  salesOrderItemId: string;
  returnedQuantity: number;
}

interface ItemSelection {
  checked: boolean;
  quantity: string;
  reason: string;
  note: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

function CreateReturnForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillOrderId = searchParams.get("salesOrderId");

  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(!!prefillOrderId);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [alreadyReturnedMap, setAlreadyReturnedMap] = useState<Record<string, number>>({});
  const [selections, setSelections] = useState<Record<string, ItemSelection>>({});

  const [returnDate, setReturnDate] = useState(todayISO());
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bước 2 — Xác nhận giá trị & phân bổ trách nhiệm (rà soát nghiệp vụ
  // Return, 27/08/2026). "select" = Bước 1 (chọn đơn/sản phẩm), "confirm" =
  // Bước 2 (khách/công ty chịu). Mặc định khách chịu 100% — an toàn, không
  // tự ý giảm công nợ nếu kế toán không chủ động chỉnh.
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [customerBornePercent, setCustomerBornePercent] = useState("100");
  const [customerBorneAmount, setCustomerBorneAmount] = useState("0");
  const [companyBorneReason, setCompanyBorneReason] = useState("");

  // Sau khi tạo phiếu hoàn thành công (chốt lại luồng 27/08/2026): nếu có
  // phần Công ty hỗ trợ, TỰ ĐỘNG gọi luôn Manual Adjustment bằng đúng số
  // tiền/lý do đã xác nhận ở Bước 2 — không hỏi lại lần nữa. debtAdjusted
  // ghi lại kết quả bước tự động này để quyết định hiện thông báo nào.
  const [createdReturn, setCreatedReturn] = useState<{
    id: string;
    code: string;
    companyBorneValue: number;
    companyBorneReason: string;
    debtAdjusted: boolean;
  } | null>(null);

  const loadOrder = useCallback(async (orderId: string) => {
    setLoadingOrder(true);
    setOrderError(null);
    try {
      const data = await apiGet<SalesOrderDetail>(`/sales-orders/${orderId}`);
      setOrder(data);

      const list = await apiGet<{ data: { id: string }[] }>(`/returns?salesOrderId=${orderId}&limit=100`);
      const details = await Promise.all(
        list.data.map((r) => apiGet<{ items: ReturnItemDetail[] }>(`/returns/${r.id}`)),
      );
      const map: Record<string, number> = {};
      for (const d of details) {
        for (const it of d.items) {
          map[it.salesOrderItemId] = (map[it.salesOrderItemId] ?? 0) + Number(it.returnedQuantity);
        }
      }
      setAlreadyReturnedMap(map);

      const initial: Record<string, ItemSelection> = {};
      for (const item of data.items) {
        initial[item.id] = { checked: false, quantity: "", reason: "", note: "" };
      }
      setSelections(initial);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : "Không thể tải đơn hàng.");
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    if (prefillOrderId) loadOrder(prefillOrderId);
  }, [prefillOrderId, loadOrder]);

  function handlePickOrder(picked: SalesOrderOption | null) {
    if (picked) loadOrder(picked.id);
  }

  function updateSelection(itemId: string, patch: Partial<ItemSelection>) {
    setSelections((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  const selectedItems = order
    ? Object.entries(selections)
        .filter(([, s]) => s.checked)
        .map(([salesOrderItemId, s]) => ({
          salesOrderItemId,
          soItem: order.items.find((i) => i.id === salesOrderItemId)!,
          ...s,
        }))
    : [];

  // Cùng công thức backend (return.service.ts) — round từng dòng rồi cộng.
  const totalValue = selectedItems.reduce(
    (sum, it) => sum + Math.round(Number(it.soItem.finalPrice) * Number(it.quantity || 0)),
    0,
  );
  const companyBorneValue = Math.max(0, totalValue - Number(customerBorneAmount || 0));

  function onPercentChange(v: string) {
    setCustomerBornePercent(v);
    const pct = Number(v);
    if (!Number.isFinite(pct)) return;
    setCustomerBorneAmount(String(Math.round((totalValue * pct) / 100)));
  }

  function onAmountChange(v: string) {
    setCustomerBorneAmount(v);
    const amount = Number(v);
    if (!Number.isFinite(amount) || totalValue <= 0) return;
    setCustomerBornePercent(String(Math.round((amount / totalValue) * 100)));
  }

  function goToConfirm() {
    if (!order) return;

    const items = Object.entries(selections)
      .filter(([, s]) => s.checked)
      .map(([salesOrderItemId, s]) => ({ salesOrderItemId, ...s }));

    if (items.length === 0) {
      toast.error("Vui lòng chọn ít nhất một sản phẩm để trả.");
      return;
    }

    for (const item of items) {
      const soItem = order.items.find((i) => i.id === item.salesOrderItemId)!;
      const alreadyReturned = alreadyReturnedMap[item.salesOrderItemId] ?? 0;
      const remaining = Number(soItem.quantity) - alreadyReturned;
      const qty = Number(item.quantity);
      if (!qty || qty <= 0 || qty > remaining) {
        toast.error(`Số lượng trả của "${soItem.productName}" phải từ 1 đến ${remaining}.`);
        return;
      }
      if (!item.reason) {
        toast.error(`Vui lòng chọn lý do trả cho "${soItem.productName}".`);
        return;
      }
    }

    // Mặc định khách chịu 100% giá trị phiếu hoàn (tính lại theo items vừa chọn).
    const value = items.reduce((sum, it) => {
      const soItem = order.items.find((i) => i.id === it.salesOrderItemId)!;
      return sum + Math.round(Number(soItem.finalPrice) * Number(it.quantity));
    }, 0);
    setCustomerBornePercent("100");
    setCustomerBorneAmount(String(value));
    setCompanyBorneReason("");
    setStep("confirm");
  }

  async function handleSubmit() {
    if (!order) return;

    if (companyBorneValue > 0 && !companyBorneReason.trim()) {
      toast.error("Vui lòng nhập lý do công ty chịu chi phí.");
      return;
    }

    const items = selectedItems.map((i) => ({
      salesOrderItemId: i.salesOrderItemId,
      returnedQuantity: Number(i.quantity),
      reason: i.reason,
      note: i.note.trim() || undefined,
    }));

    setSubmitting(true);
    try {
      const created = await apiPost<{ id: string; code: string }>("/returns", {
        salesOrderId: order.id,
        returnDate: returnDate || undefined,
        receivedBy: receivedBy.trim() || undefined,
        note: note.trim() || undefined,
        items,
        customerBorneAmount: Number(customerBorneAmount || 0),
        companyBorneReason: companyBorneValue > 0 ? companyBorneReason.trim() : undefined,
      });

      // Phần Công ty hỗ trợ > 0 -> tự động giảm công nợ luôn bằng đúng số
      // tiền/lý do đã xác nhận ở Bước 2 (chốt lại luồng 27/08/2026 — không
      // hỏi lại lần nữa, tránh xác nhận trùng). Return service không gọi
      // thẳng Debt service — đây là 2 lệnh gọi API tuần tự do FE điều phối.
      let debtAdjusted = false;
      if (companyBorneValue > 0 && order.receivable) {
        try {
          await apiPost(`/receivables/${order.receivable.id}/manual-adjustment`, {
            amount: companyBorneValue,
            reason: companyBorneReason.trim(),
            returnCode: created.code,
            returnId: created.id,
          });
          debtAdjusted = true;
        } catch {
          debtAdjusted = false;
        }
      }

      setCreatedReturn({
        id: created.id,
        code: created.code,
        companyBorneValue,
        companyBorneReason: companyBorneReason.trim(),
        debtAdjusted,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tạo phiếu hoàn"
        description="Ghi nhận hàng khách trả"
        actions={
          // "Quay lại" luôn nghĩa là lùi 1 cấp (rà soát UI 27/08/2026): ở Bước
          // 2 thì về Bước 1 (chọn sản phẩm), ở Bước 1 thì thoát về danh sách
          // phiếu hoàn. "Huỷ" chỉ hiện ở Bước 2 — thoát hẳn cả luồng, khác
          // "Quay lại" (chỉ lùi 1 bước, không mất lựa chọn ở Bước 1).
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (step === "confirm" ? setStep("select") : router.push("/returns"))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {step === "confirm" && (
              <Button variant="outline" onClick={() => router.push("/returns")}>
                Huỷ
              </Button>
            )}
          </div>
        }
      />

      {!prefillOrderId && !order && (
        <div className="space-y-2 max-w-lg">
          <Label>Chọn đơn hàng (trừ đơn đã huỷ) *</Label>
          <SalesOrderTypeahead value={null} onChange={handlePickOrder} />
        </div>
      )}

      {loadingOrder && <Loading />}
      {orderError && <ErrorState description={orderError} />}

      {!loadingOrder && order && step === "select" && (
        <>
          <div className="rounded-lg border p-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Đơn hàng</span>
              <span className="font-mono font-medium">{order.code}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Khách hàng</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Chọn sản phẩm trả</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">Đã đặt</TableHead>
                    <TableHead className="text-right">Đã trả trước đó</TableHead>
                    <TableHead className="text-right">Còn lại tối đa</TableHead>
                    <TableHead className="w-28">SL trả</TableHead>
                    <TableHead className="w-48">Lý do</TableHead>
                    <TableHead className="w-48">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const alreadyReturned = alreadyReturnedMap[item.id] ?? 0;
                    const remaining = Number(item.quantity) - alreadyReturned;
                    const sel = selections[item.id] ?? { checked: false, quantity: "", reason: "", note: "" };
                    const disabled = remaining <= 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={sel.checked}
                            disabled={disabled}
                            onCheckedChange={(v) => updateSelection(item.id, { checked: !!v })}
                            className="size-5"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
                          {item.parameters.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.parameters.map((p) => `${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`).join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
                        <TableCell className="text-right text-sm">{alreadyReturned}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{remaining}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            max={remaining}
                            value={sel.quantity}
                            disabled={!sel.checked || disabled}
                            onChange={(e) => updateSelection(item.id, { quantity: e.target.value })}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={sel.reason}
                            onValueChange={(v) => updateSelection(item.id, { reason: v ?? "" })}
                            disabled={!sel.checked || disabled}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue placeholder="Chọn lý do..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(RETURN_REASON_LABEL).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={sel.note}
                            disabled={!sel.checked || disabled}
                            onChange={(e) => updateSelection(item.id, { note: e.target.value })}
                            className="w-44"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="return-date">Ngày trả</Label>
              <Input
                id="return-date"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="received-by">Người nhận</Label>
              <Input
                id="received-by"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Tên người nhận hàng trả..."
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="return-note">Ghi chú chung</Label>
              <Textarea
                id="return-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={goToConfirm}>Tiếp theo</Button>
          </div>
        </>
      )}

      {!loadingOrder && order && step === "confirm" && (
        <>
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Xác nhận giá trị & phân bổ trách nhiệm</h3>
            <div className="rounded-md border divide-y">
              {selectedItems.map((it) => (
                <div key={it.salesOrderItemId} className="px-4 py-3 flex items-center justify-between text-sm">
                  <span>{it.soItem.productName} × {it.quantity}</span>
                  <span className="font-mono">
                    {formatMoney(Number(it.soItem.finalPrice) * Number(it.quantity))}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3 flex items-center justify-between text-sm font-semibold">
                <span>Tổng giá trị phiếu hoàn</span>
                <span className="font-mono">{formatMoney(totalValue)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="customer-borne-percent">Tỷ lệ % Phí khách</Label>
              <Input
                id="customer-borne-percent"
                type="number"
                min="0"
                max="100"
                value={customerBornePercent}
                onChange={(e) => onPercentChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-borne-amount">Phí khách</Label>
              <Input
                id="customer-borne-amount"
                type="number"
                min="0"
                max={totalValue}
                value={customerBorneAmount}
                onChange={(e) => onAmountChange(e.target.value)}
              />
            </div>
            <div className="col-span-2 rounded-md border bg-muted/30 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Công ty hỗ trợ (tự tính)</span>
              <span className="font-mono font-semibold">{formatMoney(companyBorneValue)}</span>
            </div>
            {companyBorneValue > 0 && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="company-borne-reason">Lý do Công ty hỗ trợ *</Label>
                <Textarea
                  id="company-borne-reason"
                  value={companyBorneReason}
                  onChange={(e) => setCompanyBorneReason(e.target.value)}
                  placeholder="Ví dụ: Lỗi sản xuất — cắt sai kích thước"
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Bỏ nút "Quay lại chọn sản phẩm" riêng (rà soát UI 27/08/2026) —
              header đã có "Quay lại" làm đúng việc này. */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo phiếu hoàn"}
            </Button>
          </div>
        </>
      )}

      {/* Xác nhận đã tạo thành công (chốt lại luồng 27/08/2026) — 1 thông báo
          duy nhất, gộp cả kết quả giảm công nợ (đã tự động làm ở handleSubmit)
          — không bắt xác nhận thêm lần nữa nếu đã thành công. Chỉ khi bước tự
          động lỗi mới hiện thêm lối "Giảm trừ công nợ" (qua DebtAdjustmentGate,
          biết chắc debtAdjustedAt=null vì vừa thử và lỗi). */}
      <Dialog
        open={!!createdReturn}
        onOpenChange={(open) => {
          if (!open && createdReturn) router.push(`/returns/${createdReturn.id}`);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Đã tạo phiếu hoàn thành công
            </DialogTitle>
          </DialogHeader>
          {createdReturn && order && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Đã tạo phiếu hoàn {createdReturn.code} thành công.
                {createdReturn.companyBorneValue > 0 && createdReturn.debtAdjusted && (
                  ` Đã giảm trừ công nợ ${formatMoney(createdReturn.companyBorneValue)} cho đơn ${order.code} của khách hàng ${order.customerName}.`
                )}
              </p>
              {createdReturn.companyBorneValue > 0 && !createdReturn.debtAdjusted && (
                order.receivable ? (
                  <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="text-xs text-muted-foreground">
                      Giảm trừ công nợ tự động không thành công — thử lại bên dưới.
                    </p>
                    <DebtAdjustmentGate
                      returnCode={createdReturn.code}
                      returnId={createdReturn.id}
                      debtAdjustedAt={null}
                      debtAdjustedAmount={null}
                      debtAdjustedByName={null}
                      receivableId={order.receivable.id}
                      salesOrderCode={order.code}
                      suggestedAmount={createdReturn.companyBorneValue}
                      suggestedReason={createdReturn.companyBorneReason}
                      onSaved={() => router.push(`/returns/${createdReturn.id}`)}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Đơn hàng chưa có công nợ để giảm — vào chi tiết phiếu hoàn để xử lý sau.
                  </p>
                )
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push(`/returns/${createdReturn?.id}`)}>
              Xem chi tiết phiếu hoàn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CreateReturnPage() {
  return (
    <Suspense fallback={null}>
      <CreateReturnForm />
    </Suspense>
  );
}
