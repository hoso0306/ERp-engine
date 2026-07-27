"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VatSettlementStatusBadge } from "./vat-settlement-status-badge";

interface VatSettlementRow {
  id: string;
  code: string;
  customerId: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface VatSettlementTableProps {
  settlements: VatSettlementRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function VatSettlementTable({ settlements, meta, onPageChange }: VatSettlementTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã</TableHead>
              <TableHead className="text-right">Tổng VAT</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() => router.push(`/vat-settlements/${s.id}`)}
              >
                <TableCell className="font-mono text-xs font-medium">{s.code}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatMoney(Number(s.totalAmount))}</TableCell>
                <TableCell><VatSettlementStatusBadge status={s.status} /></TableCell>
                <TableCell className="text-sm">{new Date(s.createdAt).toLocaleDateString("vi-VN")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {settlements.length} / {meta.total} Quyết toán VAT
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
