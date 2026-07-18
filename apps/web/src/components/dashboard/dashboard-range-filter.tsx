"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "today" | "yesterday" | "7d";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
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

function detectPreset(dateFrom: string, dateTo: string): Preset | null {
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
};

interface DashboardRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (range: { from: string; to: string }) => void;
}

// Bộ lọc riêng cho Dashboard — CHỈ 3 preset ngắn (Hôm nay/Hôm qua/7 ngày gần
// đây), không có Tuần này/Tháng này/Tất cả/chọn ngày tuỳ ý. Dọn nợ kỹ thuật
// ghi nhận ở report.md "Nguyên tắc phân vai Dashboard vs Report": Dashboard
// chỉ trả lời "hôm nay cần xử lý gì?", phân tích theo kỳ tuỳ chọn thuộc về
// Report (workbench/sprint-04/008-module-bao-cao.md mục "Ngoài phạm vi").
// KHÔNG dùng chung `shared/date-range-filter.tsx` — component đó có Tuần
// này/Tháng này/Tất cả/tuỳ chọn, đúng cho các trang danh sách (Báo giá, Đơn
// hàng, Công nợ, Kho, Sản xuất, Hàng hoàn) nhưng sai vai trò nếu áp cho các
// khối tổng hợp (aggregate) của Dashboard.
export function DashboardRangeFilter({ dateFrom, dateTo, onChange }: DashboardRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const preset = detectPreset(dateFrom, dateTo);

  function applyPreset(p: Preset) {
    onChange(presetRange(p));
    setOpen(false);
  }

  const displayLabel = preset ? PRESET_LABEL[preset] : `${formatDMY(dateFrom)} - ${formatDMY(dateTo)}`;

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
          {(["today", "yesterday", "7d"] as Preset[]).map((p) => (
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
