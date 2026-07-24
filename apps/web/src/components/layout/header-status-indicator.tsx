"use client";

import * as React from "react";
import { apiUrl } from "@/lib/api";

const POLL_INTERVAL_MS = 15000;

type ConnectionStatus = "checking" | "online" | "offline";

// Chấm + chữ báo trạng thái kết nối tới backend, canh giữa Header. Poll
// GET /api/health (public, có check DB) định kỳ — lỗi mạng/timeout hoặc
// database != "ok" đều coi là offline.
export function HeaderStatusIndicator() {
  const [status, setStatus] = React.useState<ConnectionStatus>("checking");

  React.useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(apiUrl("/health"), { cache: "no-store" });
        if (!res.ok) throw new Error("health check failed");
        const data = (await res.json()) as { database?: string };
        if (!cancelled) setStatus(data.database === "ok" ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (status === "checking") return null;

  const isOnline = status === "online";
  const color = isOnline ? "#22c55e" : "#ef4444";
  const label = isOnline ? "Online" : "Offline";

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px 2px ${color}` }}
      />
      <span className="text-xs font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
