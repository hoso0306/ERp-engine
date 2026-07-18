"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "month" | "last-month" | "quarter" | "year" | "custom";
type PresetKey = Exclude<Preset, "custom">;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthRange(base: Date): { from: string; to: string } {
  return {
    from: toISO(new Date(base.getFullYear(), base.getMonth(), 1)),
    to: toISO(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
  };
}

function quarterRange(base: Date): { from: string; to: string } {
  const q = Math.floor(base.getMonth() / 3);
  return {
    from: toISO(new Date(base.getFullYear(), q * 3, 1)),
    to: toISO(new Date(base.getFullYear(), q * 3 + 3, 0)),
  };
}

function yearRange(base: Date): { from: string; to: string } {
  return {
    from: toISO(new Date(base.getFullYear(), 0, 1)),
    to: toISO(new Date(base.getFullYear(), 11, 31)),
  };
}

export function presetRange(preset: PresetKey): { from: string; to: string } {
  const now = new Date();
  if (preset === "month") return monthRange(now);
  if (preset === "last-month") return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  if (preset === "quarter") return quarterRange(now);
  return yearRange(now);
}

const PRESET_KEYS: PresetKey[] = ["month", "last-month", "quarter", "year"];

function detectPreset(from: string, to: string): Preset {
  for (const p of PRESET_KEYS) {
    const r = presetRange(p);
    if (r.from === from && r.to === to) return p;
  }
  return "custom";
}

function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface ReportRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

// Bộ lọc kỳ dùng riêng cho Report — LUÔN bắt buộc from/to, KHÔNG có preset
// "Tất cả" như Dashboard (report.md "Khác nhau giữa Report và Dashboard";
// 014-bao-cao.md Task 08).
export function ReportRangeFilter({ from, to, onFromChange, onToChange }: ReportRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const preset = detectPreset(from, to);

  function applyPreset(p: PresetKey) {
    const r = presetRange(p);
    onFromChange(r.from);
    onToChange(r.to);
    setOpen(false);
  }

  const presetButtons: { key: PresetKey; text: string }[] = [
    { key: "month", text: "Tháng này" },
    { key: "last-month", text: "Tháng trước" },
    { key: "quarter", text: "Quý này" },
    { key: "year", text: "Năm nay" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="font-normal">
            <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
            Kỳ: {formatDMY(from)} - {formatDMY(to)}
          </Button>
        }
      />
      <PopoverContent className="w-64 space-y-3">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">KỲ BÁO CÁO</div>

        <div className="grid grid-cols-2 gap-2">
          {presetButtons.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => applyPreset(p.key)}
            >
              {p.text}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-primary"
          onClick={() => setCustomOpen((v) => !v)}
        >
          Chọn khoảng ngày...
        </Button>

        {(customOpen || preset === "custom") && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="report-range-from" className="text-xs text-muted-foreground">
                Từ ngày
              </Label>
              <Input
                id="report-range-from"
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-range-to" className="text-xs text-muted-foreground">
                Đến ngày
              </Label>
              <Input
                id="report-range-to"
                type="date"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Mặc định khi mở 1 trang report: kỳ "Tháng này" (report.md không mô tả rõ
// Report đọc Settings.Dashboard.defaultDashboardPeriod — setting đó thuộc
// Dashboard; Report bắt buộc chọn kỳ nên "Tháng này" là mặc định hợp lý nhất
// cho phân tích theo kỳ).
export function defaultReportRange(): { from: string; to: string } {
  return presetRange("month");
}
