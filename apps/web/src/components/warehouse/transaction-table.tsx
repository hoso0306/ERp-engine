"use client";

import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared";
import { useAuth } from "@/context/auth-context";

interface WarehouseTransactionRow {
  id: string;
  direction: string;
  transactionType: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  materialReceiptId: string | null;
  productionOrderId: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TransactionTableProps {
  transactions: WarehouseTransactionRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
}

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  MATERIAL_RECEIPT: "Nhập kho",
  MATERIAL_ISSUE: "Xuất sản xuất",
};

export function TransactionTable({ transactions, meta, onPageChange, onLimitChange }: TransactionTableProps) {
  const { hasPermission } = useAuth();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>Vật tư</TableHead>
              <TableHead className="text-center">Hướng</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead>Chứng từ nguồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{t.materialName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.materialCode}</div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={t.direction === "IN" ? "default" : "secondary"}>
                    {t.direction === "IN" ? "Nhập" : "Xuất"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{TRANSACTION_TYPE_LABEL[t.transactionType] ?? t.transactionType}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {t.direction === "IN" ? "+" : "-"}
                  {Number(t.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} {t.unit}
                </TableCell>
                <TableCell className="text-sm">
                  {t.materialReceiptId && (
                    <Link href={`/warehouse/receipts/${t.materialReceiptId}`} className="text-primary underline underline-offset-2">
                      Xem phiếu nhập
                    </Link>
                  )}
                  {t.productionOrderId && (
                    hasPermission("production.view") ? (
                      <Link href={`/production/${t.productionOrderId}`} className="text-primary underline underline-offset-2">
                        Xem phiếu SX
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Phiếu sản xuất</span>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {transactions.length} / {meta.total} giao dịch
        </p>
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={onPageChange}
          limit={onLimitChange ? meta.limit : undefined}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}
