"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { apiGet } from "@/lib/api";

export interface ProductOption {
  id: string;
  code: string;
  name: string;
}

interface ProductTypeaheadProps {
  value: ProductOption | null;
  onChange: (product: ProductOption | null) => void;
  disabled?: boolean;
}

// Gợi ý sản phẩm realtime, tìm theo mã/tên — cùng pattern MaterialTypeahead
// (warehouse module). Chỉ gợi ý sản phẩm đang bán (status=ACTIVE).
export function ProductTypeahead({ value, onChange, disabled }: ProductTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
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
        params.set("status", "ACTIVE");
        params.set("limit", "10");
        const json = await apiGet<{ data: ProductOption[] }>(`/products?${params}`);
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

  function pick(product: ProductOption) {
    onChange(product);
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
          <span className="font-mono text-muted-foreground">{value.code}</span>
          <span className="ml-2 font-medium">{value.name}</span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Bỏ chọn sản phẩm"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Gõ mã hoặc tên sản phẩm để tìm..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        disabled={disabled}
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
              Không tìm thấy sản phẩm.
            </div>
          )}
          {!loading &&
            options.map((p, idx) => (
              <button
                type="button"
                key={p.id}
                onClick={() => pick(p)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  idx === highlighted ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground shrink-0">{p.code}</span>
                <span className="font-medium truncate">{p.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
