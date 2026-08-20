"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiPatch, ApiError } from "@/lib/api";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  deletedAt: string;
  customerGroup: { id: string; name: string } | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Props {
  customers: Customer[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
  onRestored: () => void;
}

export function CustomerDeletedTable({ customers, meta, onPageChange, onLimitChange, onRestored }: Props) {
  async function handleRestore(id: string, name: string) {
    try {
      await apiPatch(`/customers/${id}/restore`);
      toast.success(`Đã khôi phục "${name}".`);
      onRestored();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    }
  }

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã KH</TableHead>
              <TableHead>Tên khách hàng</TableHead>
              <TableHead>Số điện thoại</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead>Xoá lúc</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.customerGroup?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(c.deletedAt).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(c.id, c.name)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Khôi phục
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-sm text-muted-foreground">
            {meta.total} khách hàng đã xoá
          </p>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
            limit={onLimitChange ? meta.limit : undefined}
            onLimitChange={onLimitChange}
          />
        </div>
      )}
    </div>
  );
}
