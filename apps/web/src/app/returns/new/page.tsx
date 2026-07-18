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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { SalesOrderTypeahead, type SalesOrderOption } from "@/components/sales-order/sales-order-typeahead";
import { RETURN_REASON_LABEL } from "@/components/return/return-reason-label";
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
  parameters: Parameter[];
}

interface SalesOrderDetail {
  id: string;
  code: string;
  customerName: string;
  status: string;
  items: SalesOrderItem[];
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

  async function handleSubmit() {
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

    setSubmitting(true);
    try {
      const created = await apiPost<{ id: string }>("/returns", {
        salesOrderId: order.id,
        returnDate: returnDate || undefined,
        receivedBy: receivedBy.trim() || undefined,
        note: note.trim() || undefined,
        items: items.map((i) => ({
          salesOrderItemId: i.salesOrderItemId,
          returnedQuantity: Number(i.quantity),
          reason: i.reason,
          note: i.note.trim() || undefined,
        })),
      });
      toast.success("Đã tạo phiếu hoàn.");
      router.push(`/returns/${created.id}`);
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
        description="Ghi nhận hàng khách trả từ đơn hàng đã giao"
        actions={
          <Button variant="outline" onClick={() => router.push("/returns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
        }
      />

      {!prefillOrderId && !order && (
        <div className="space-y-2 max-w-lg">
          <Label>Chọn đơn hàng đã giao (DELIVERED) *</Label>
          <SalesOrderTypeahead value={null} onChange={handlePickOrder} />
        </div>
      )}

      {loadingOrder && <Loading />}
      {orderError && <ErrorState description={orderError} />}

      {!loadingOrder && order && (
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
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo phiếu hoàn"}
            </Button>
          </div>
        </>
      )}
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
