"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface CustomerOption {
  id: string;
  code: string;
  name: string;
  phone: string;
  customerGroup?: { name: string } | null;
}

interface CustomerTypeaheadProps {
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
}

// Gợi ý khách hàng realtime (testlan1 mục Báo giá): gõ tên/SĐT → dropdown hiện
// ngay theo từng ký tự (debounce 300ms, API GET /customers?search= sẵn có).
export function CustomerTypeahead({ value, onChange }: CustomerTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi bấm ra ngoài.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Tìm kiếm debounce theo từng ký tự.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("search", query.trim());
        params.set("limit", "10");
        params.set("status", "ACTIVE");
        const res = await fetch(`${API_URL}/api/customers?${params}`);
        const json = await res.json();
        setOptions(json.data ?? []);
        setHighlighted(0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  function pick(customer: CustomerOption) {
    onChange(customer);
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

  // Đã chọn khách → hiển thị thẻ khách + nút bỏ chọn.
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div className="text-sm">
          <span className="font-medium">{value.name}</span>
          <span className="text-muted-foreground"> — {value.phone}</span>
          {value.customerGroup?.name && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {value.customerGroup.name}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Bỏ chọn khách hàng"
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
        placeholder="Gõ tên hoặc số điện thoại để tìm khách hàng..."
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
              Không tìm thấy khách hàng.
            </div>
          )}
          {!loading &&
            options.map((c, idx) => (
              <button
                type="button"
                key={c.id}
                onClick={() => pick(c)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  idx === highlighted ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground"> — {c.phone}</span>
                </span>
                {c.customerGroup?.name && (
                  <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {c.customerGroup.name}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
