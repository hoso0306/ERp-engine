"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Cảnh báo dạng accordion (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 1)
// — mỗi nhóm cảnh báo là 1 dòng tiêu đề (icon + nhãn + số lượng), bấm mới xổ
// ra danh sách chi tiết. Tái dùng đúng pattern ChevronDown/ChevronRight +
// useState đã có sẵn ở receivable-by-customer-table.tsx, không thêm thư viện
// Accordion mới (dự án chưa có sẵn). Nhóm 0 cảnh báo thì không render gì.
interface AlertGroupProps {
  icon: ReactNode;
  label: string;
  count: number;
  tone?: "default" | "danger";
  children: ReactNode;
}

export function AlertGroup({ icon, label, count, tone = "default", children }: AlertGroupProps) {
  const [expanded, setExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-accent/50"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
          <Badge variant={tone === "danger" ? "destructive" : "secondary"}>{count}</Badge>
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && <div className="divide-y border-t">{children}</div>}
    </div>
  );
}
