"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loading, ErrorState, EmptyState, DateRangeFilter } from "@/components/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/debt/risk-badge";
import { PaymentStatusBadge } from "@/components/sales-order/payment-status-badge";
import { PaymentListTable, type PaymentListRow } from "@/components/debt/payment-list-table";
import { apiGet } from "@/lib/api";

type DebtSubTab = "progress" | "payments";
type DateField = "createdAt" | "dueDate";

interface ProgressPayment {
  code: string;
  paymentDate: string;
  type: string;
}

interface ReceivableRow {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  daysOverdue: number | null;
  riskLevel: string | null;
  salesOrder: { code: string; paymentStatus: string };
  // 1 đơn có thể được thu nhiều lần (thanh toán một phần) — danh sách phiếu
  // thu đã cấn cho đúng đơn này, sắp theo thời gian.
  payments: ProgressPayment[];
}

// Công nợ đầu kỳ (rà soát tab Công nợ, 11/08/2026: "coi Công nợ đầu kỳ như 1
// đơn cần thanh toán") — hiện chung bảng Tiến trình thanh toán với Receivable.
// Không có paymentStatus/dueDate sẵn (khác SalesOrder) nên tính ở FE từ
// amount/remainingAmount, cùng công thức DebtService.computePaymentStatus().
interface OpeningBalanceRow {
  id: string;
  code: string;
  amount: number;
  remainingAmount: number;
  payments: ProgressPayment[];
}

function computeOpeningBalancePaymentStatus(amount: number, remainingAmount: number): string {
  if (remainingAmount <= 0) return "PAID";
  if (remainingAmount >= amount) return "UNPAID";
  return "PARTIALLY_PAID";
}

