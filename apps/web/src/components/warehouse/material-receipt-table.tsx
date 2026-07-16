"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MaterialReceiptItemRow {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
}

interface MaterialReceiptRow {
  id: string;
  code: string;
  items: MaterialReceiptItemRow[];
  supplierName: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MaterialReceiptTableProps {
  receipts: MaterialReceiptRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

export function MaterialReceiptTable({ receipts, meta, onPageChange }: MaterialReceiptTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã phiếu</TableHead>
              <TableHead>Vật tư</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => router.push(`/warehouse/receipts/${r.id}`)}
              >
                <TableCell className="font-mono text-xs font-medium">{r.code}</TableCell>
                <TableCell>
                  {r.items.length === 1 ? (
                    <>
                      <div className="font-medium">{r.items[0].materialName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.items[0].materialCode}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">{r.items[0]?.materialName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        + {r.items.length - 1} vật tư khác
                      </div>
                    </>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.supplierName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {receipts.length} / {meta.total} phiếu nhập
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
