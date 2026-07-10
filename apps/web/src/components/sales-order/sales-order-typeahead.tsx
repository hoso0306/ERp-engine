"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { apiGet } from "@/lib/api";

export interface SalesOrderOption {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
}

interface SalesOrderTypeaheadProps {
  value: SalesOrderOption | null;
  onChange: (order: SalesOrderOption | null) => void;
  status?: string;
  placeholder?: string;
}

// Gợi ý đơn hàng realtime — cùng pattern CustomerTypeahead/MaterialTypeahead,
// mặc định chỉ gợi ý đơn `DELIVERED` (dùng cho luồng tạo phiếu hoàn).
export function SalesOrderTypeahead({ value, onChange, status = "DELIVERED", placeholder }: SalesOrderTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SalesOrderOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("search", query.trim());
        params.set("limit", "10");
        if (status) params.set("status", status);
        const json = await apiGet<{ data: SalesOrderOption[] }>(`/sales-orders?${params}`);
        setOptions(json.data ?? []);
        setHighlighted(0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open, status]);

  function pick(order: SalesOrderOption) {
    onChange(order);
    setOpen(false);
    setQuery("");
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOptions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(options[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div className="text-sm">
          <span className="font-mono font-medium">{value.code}</span>
          <span className="text-muted-foreground"> — {value.customerName}</span>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Bỏ chọn đơn hàng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder ?? "Gõ mã đơn hoặc tên khách hàng để tìm..."}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="pl-9"
        role="combobox"
        aria-expanded={open}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Đang tìm...</div>
          )}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Không tìm thấy đơn hàng.
            </div>
          )}
          {!loading &&
            options.map((o, idx) => (
              <button
                type="button"
                key={o.id}
                onClick={() => pick(o)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  idx === highlighted ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span>
                  <span className="font-mono font-medium">{o.code}</span>
                  <span className="text-muted-foreground"> — {o.customerName}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
