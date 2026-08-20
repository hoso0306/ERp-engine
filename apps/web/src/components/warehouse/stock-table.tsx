"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared";
import { AlertTriangle } from "lucide-react";

interface MaterialStockRow {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minimumStock: number | null;
  isActive: boolean;
  unit: { id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface StockTableProps {
  materials: MaterialStockRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
}

// Dưới mức tối thiểu là Derived Data tính ở FE (CLAUDE.md mục 13) — chỉ so
// sánh khi minimumStock được cấu hình (khác null).
function isBelowMinimum(currentStock: number, minimumStock: number | null): boolean {
  if (minimumStock === null) return false;
  return Number(currentStock) < Number(minimumStock);
}

export function StockTable({ materials, meta, onPageChange, onLimitChange }: StockTableProps) {
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã vật tư</TableHead>
              <TableHead>Tên vật tư</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead className="text-right">Tồn hiện tại</TableHead>
              <TableHead className="text-right">Mức tối thiểu</TableHead>
              <TableHead className="text-center">Cảnh báo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => {
              const below = isBelowMinimum(m.currentStock, m.minimumStock);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.code}</TableCell>
                  <TableCell className="font-medium">
                    {m.name}
                    {!m.isActive && (
                      <Badge variant="secondary" className="ml-2 text-xs">Ngừng dùng</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.unit?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(m.currentStock).toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {m.minimumStock !== null
                      ? Number(m.minimumStock).toLocaleString("vi-VN", { maximumFractionDigits: 4 })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {below && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Dưới mức
                      </Badge>
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
          Hiển thị {materials.length} / {meta.total} vật tư
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
