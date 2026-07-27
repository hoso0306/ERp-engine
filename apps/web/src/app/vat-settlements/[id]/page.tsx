"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import { VatSettlementStatusBadge } from "@/components/debt/vat-settlement-status-badge";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface VatSettlementItemLineRow {
  id: string;
  productName: string;
  quantity: number;
  subtotal: number;
  vatAmount: number;
}

// opening-balance.md — item giờ có 2 nguồn loại trừ nhau: Receivable (đơn
// hàng thật) hoặc OpeningBalance (Công nợ đầu kỳ, kèm lines = dòng sản phẩm
// dùng để tính ra số tiền VAT).
interface VatSettlementItemRow {
  id: string;
  amount: number;
  receivable: {
    id: string;
    salesOrder: { id: string; code: string; customerName: string };
  } | null;
  openingBalance: { id: string; code: string; customerId: string } | null;
  lines: VatSettlementItemLineRow[];
}

interface CustomerBrief {
  name: string;
}

interface TimelineRow {
  id: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdByName: string | null;
  createdAt: string;
}

interface VatSettlementDetail {
  id: string;
  code: string;
  customerId: string;
  status: string;
  totalAmount: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  createdAt: string;
  items: VatSettlementItemRow[];
  payment: { code: string; paymentDate: string; paymentMethod: string } | null;
  timeline: TimelineRow[];
}

