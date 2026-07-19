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
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

interface Product {
  id: string;
  code: string;
  name: string;
  status: string;
  productType: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  productionCenter: { id: string; code: string; name: string } | null;
  hasActivePricingRule?: boolean;
  hasActiveMaterialRequirement?: boolean;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProductTableProps {
  products: Product[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Nháp", variant: "outline" },
  ACTIVE: { label: "Đang bán", variant: "default" },
  INACTIVE: { label: "Ngừng bán", variant: "secondary" },
};

export function ProductTable({ products, meta, onPageChange }: ProductTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã SP</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Loại sản phẩm</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Xưởng sản xuất</TableHead>
              <TableHead className="text-center">Giá bán</TableHead>
              <TableHead className="text-center">Giá vốn</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const status = statusMap[p.status] ?? statusMap.DRAFT;
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/products/${p.id}`)}
                >
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.productType?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.unit?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.productionCenter?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.hasActivePricingRule && (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.hasActiveMaterialRequirement && (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {products.length} / {meta.total} sản phẩm
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
