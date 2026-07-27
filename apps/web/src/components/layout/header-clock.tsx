"use client";

import * as React from "react";

function formatNow(date: Date): string {
  const datePart = date.toLocaleDateString("vi-VN");
  const timePart = date.toLocaleTimeString("vi-VN", { hour12: false });
  return `${datePart} ${timePart}`;
}

// Đồng hồ realtime cạnh tên người dùng ở Header — chỉ render sau khi mount để
// tránh lệch giờ server/client lúc hydrate (giống pattern "checking" của
// HeaderStatusIndicator).
export function HeaderClock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const tick = () => setNow(new Date());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  if (!now) return null;

  return (
    <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
      {formatNow(now)}
    </span>
  );
}
