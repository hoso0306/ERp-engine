"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Material {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  unit: { id: string; name: string } | null;
  currentStock: number | string;
  minimumStock: number | string | null;
}

function formatQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MaterialTableProps {
  materials: Material[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

export function MaterialTable({ materials, meta, onPageChange }: MaterialTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã VT</TableHead>
              <TableHead>Tên vật tư</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead className="text-right">Tồn kho</TableHead>
              <TableHead className="text-right">Tồn tối thiểu</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((m) => {
              const stock = Number(m.currentStock);
              const minStock = m.minimumStock !== null ? Number(m.minimumStock) : null;
              const belowMinimum = minStock !== null && stock < minStock;
              return (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => router.push(`/materials/${m.id}`)}
              >
                <TableCell className="font-mono text-xs">{m.code}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.unit?.name ?? "—"}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${belowMinimum ? "text-destructive font-semibold" : ""}`}>
                  {formatQty(stock)}
                  {belowMinimum && (
                    <Badge variant="destructive" className="ml-2 text-[10px]">Dưới mức</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {minStock !== null ? formatQty(minStock) : "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={m.isActive ? "default" : "secondary"}>
                    {m.isActive ? "Đang dùng" : "Ngừng dùng"}
                  </Badge>
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= meta.totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
