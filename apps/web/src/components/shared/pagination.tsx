"use client";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang — optional, bảng nào không cần đổi limit thì bỏ qua
  // cả 2 prop này (giữ hành vi cũ, limit cố định).
  limit?: number;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

// Cửa sổ số trang hiển thị quanh trang hiện tại — luôn giữ trang đầu/cuối,
// chèn "…" khi có khoảng trống, tránh hiện hàng chục/hàng trăm nút khi
// totalPages lớn (vd 1000 đơn / 10 dòng = 100 trang).
function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("ellipsis");
    result.push(sorted[i]);
  }
  return result;
}

// Component Pagination dùng chung toàn app (chốt 20/08/2026, thay cho kiểu
// "< 1/3 >" lặp lại ở 17 bảng trước đó) — nút số trang bấm nhảy thẳng, kèm ô
// chọn số dòng/trang tuỳ chọn.
export function Pagination({
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
  limitOptions = [10, 20, 50],
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const pages = pageWindow(page, safeTotalPages);
  const showLimitSelect = limit !== undefined && !!onLimitChange;

  return (
    <div className="flex items-center gap-3">
      {showLimitSelect && (
        <Select value={String(limit)} onValueChange={(v) => v && onLimitChange!(Number(v))}>
          <SelectTrigger size="sm" className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {limitOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / trang</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="min-w-9"
              onClick={() => onPageChange(p)}
              disabled={p === page}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safeTotalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
