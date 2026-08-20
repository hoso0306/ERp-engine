"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/shared";
import { ProductionOrderStatusBadge } from "@/components/sales-order/production-order-status-badge";

interface ProductionOrderRow {
  id: string;
  code: string;
  productionCenterName: string;
  status: string;
  salesOrder: { id: string; code: string; customerName: string; ownerName: string | null };
  _count: { items: number };
  isPrinted: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "—";
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProductionTableProps {
  orders: ProductionOrderRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
  // In hàng loạt (009-in-phieu-san-xuat.md Việc 6) — chọn nhiều dòng để in
  // gộp nhiều phiếu A5. Optional để không phá vỡ chỗ khác đang dùng bảng này
  // mà không cần tính năng chọn.
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
}

export function ProductionTable({
  orders,
  meta,
  onPageChange,
  onLimitChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ProductionTableProps) {
  const router = useRouter();
  const selectable = !!selectedIds && !!onToggleSelect && !!onToggleSelectAll;
  const allSelected = selectable && orders.length > 0 && orders.every((po) => selectedIds!.has(po.id));

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleSelectAll!(orders.map((po) => po.id))}
                  />
                </TableHead>
              )}
              <TableHead className="w-32">Mã phiếu</TableHead>
              <TableHead>Đơn hàng</TableHead>
              <TableHead>Xưởng</TableHead>
              <TableHead className="text-center">Số sản phẩm</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>Ngày bắt đầu SX</TableHead>
              <TableHead>Người phụ trách</TableHead>
              <TableHead className="text-center">Đã in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer"
                onClick={() => router.push(`/production/${po.id}`)}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds!.has(po.id)}
                      onCheckedChange={() => onToggleSelect!(po.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs font-medium">{po.code}</TableCell>
                <TableCell>
                  <div className="font-medium font-mono text-xs">{po.salesOrder.code}</div>
                  <div className="text-xs text-muted-foreground">{po.salesOrder.customerName}</div>
                </TableCell>
                <TableCell className="text-sm">{po.productionCenterName}</TableCell>
                <TableCell className="text-center text-sm">{po._count.items}</TableCell>
                <TableCell className="text-center">
                  <ProductionOrderStatusBadge status={po.status} />
                </TableCell>
                <TableCell className="text-sm">{fmtDate(po.createdAt)}</TableCell>
                <TableCell className="text-sm">{fmtDate(po.startedAt)}</TableCell>
                <TableCell className="text-sm">{po.salesOrder.ownerName ?? "—"}</TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={po.isPrinted} disabled title={po.isPrinted ? "Đã in" : "Chưa in"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {orders.length} / {meta.total} phiếu sản xuất
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
