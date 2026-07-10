"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReturnStatusBadge } from "./return-status-badge";

interface ReturnRow {
  id: string;
  code: string;
  salesOrderId: string;
  salesOrderCode: string;
  customerName: string;
  returnDate: string;
  status: string;
  _count: { items: number };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ReturnTableProps {
  returns: ReturnRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  canViewOrder: boolean;
}

export function ReturnTable({ returns, meta, onPageChange, canViewOrder }: ReturnTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã phiếu</TableHead>
              <TableHead>Đơn hàng gốc</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-center">Số dòng SP</TableHead>
              <TableHead>Ngày trả</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => router.push(`/returns/${r.id}`)}
              >
                <TableCell className="font-mono text-xs font-medium">{r.code}</TableCell>
                <TableCell>
                  {canViewOrder ? (
                    <a
                      href={`/orders/${r.salesOrderId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-xs text-primary underline underline-offset-2"
                    >
                      {r.salesOrderCode}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{r.salesOrderCode}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{r.customerName}</TableCell>
                <TableCell className="text-center text-sm">{r._count.items}</TableCell>
                <TableCell className="text-sm">
                  {new Date(r.returnDate).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell className="text-center">
                  <ReturnStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {returns.length} / {meta.total} phiếu hoàn
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
    </div>
  );
}
