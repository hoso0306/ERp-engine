"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { RecoveryInventoryStatusBadge } from "./recovery-inventory-status-badge";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

export interface RecoveryInventoryRow {
  id: string;
  code: string;
  productCode: string;
  productName: string;
  productParameters: Parameter[] | null;
  quantity: number;
  location: string | null;
  status: string;
  createdFromReturnCode: string;
  imageUrl: string | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RecoveryInventoryTableProps {
  items: RecoveryInventoryRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  canMarkUsed: boolean;
  canDispose: boolean;
  canUpdate: boolean;
  onMarkUsed: (item: RecoveryInventoryRow) => void;
  onDispose: (item: RecoveryInventoryRow) => void;
  onEdit: (item: RecoveryInventoryRow) => void;
}

export function RecoveryInventoryTable({
  items,
  meta,
  onPageChange,
  canMarkUsed,
  canDispose,
  canUpdate,
  onMarkUsed,
  onDispose,
  onEdit,
}: RecoveryInventoryTableProps) {
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã</TableHead>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const parameters = item.productParameters ?? [];
              const isAvailable = item.status === "AVAILABLE";
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-medium">{item.code}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
                    {parameters.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                        {parameters.map((p) => `${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`).join(", ")}
                      </div>
                    )}
                    {item.imageUrl && (
                      <a
                        href={item.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 mt-0.5"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Xem ảnh
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-sm">{item.location ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.createdFromReturnCode}
                  </TableCell>
                  <TableCell className="text-center">
                    <RecoveryInventoryStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {isAvailable && canMarkUsed && (
                        <Button variant="outline" size="sm" onClick={() => onMarkUsed(item)}>
                          Đã sử dụng
                        </Button>
                      )}
                      {isAvailable && canDispose && (
                        <Button variant="outline" size="sm" onClick={() => onDispose(item)}>
                          Thanh lý
                        </Button>
                      )}
                      {canUpdate && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
                          Sửa
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {items.length} / {meta.total} hàng thu hồi
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