const TIMELINE_LABEL: Record<string, string> = {
  VAT_SETTLEMENT_CREATED: "Tạo VAT Settlement",
  VAT_SETTLEMENT_SENT: "Gửi khách",
  VAT_SETTLEMENT_PAID: "Ghi nhận thanh toán",
  VAT_SETTLEMENT_INVOICED: "Đánh dấu đã xuất hóa đơn",
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export default function VatSettlementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [settlement, setSettlement] = useState<VatSettlementDetail | null>(null);
  const [customer, setCustomer] = useState<CustomerBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);

  const fetchSettlement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<VatSettlementDetail>(`/vat-settlements/${id}`);
      setSettlement(data);
      // opening-balance.md — item nguồn OpeningBalance không có snapshot
      // customerName (khác Receivable.salesOrder) — lấy qua customerId chung
      // của cả settlement (1 settlement luôn thuộc đúng 1 khách hàng).
      apiGet<CustomerBrief>(`/customers/${data.customerId}`)
        .then(setCustomer)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải VAT Settlement.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSettlement(); }, [fetchSettlement]);

  if (loading) return <Loading />;
  if (error || !settlement) return <ErrorState description={error ?? "Không tìm thấy."} onRetry={fetchSettlement} />;

  const canAct = hasPermission("debt.create-payment");

  async function handleSend() {
    setBusy(true);
    try {
      await apiPost(`/vat-settlements/${id}/send`);
      toast.success("Đã gửi khách.");
      fetchSettlement();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await apiPost(`/vat-settlements/${id}/cancel`);
      toast.success("Đã huỷ VAT Settlement.");
      fetchSettlement();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (paymentMethod === "BANK_TRANSFER" && !referenceNumber.trim()) {
      toast.error("Vui lòng nhập số tham chiếu khi chuyển khoản.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/vat-settlements/${id}/confirm-payment`, {
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      toast.success("Đã ghi nhận thanh toán.");
      setPaymentDialogOpen(false);
      fetchSettlement();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkInvoiced(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceNumber.trim() || !invoiceDate) {
      toast.error("Vui lòng nhập đủ số hóa đơn và ngày hóa đơn.");
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/vat-settlements/${id}/mark-invoiced`, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
      });
      toast.success("Đã đánh dấu xuất hóa đơn.");
      setInvoiceDialogOpen(false);
      fetchSettlement();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`VAT Settlement — ${settlement.code}`}
        breadcrumbLabel={settlement.code}
        description={<VatSettlementStatusBadge status={settlement.status} />}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/debts")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(`/vat-settlements/${id}/print`, "_blank")}
            >
              <Printer className="mr-2 h-4 w-4" />
              In
            </Button>
            {canAct && settlement.status === "DRAFT" && (
              <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={busy}>Huỷ</Button>
            )}
            {canAct && settlement.status === "DRAFT" && (
              <Button onClick={handleSend} disabled={busy}>Gửi khách</Button>
            )}
            {canAct && settlement.status === "SENT" && (
              <Button onClick={() => setPaymentDialogOpen(true)} disabled={busy}>Ghi nhận thanh toán</Button>
            )}
            {canAct && settlement.status === "PAID" && (
              <Button onClick={() => setInvoiceDialogOpen(true)} disabled={busy}>Đánh dấu đã xuất hóa đơn</Button>
            )}
          </div>
        }
      />

      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Tổng tiền VAT</span>
            <span className="font-mono font-semibold">{formatMoney(Number(settlement.totalAmount))}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày tạo</span>
            <span>{new Date(settlement.createdAt).toLocaleDateString("vi-VN")}</span>
          </div>
          {settlement.payment && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Phiếu thu</span>
              <span className="font-mono text-xs">{settlement.payment.code}</span>
            </div>
          )}
          {settlement.invoiceNumber && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Số hóa đơn</span>
              <span>{settlement.invoiceNumber} {settlement.invoiceDate && `(${new Date(settlement.invoiceDate).toLocaleDateString("vi-VN")})`}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-semibold">Nguồn công nợ</h3>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Nguồn</th>
                <th className="text-left p-3">Khách hàng</th>
                <th className="text-right p-3">Phần VAT</th>
              </tr>
            </thead>
            <tbody>
              {settlement.items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 align-top">
                  <td className="p-3">
                    {item.receivable ? (
                      <Link href={`/debts/${item.receivable.id}`} className="font-mono text-xs text-primary underline underline-offset-2">
                        {item.receivable.salesOrder.code}
                      </Link>
                    ) : item.openingBalance ? (
                      <>
                        <Link href={`/customers/${item.openingBalance.customerId}`} className="font-mono text-xs text-primary underline underline-offset-2">
                          {item.openingBalance.code}
                        </Link>
                        <div className="text-xs text-muted-foreground font-normal">Công nợ đầu kỳ</div>
                        {item.lines.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {item.lines.map((l) => (
                              <li key={l.id}>
                                {l.productName} × {l.quantity} — {formatMoney(Number(l.subtotal))}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">{item.receivable?.salesOrder.customerName ?? customer?.name ?? "—"}</td>
                  <td className="p-3 text-right font-mono">{formatMoney(Number(item.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-semibold">Lịch sử</h3>
        <ul className="space-y-2">
          {settlement.timeline.map((t) => (
            <li key={t.id} className="text-sm flex gap-3">
              <span className="text-muted-foreground w-40 shrink-0">
                {new Date(t.createdAt).toLocaleString("vi-VN")}
              </span>
              <span>{TIMELINE_LABEL[t.action] ?? t.action}</span>
              {t.createdByName && <span className="text-muted-foreground">— {t.createdByName}</span>}
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ghi nhận thanh toán</DialogTitle></DialogHeader>
          <form id="vs-payment-form" onSubmit={handleConfirmPayment} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Số tiền: <span className="font-mono font-semibold text-foreground">{formatMoney(Number(settlement.totalAmount))}</span>
            </p>
            <div className="space-y-2">
              <Label>Phương thức *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "CASH")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Tiền mặt</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Chuyển khoản</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vs-reference">
                Số tham chiếu {paymentMethod === "BANK_TRANSFER" && "*"}
              </Label>
              <Input
                id="vs-reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                required={paymentMethod === "BANK_TRANSFER"}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Huỷ</Button>
            <Button type="submit" form="vs-payment-form" disabled={busy}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Đánh dấu đã xuất hóa đơn</DialogTitle></DialogHeader>
          <form id="vs-invoice-form" onSubmit={handleMarkInvoiced} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vs-invoice-number">Số hóa đơn *</Label>
              <Input id="vs-invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vs-invoice-date">Ngày hóa đơn *</Label>
              <Input id="vs-invoice-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Huỷ</Button>
            <Button type="submit" form="vs-invoice-form" disabled={busy}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Huỷ VAT Settlement"
        description="Chỉ huỷ được khi đang Nháp (chưa gửi khách, chưa có Payment nào gắn vào) — an toàn, không ảnh hưởng gì khác. Công nợ nguồn sẽ đủ điều kiện tạo VAT Settlement mới lại. Bạn có chắc chắn?"
        confirmLabel="Huỷ VAT Settlement"
        variant="destructive"
        onConfirm={handleCancel}
      />
    </div>
  );
}
