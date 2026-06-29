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

interface CustomerFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  groups: FilterOption[];
  selectedGroupId: string;
  onGroupChange: (value: string | null) => void;
  routes: FilterOption[];
  selectedRouteId: string;
  onRouteChange: (value: string | null) => void;
}

export function CustomerFilter({
  search,
  onSearchChange,
  groups,
  selectedGroupId,
  onGroupChange,
  routes,
  selectedRouteId,
  onRouteChange,
}: CustomerFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên, SĐT, mã KH..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={selectedGroupId} onValueChange={onGroupChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Nhóm khách hàng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nhóm</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedRouteId} onValueChange={onRouteChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Tuyến giao hàng" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả tuyến</SelectItem>
          {routes.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
