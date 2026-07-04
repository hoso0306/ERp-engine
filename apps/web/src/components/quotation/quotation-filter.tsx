"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface QuotationFilterProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
}

export function QuotationFilter({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: QuotationFilterProps) {
  return (
    <div className="flex gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo mã BG, tên / SĐT khách hàng..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={status} onValueChange={(v) => onStatusChange(v ?? "all")}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả trạng thái</SelectItem>
          <SelectItem value="DRAFT">Nháp</SelectItem>
          <SelectItem value="SENT">Đã gửi</SelectItem>
          <SelectItem value="APPROVED">Đã duyệt</SelectItem>
          <SelectItem value="CANCELLED">Đã huỷ</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
