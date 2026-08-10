"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronLeft, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { RiskBadge, computeDaysOverdue, computeRiskLevel } from "./risk-badge";
import { AllocatePaymentDialog } from "./allocate-payment-dialog";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import type { CustomerOption } from "@/components/quotation/customer-typeahead";

interface CustomerDebtRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  receivableCount: number;
  totalRemaining: number;
  totalRemainingBeforeVat: number;
  daysOverdue: number | null;
  riskLevel: string | null;
  debtLimit: number;
  creditExceeded: boolean;
}

// Đủ field để hiển thị trước/sau VAT + đã thu/tổng, giống ReceivableTable
// (rà soát tab Công nợ, chốt 26/07/2026) — API open-by-customer đã trả sẵn
// đầy đủ scalar field này (không select giới hạn), không cần đổi backend.
interface OpenOrderRow {
  id: string;
  totalAmount: number;
  totalAmountBeforeVat: number;
  paidAmount: number;
  remainingAmount: number;
  remainingAmountBeforeVat: number;
  dueDate: string | null;
  salesOrder: { code: string };
}

// opening-balance.md — "Tổng còn phải thu" (totalRemaining) giờ cộng thêm
// Công nợ đầu kỳ, nên phần xổ ra phải hiện thêm nguồn này để khớp tổng —
// khác OpenOrderRow: không có dueDate/salesOrder (không có Sales Order gốc).
interface OpeningBalanceRow {
  id: string;
  code: string;
  amountBeforeVat: number;
  amount: number;
  remainingAmountBeforeVat: number;
  remainingAmount: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ReceivableByCustomerTableProps {
  rows: CustomerDebtRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Gọi lại sau khi ghi nhận thanh toán từ nút trên từng dòng — để tổng công
  // nợ hiển thị cập nhật ngay (rà soát tab Công nợ, chốt 27/07/2026).
  onPaymentSaved?: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Bấm 1 dòng khách hàng → xổ ra các đơn gốc, tái dùng đúng API đã có sẵn
// GET /receivables/open-by-customer/:customerId (023-cong-no-payment-allocation-fifo,
// vốn phục vụ preview FIFO) thay vì làm API riêng cho phần xổ ra này.
export function ReceivableByCustomerTable({
  rows,
  meta,
  onPageChange,
  onPaymentSaved,
}: ReceivableByCustomerTableProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canPay = hasPermission("debt.create-payment");
  const canViewCustomer = hasPermission("customer.view");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ordersByCustomer, setOrdersByCustomer] = useState<Record<string, OpenOrderRow[]>>({});
  const [openingBalancesByCustomer, setOpeningBalancesByCustomer] = useState<
    Record<string, OpeningBalanceRow[]>
  >({});
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<CustomerOption | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);

  const loadCustomerBreakdown = async (customerId: string) => {
    setLoadingCustomerId(customerId);
    try {
      const [orders, balances] = await Promise.all([
        apiGet<OpenOrderRow[]>(`/receivables/open-by-customer/${customerId}`),
        apiGet<OpeningBalanceRow[]>(`/opening-balances/by-customer/${customerId}`),
      ]);
      setOrdersByCustomer((prev) => ({ ...prev, [customerId]: orders }));
      setOpeningBalancesByCustomer((prev) => ({
        ...prev,
        // Chỉ giữ dòng còn mở — khớp đúng phần đã cộng vào totalRemaining
        // (OpeningBalanceService.sumOpenByCustomerIds() chỉ lấy remainingAmount > 0).
        [customerId]: balances.filter((b) => Number(b.remainingAmount) > 0),
      }));
    } catch {
      setOrdersByCustomer((prev) => ({ ...prev, [customerId]: [] }));
      setOpeningBalancesByCustomer((prev) => ({ ...prev, [customerId]: [] }));
    } finally {
      setLoadingCustomerId(null);
    }
  };

  const toggleExpand = async (customerId: string) => {
    if (expanded === customerId) {
      setExpanded(null);
      return;
    }
    setExpanded(customerId);
    if (!ordersByCustomer[customerId]) {
      await loadCustomerBreakdown(customerId);
    }
  };

  // Nút "Ghi nhận thanh toán" trên từng dòng — khoá sẵn khách hàng (khớp
  // context đang xem, không cần gõ tìm lại như dialog chung ở đầu trang).
  // AllocatePaymentDialog cần CustomerOption đầy đủ (có `code`) — CustomerDebtRow
  // không có sẵn field này nên phải fetch riêng lúc bấm.
  async function openPayDialog(row: CustomerDebtRow) {
    setPayLoading(row.customerId);
    try {
      const customer = await apiGet<CustomerOption>(`/customers/${row.customerId}`);
      setPayTarget(customer);
    } catch {
      // im lặng — AllocatePaymentDialog không mở nếu fetch lỗi
    } finally {
      setPayLoading(null);
    }
  }

