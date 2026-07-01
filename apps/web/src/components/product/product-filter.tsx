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

interface FilterOption {
  id: string;
  name: string;
}

interface ProductFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string | null) => void;
  productTypes: FilterOption[];
  productTypeId: string;
  onProductTypeChange: (value: string | null) => void;
}

export function ProductFilter({
  search,
  onSearchChange,
  status,
  onStatusChange,
  productTypes,
  productTypeId,
  onProductTypeChange,
}: ProductFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên, mã sản phẩm..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả trạng thái</SelectItem>
          <SelectItem value="DRAFT">Nháp</SelectItem>
          <SelectItem value="ACTIVE">Đang bán</SelectItem>
          <SelectItem value="INACTIVE">Ngừng bán</SelectItem>
        </SelectContent>
      </Select>

      <Select value={productTypeId} onValueChange={onProductTypeChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Loại sản phẩm" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả loại</SelectItem>
          {productTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
