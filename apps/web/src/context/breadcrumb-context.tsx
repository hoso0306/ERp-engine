"use client";

import { createContext, useContext, useState, useEffect, useMemo } from "react";

export interface BreadcrumbExtra {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  extra: BreadcrumbExtra | null;
  setExtra: (extra: BreadcrumbExtra | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = useState<BreadcrumbExtra | null>(null);
  const value = useMemo(() => ({ extra, setExtra }), [extra]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

function useBreadcrumbContext(): BreadcrumbContextValue {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumbContext phải dùng bên trong BreadcrumbProvider.");
  return ctx;
}

export function useBreadcrumbExtra(): BreadcrumbExtra | null {
  return useBreadcrumbContext().extra;
}

/**
 * Đăng ký 1 đoạn breadcrumb động (vd tên khách hàng, tên sản phẩm cụ thể) —
 * dùng ở trang/component có dữ liệu runtime mà navigation.ts (tĩnh) không
 * biết trước. Tự dọn khi unmount hoặc khi label/href đổi.
 */
export function useSetBreadcrumbExtra(extra: BreadcrumbExtra | null): void {
  const { setExtra } = useBreadcrumbContext();
  const label = extra?.label;
  const href = extra?.href;
  useEffect(() => {
    setExtra(label ? { label, href } : null);
    return () => setExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, href]);
}