  function handlePaymentSaved() {
    const customerId = payTarget?.id;
    setPayTarget(null);
    onPaymentSaved?.();
    // Nếu dòng khách này đang xổ ra, tải lại phần chi tiết cho khớp số mới.
    if (customerId && expanded === customerId) {
      loadCustomerBreakdown(customerId);
    }
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Đơn còn nợ</TableHead>
              <TableHead className="text-right">Tổng còn phải thu</TableHead>
              <TableHead>Nợ lâu nhất</TableHead>
              <TableHead>Hạn mức</TableHead>
              {canViewCustomer && <TableHead>Xem chi tiết</TableHead>}
              {canPay && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <Fragment key={r.customerId}>
                <TableRow className="cursor-pointer" onClick={() => toggleExpand(r.customerId)}>
                  <TableCell>
                    {expanded === r.customerId ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-muted-foreground">{r.customerPhone}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.receivableCount}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">
                    {formatMoney(r.totalRemaining)}
                    <div className="text-xs text-muted-foreground font-normal">
                      trước VAT: {formatMoney(r.totalRemainingBeforeVat)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RiskBadge riskLevel={r.riskLevel} />
                  </TableCell>
                  <TableCell>
                    {r.creditExceeded ? (
                      <span className="text-xs font-medium text-destructive">
                        Vượt {formatMoney(r.totalRemaining - r.debtLimit)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {canViewCustomer && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/customers/${r.customerId}?tab=debt`)}
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Xem chi tiết
                      </Button>
                    </TableCell>
                  )}
                  {canPay && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={payLoading === r.customerId}
                        onClick={() => openPayDialog(r)}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>

                {expanded === r.customerId && (
                  <TableRow>
                    <TableCell
                      colSpan={6 + (canViewCustomer ? 1 : 0) + (canPay ? 1 : 0)}
                      className="bg-muted/30 p-0"
                    >
                      <div className="px-4 py-3">
                        {loadingCustomerId === r.customerId ? (
                          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Đang tải...
                          </div>
                        ) : (
                          <div className="rounded-md border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Mã đơn</TableHead>
                                  <TableHead className="text-right">Tổng tiền</TableHead>
                                  <TableHead className="text-right">Đã thu</TableHead>
                                  <TableHead className="text-right">Còn lại</TableHead>
                                  <TableHead>Hạn thanh toán</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(ordersByCustomer[r.customerId] ?? []).map((o) => {
                                  const daysOverdue = computeDaysOverdue(o.dueDate);
                                  const riskLevel = computeRiskLevel(daysOverdue);
                                  return (
                                    <TableRow
                                      key={o.id}
                                      className="cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/debts/${o.id}`);
                                      }}
                                    >
                                      <TableCell className="font-mono text-xs font-medium">
                                        {o.salesOrder.code}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {formatMoney(Number(o.totalAmount))}
                                        <div className="text-xs text-muted-foreground font-normal">
                                          trước VAT: {formatMoney(Number(o.totalAmountBeforeVat))}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm text-green-600">
                                        {formatMoney(Number(o.paidAmount))}
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm text-destructive">
                                        {formatMoney(Number(o.remainingAmount))}
                                        <div className="text-xs text-muted-foreground font-normal">
                                          trước VAT: {formatMoney(Number(o.remainingAmountBeforeVat))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        {o.dueDate ? (
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">{new Date(o.dueDate).toLocaleDateString("vi-VN")}</span>
                                            <RiskBadge riskLevel={riskLevel} />
                                          </div>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {loadingCustomerId !== r.customerId &&
                          (openingBalancesByCustomer[r.customerId] ?? []).length > 0 && (
                            <div className="mt-3 rounded-md border bg-background">
                              <div className="px-3 pt-2 text-xs font-medium text-muted-foreground">
                                Công nợ đầu kỳ
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Mã</TableHead>
                                    <TableHead className="text-right">Số tiền gốc</TableHead>
                                    <TableHead className="text-right">Còn lại</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(openingBalancesByCustomer[r.customerId] ?? []).map((b) => (
                                    <TableRow key={b.id}>
                                      <TableCell className="font-mono text-xs font-medium">{b.code}</TableCell>
                                      <TableCell className="text-right font-mono text-sm">
                                        {formatMoney(Number(b.amount))}
                                        <div className="text-xs text-muted-foreground font-normal">
                                          trước VAT: {formatMoney(Number(b.amountBeforeVat))}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-mono text-sm text-destructive">
                                        {formatMoney(Number(b.remainingAmount))}
                                        <div className="text-xs text-muted-foreground font-normal">
                                          trước VAT: {formatMoney(Number(b.remainingAmountBeforeVat))}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {rows.length} / {meta.total} khách hàng
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{meta.page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AllocatePaymentDialog
        key={payTarget?.id}
        open={!!payTarget}
        onOpenChange={(open) => !open && setPayTarget(null)}
        fixedCustomer={payTarget ?? undefined}
        onSaved={handlePaymentSaved}
      />
    </div>
  );
}
