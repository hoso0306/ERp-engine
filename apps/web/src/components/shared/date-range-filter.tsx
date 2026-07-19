"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Preset = "today" | "week" | "month" | "all" | "custom";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Dùng khi 1 trang cần đặt giá trị mặc định "Hôm nay" cho bộ lọc ngày.
export function todayISO(): string {
  return toISO(new Date());
}

// Mốc "đến ngày" của bộ lọc phải bao hết cả ngày đó — input <type=date> chỉ
// cho ngày (vd "2026-07-19"), new Date(...) parse ra 00:00:00 UTC, nên so
// trực tiếp với timestamp thật (createdAt...) sẽ loại mọi bản ghi tạo sau
// mốc đó trong CÙNG ngày (bug: đơn vừa tạo hôm nay biến mất khỏi filter mặc
// định "Hôm nay"). Chuẩn hoá về cuối ngày theo giờ local trước khi so sánh —
// cùng cách BE đã làm cho createdTo (xem quotation-workflow.service.ts findAll()).
export function endOfDayBound(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function endOfWeek(d: Date): Date {
  const monday = startOfWeek(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

function presetRange(preset: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  if (preset === "today") {
    const iso = toISO(now);
    return { from: iso, to: iso };
  }
  if (preset === "week") {
    return { from: toISO(startOfWeek(now)), to: toISO(endOfWeek(now)) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISO(start), to: toISO(end) };
}

function detectPreset(dateFrom: string, dateTo: string): Preset {
  if (!dateFrom && !dateTo) return "all";
  const today = presetRange("today");
  if (dateFrom === today.from && dateTo === today.to) return "today";
  const week = presetRange("week");
  if (dateFrom === week.from && dateTo === week.to) return "week";
  const month = presetRange("month");
  if (dateFrom === month.from && dateTo === month.to) return "month";
  return "custom";
}

function formatDM(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatDMY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDisplay(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return "Tất cả";
  if (dateFrom && !dateTo) return `Từ ${formatDMY(dateFrom)}`;
  if (!dateFrom && dateTo) return `Đến ${formatDMY(dateTo)}`;
  const sameYear = dateFrom.slice(0, 4) === dateTo.slice(0, 4);
  return sameYear ? `${formatDM(dateFrom)} - ${formatDM(dateTo)}` : `${formatDMY(dateFrom)} - ${formatDMY(dateTo)}`;
}

interface DateRangeFilterProps {
  label?: string;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
}

// Bộ lọc khoảng thời gian dùng chung toàn hệ thống (thiết kế chốt theo ảnh
// mẫu "THỜI GIAN HIỂN THỊ"): 4 lựa chọn nhanh + tuỳ chọn khoảng ngày cụ thể.
export function DateRangeFilter({
  label = "Bộ lọc",
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const preset = detectPreset(dateFrom, dateTo);

  function applyPreset(p: "today" | "week" | "month") {
    const range = presetRange(p);
    onDateFromChange(range.from);
    onDateToChange(range.to);
    setOpen(false);
  }

  function applyAll() {
    onDateFromChange("");
    onDateToChange("");
    setOpen(false);
  }

  const presetButtons: { key: "today" | "week" | "month" | "all"; text: string }[] = [
    { key: "today", text: "Hôm nay" },
    { key: "week", text: "Tuần này" },
    { key: "month", text: "Tháng này" },
    { key: "all", text: "Tất cả" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="font-normal">
            <CalendarRange className="mr-2 h-4 w-4 text-muted-foreground" />
            {label}: {formatDisplay(dateFrom, dateTo)}
          </Button>
        }
      />
      <PopoverContent className="w-64 space-y-3">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          THỜI GIAN HIỂN THỊ
        </div>

        <div className="grid grid-cols-2 gap-2">
          {presetButtons.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={preset === p.key ? "default" : "outline"}
              onClick={() => (p.key === "all" ? applyAll() : applyPreset(p.key))}
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
              <Label htmlFor="date-range-from" className="text-xs text-muted-foreground">
                Từ ngày
              </Label>
              <Input
                id="date-range-from"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date-range-to" className="text-xs text-muted-foreground">
                Đến ngày
              </Label>
              <Input
                id="date-range-to"
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
