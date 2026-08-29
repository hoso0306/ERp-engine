"use client";

import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Pagination } from "@/components/shared";
import { useAuth } from "@/context/auth-context";

export interface DebtAdjustmentHistoryRow {
  id: string;
  type: "RETURN" | "MANUAL" | "OPENING_BALANCE";
  amount: number;
  reason: string | null;
  returnId: string | null;
  returnCode: string | null;
  openingBalanceCode: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DebtAdjustmentHistoryTableProps {
  rows: DebtAdjustmentHistoryRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

function formatMoney(amount: number) {
  const sign = amount > 0 ? "+" : "";
  return sign + new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function TypeBadge({ type }: { type: DebtAdjustmentHistoryRow["type"] }) {
  if (type === "RETURN") {
    return <Badge variant="secondary">Giảm trừ do hoàn hàng</Badge>;
  }
  if (type === "OPENING_BALANCE") {
    return <Badge variant="outline">Tạo công nợ đầu kỳ</Badge>;
  }
  return <Badge variant="secondary">Giảm trừ công nợ</Badge>;
}

// Tab "Lịch sử giảm trừ/công nợ đầu kỳ" trong trang chi tiết khách hàng (rà
// soát nghiệp vụ 27/08/2026) — gộp 3 loại: giảm trừ do hoàn hàng, giảm trừ
// công nợ độc lập (cả 2 đọc từ DebtAdjustment), và tăng công nợ do tạo Công
// nợ đầu kỳ (OpeningBalanceTimeline). Xem DebtService.getDebtAdjustmentHistoryByCustomer().
export function DebtAdjustmentHistoryTable({
  rows,
  meta,
  onPageChange,
  onLimitChange,
}: DebtAdjustmentHistoryTableProps) {
  const { hasPermission } = useAuth();
  const canViewReturn = hasPermission("return.view");

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Chưa có lịch sử"
        description="Khách hàng này chưa có lần giảm trừ công nợ hoặc công nợ đầu kỳ nào."
      />
    );
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Lý do / Mã chứng từ</TableHead>
              <TableHead>Người tạo</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.type}-${r.id}`}>
                <TableCell><TypeBadge type={r.type} /></TableCell>
                <TableCell
                  className={`text-right font-mono text-sm ${r.amount < 0 ? "text-destructive" : "text-green-600"}`}
                >
                  {formatMoney(r.amount)}
                </TableCell>
                <TableCell className="text-sm">
                  {r.type === "OPENING_BALANCE" ? (
                    <span className="font-mono text-xs">{r.openingBalanceCode}</span>
                  ) : (
                    <div className="space-y-0.5">
                      <p>{r.reason}</p>
                      {r.returnCode && (
                        canViewReturn && r.returnId ? (
                          <Link
                            href={`/returns/${r.returnId}`}
                            className="font-mono text-xs text-primary underline underline-offset-2"
                          >
                            Phiếu hoàn {r.returnCode}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            Phiếu hoàn {r.returnCode}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{r.createdByName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">Hiển thị {rows.length} / {meta.total} mục</p>
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={onPageChange}
          limit={meta.limit}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}