function PaymentsCell({ payments }: { payments: ProgressPayment[] }) {
  if (payments.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1">
      {payments.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm">
          {new Date(p.paymentDate).toLocaleDateString("vi-VN")}
          {p.type === "REVERSAL" && (
            <Badge variant="destructive" className="text-[10px]">Hoàn tác</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function PaymentCodesCell({ payments }: { payments: ProgressPayment[] }) {
  if (payments.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1">
      {payments.map((p, i) => (
        <div key={i} className="font-mono text-xs">{p.code}</div>
      ))}
    </div>
  );
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CustomerDebtTabProps {
  customerId: string;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

const EMPTY_META: Meta = { total: 0, page: 1, limit: 10, totalPages: 1 };

// Tab "Công nợ" trong trang chi tiết khách hàng (rà soát tab Công nợ,
// 11/08/2026) — 2 tab con: "Tiến trình thanh toán" (toàn bộ đơn của khách,
// kể cả đã thu đủ, GET /receivables?customerId= mới mở rộng) và "Phiếu thu"
// (GET /payments?customerId= mới thêm). Cả 2 lọc chung theo khoảng ngày +
// chọn mốc ngày (ngày tạo/ngày đến hạn) chỉ áp dụng cho tab Tiến trình.
export function CustomerDebtTab({ customerId }: CustomerDebtTabProps) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<DebtSubTab>("progress");
  const [dateField, setDateField] = useState<DateField>("createdAt");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [receivableMeta, setReceivableMeta] = useState<Meta>(EMPTY_META);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentListRow[]>([]);
  const [paymentMeta, setPaymentMeta] = useState<Meta>(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Công nợ đầu kỳ luôn hiện đủ (không phân trang/lọc ngày) — số dòng của 1
  // khách hàng thường rất ít, khác Receivable có thể nhiều nên mới cần phân trang.
  const fetchOpeningBalances = useCallback(async () => {
    try {
      const data = await apiGet<OpeningBalanceRow[]>(`/opening-balances/by-customer/${customerId}`);
      setOpeningBalances(data);
    } catch {
      setOpeningBalances([]);
    }
  }, [customerId]);

  useEffect(() => {
    fetchOpeningBalances();
  }, [fetchOpeningBalances]);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("customerId", customerId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (dateField === "dueDate") params.set("dateField", "dueDate");
      params.set("page", String(page));
      params.set("limit", "10");
      const json = await apiGet<{ data: ReceivableRow[]; meta: Meta }>(`/receivables?${params}`);
      setReceivables(json.data);
      setReceivableMeta(json.meta);
    } catch {
      setError("Không thể tải tiến trình thanh toán.");
    } finally {
      setLoading(false);
    }
  }, [customerId, from, to, dateField, page]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("customerId", customerId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      params.set("limit", "10");
      const json = await apiGet<{ data: PaymentListRow[]; meta: Meta }>(`/payments?${params}`);
      setPayments(json.data);
      setPaymentMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách phiếu thu.");
    } finally {
      setLoading(false);
    }
  }, [customerId, from, to, page]);

  useEffect(() => {
    setPage(1);
  }, [subTab, from, to, dateField]);

  useEffect(() => {
    if (subTab === "progress") fetchProgress();
    else fetchPayments();
  }, [subTab, fetchProgress, fetchPayments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={subTab} onValueChange={(v) => setSubTab((v as DebtSubTab) ?? "progress")}>
          <TabsList>
            <TabsTrigger value="progress">Tiến trình thanh toán</TabsTrigger>
            <TabsTrigger value="payments">Phiếu thu</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {subTab === "progress" && (
            <Select value={dateField} onValueChange={(v) => setDateField((v as DateField) ?? "createdAt")}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Lọc theo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Theo ngày tạo</SelectItem>
                <SelectItem value="dueDate">Theo ngày đến hạn</SelectItem>
              </SelectContent>
            </Select>
          )}
          <DateRangeFilter label="Khoảng ngày" dateFrom={from} onDateFromChange={setFrom} dateTo={to} onDateToChange={setTo} />
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={subTab === "progress" ? fetchProgress : fetchPayments} />}

      {!loading && !error && subTab === "progress" && (
        receivables.length === 0 && openingBalances.length === 0 ? (
          <EmptyState
            title="Không có công nợ"
            description={from || to ? "Không có đơn hàng nào khớp khoảng ngày đã chọn." : "Khách hàng này chưa có công nợ nào."}
          />
        ) : (
          <div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đơn / Công nợ đầu kỳ</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead className="text-right">Đã thu</TableHead>
                    <TableHead className="text-right">Còn lại</TableHead>
                    <TableHead>Ngày thanh toán</TableHead>
                    <TableHead>Phiếu thu tương ứng</TableHead>
                    <TableHead>Thanh toán</TableHead>
                    <TableHead>Hạn thanh toán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openingBalances.map((b) => {
                    const paidAmount = Number(b.amount) - Number(b.remainingAmount);
                    const paymentStatus = computeOpeningBalancePaymentStatus(
                      Number(b.amount),
                      Number(b.remainingAmount),
                    );
                    return (
                      <TableRow key={`ob-${b.id}`}>
                        <TableCell className="font-mono text-xs font-medium">
                          {b.code}
                          <Badge variant="secondary" className="ml-2 text-[10px] font-sans">
                            Công nợ đầu kỳ
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatMoney(Number(b.amount))}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">{formatMoney(paidAmount)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">{formatMoney(Number(b.remainingAmount))}</TableCell>
                        <TableCell><PaymentsCell payments={b.payments} /></TableCell>
                        <TableCell><PaymentCodesCell payments={b.payments} /></TableCell>
                        <TableCell><PaymentStatusBadge status={paymentStatus} /></TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">—</span></TableCell>
                      </TableRow>
                    );
                  })}
                  {receivables.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/debts/${r.id}`)}>
                      <TableCell className="font-mono text-xs font-medium">{r.salesOrder.code}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatMoney(Number(r.totalAmount))}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600">{formatMoney(Number(r.paidAmount))}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-destructive">{formatMoney(Number(r.remainingAmount))}</TableCell>
                      <TableCell><PaymentsCell payments={r.payments} /></TableCell>
                      <TableCell><PaymentCodesCell payments={r.payments} /></TableCell>
                      <TableCell><PaymentStatusBadge status={r.salesOrder.paymentStatus} /></TableCell>
                      <TableCell>
                        {r.dueDate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{new Date(r.dueDate).toLocaleDateString("vi-VN")}</span>
                            <RiskBadge riskLevel={r.riskLevel} />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">— (chưa giao hàng)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-2 py-4">
              <p className="text-sm text-muted-foreground">
                Hiển thị {receivables.length + openingBalances.length} / {receivableMeta.total + openingBalances.length} mục
                {openingBalances.length > 0 && ` (gồm ${openingBalances.length} Công nợ đầu kỳ)`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={receivableMeta.page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{receivableMeta.page} / {receivableMeta.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={receivableMeta.page >= receivableMeta.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )
      )}

      {!loading && !error && subTab === "payments" && (
        <PaymentListTable
          rows={payments}
          meta={paymentMeta}
          onPageChange={setPage}
          onReversed={fetchPayments}
          showCustomer={false}
        />
      )}
    </div>
  );
}
