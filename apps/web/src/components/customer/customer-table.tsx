"use client";

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

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  province: string | null;
  district: string | null;
  priority: string;
  status: string;
  customerGroup: { id: string; name: string } | null;
  deliveryRoute: { id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CustomerTableProps {
  customers: Customer[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

const priorityMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  LOW: { label: "Thấp", variant: "secondary" },
  MEDIUM: { label: "TB", variant: "default" },
  HIGH: { label: "Cao", variant: "destructive" },
};

const statusMap: Record<string, { label: string; variant: "default" | "secondary" }> = {
  ACTIVE: { label: "Hoạt động", variant: "default" },
  INACTIVE: { label: "Ngừng", variant: "secondary" },
};

export function CustomerTable({ customers, meta, onPageChange }: CustomerTableProps) {
  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã KH</TableHead>
              <TableHead>Tên khách hàng</TableHead>
              <TableHead>Số điện thoại</TableHead>
              <TableHead>Khu vực</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>Tuyến</TableHead>
              <TableHead className="text-center">Ưu tiên</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const priority = priorityMap[c.priority] ?? priorityMap.MEDIUM;
              const status = statusMap[c.status] ?? statusMap.ACTIVE;

              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[c.district, c.province].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.customerGroup?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.deliveryRoute?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={priority.variant}>{priority.label}</Badge>
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
          Hiển thị {customers.length} / {meta.total} khách hàng
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
