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

interface ProductionCenterOption {
  id: string;
  code: string;
  name: string;
}

interface ProductFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  productTypes: FilterOption[];
  productTypeId: string;
  onProductTypeChange: (value: string | null) => void;
  productionCenters: ProductionCenterOption[];
  productionCenterId: string;
  onProductionCenterChange: (value: string | null) => void;
}

export function ProductFilter({
  search,
  onSearchChange,
  productTypes,
  productTypeId,
  onProductTypeChange,
  productionCenters,
  productionCenterId,
  onProductionCenterChange,
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

      <Select value={productionCenterId} onValueChange={onProductionCenterChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Xưởng sản xuất" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả xưởng</SelectItem>
          {productionCenters.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
