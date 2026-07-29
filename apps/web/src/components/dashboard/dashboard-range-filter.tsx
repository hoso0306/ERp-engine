"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "today" | "yesterday" | "7d" | "all";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset: Preset): { from?: string; to?: string } {
  const today = new Date();
  if (preset === "all") {
    return { from: undefined, to: undefined };
  }
  if (preset === "today") {
    const iso = toISO(today);
    return { from: iso, to: iso };
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const iso = toISO(y);
    return { from: iso, to: iso };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from: toISO(from), to: toISO(today) };
}

function detectPreset(dateFrom?: string, dateTo?: string): Preset | null {
  if (!dateFrom && !dateTo) return "all";
  const presets: Preset[] = ["today", "yesterday", "7d"];
  for (const p of presets) {
    const r = presetRange(p);
    if (r.from === dateFrom && r.to === dateTo) return p;
  }
  return null;
}

function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const PRESET_LABEL: Record<Preset, string> = {
  today: "Hôm nay",
  yesterday: "Hôm qua",
  "7d": "7 ngày gần đây",
  all: "Tất cả",
};

// Nhãn hiển thị dùng chung — export để các card khối tự dựng tiêu đề động
// theo filter đang chọn (vd khối "Hôm nay" đổi tên thành "Hôm qua" khi đổi
// preset — 027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 5).
export function rangeLabel(dateFrom?: string, dateTo?: string): string {
  const preset = detectPreset(dateFrom, dateTo);
  if (preset) return PRESET_LABEL[preset];
  if (dateFrom && dateTo) return `${formatDMY(dateFrom)} - ${formatDMY(dateTo)}`;
  return PRESET_LABEL.all;
}

interface DashboardRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (range: { from?: string; to?: string }) => void;
}

// Bộ lọc riêng cho từng khối Dashboard (027-thiet-ke-lai-dashboard-bo-loc-rieng.md
// — mỗi khối tự có 1 instance của component này, độc lập với nhau). 4 preset
// ngắn (Hôm nay/Hôm qua/7 ngày gần đây/Tất cả), không có Tuần này/Tháng
// này/chọn ngày tuỳ ý — đúng nguyên tắc report.md "Nguyên tắc phân vai
// Dashboard vs Report" (Dashboard chỉ trả lời "hôm nay/kỳ ngắn cần xử lý gì",
// phân tích kỳ tuỳ chọn thuộc về Report). KHÔNG dùng chung
// `shared/date-range-filter.tsx` — component đó có Tuần này/Tháng này/tuỳ ý,
// đúng cho các trang danh sách, sai vai trò cho khối tổng hợp của Dashboard.
export function DashboardRangeFilter({ dateFrom, dateTo, onChange }: DashboardRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const preset = detectPreset(dateFrom, dateTo);

  function applyPreset(p: Preset) {
    onChange(presetRange(p));
    setOpen(false);
  }

  const displayLabel = rangeLabel(dateFrom, dateTo);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="font-normal">
            <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
            {displayLabel}
          </Button>
        }
      />
      <PopoverContent className="w-56 space-y-2">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">THỜI GIAN HIỂN THỊ</div>
        <div className="flex flex-col gap-2">
          {(["today", "yesterday", "7d", "all"] as Preset[]).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={preset === p ? "default" : "outline"}
              className="justify-start"
              onClick={() => applyPreset(p)}
            >
              {PRESET_LABEL[p]}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
