"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared";
import { AlertCircle } from "lucide-react";
import { SalesOrderStatusBadge } from "./sales-order-status-badge";
import { PaymentStatusBadge } from "./payment-status-badge";

interface SalesOrderRow {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  totalProductionOrders: number;
  completedProductionOrders: number;
  expectedDeliveryDate: string | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SalesOrderTableProps {
  orders: SalesOrderRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Trễ giao = qua ngày giao dự kiến mà đơn chưa Đã giao/Đã huỷ (order.md — Derived
// Data tính ở FE, không lưu thêm field mới).
function isOverdue(expectedDeliveryDate: string | null, status: string): boolean {
  if (!expectedDeliveryDate) return false;
  if (status === "DELIVERED" || status === "CANCELLED") return false;
  return new Date(expectedDeliveryDate) < new Date(new Date().toDateString());
}

export function SalesOrderTable({ orders, meta, onPageChange, onLimitChange }: SalesOrderTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã đơn</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead className="text-center">Tiến độ SX</TableHead>
              <TableHead className="text-center">Thanh toán</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead>Ngày giao dự kiến</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const overdue = isOverdue(o.expectedDeliveryDate, o.status);
              return (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/orders/${o.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium">{o.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-muted-foreground">{o.customerPhone}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMoney(Number(o.totalAmount))}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {o.completedProductionOrders}/{o.totalProductionOrders}
                  </TableCell>
                  <TableCell className="text-center">
                    <PaymentStatusBadge status={o.paymentStatus} />
                  </TableCell>
                  <TableCell className="text-center">
                    <SalesOrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell>
                    {o.expectedDeliveryDate ? (
                      <span className={overdue ? "text-destructive flex items-center gap-1 text-sm" : "text-sm"}>
                        {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                        {new Date(o.expectedDeliveryDate).toLocaleDateString("vi-VN")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {orders.length} / {meta.total} đơn hàng
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
