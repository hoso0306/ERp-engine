"use client";

import { useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";

// Sidebar desktop (`collapsible="icon"` — xem app-sidebar.tsx) không tự thu
// khi bấm ra ngoài, khác Sheet mobile vốn đã có sẵn overlay tự đóng. Theo
// yêu cầu: đang mở mà bấm bất kỳ đâu bên ngoài sidebar thì tự thu lại.
//
// Chỉ gắn listener khi đang mở (effect phụ thuộc `open`) — nếu gắn thường
// trực, đúng cú click vừa dùng để MỞ sidebar (qua SidebarTrigger) sẽ bị bắt
// luôn trong cùng lượt và đóng ngay lại. Gắn trong effect (chạy sau khi
// commit, sau khi click mở đã xử lý xong) tránh được việc này.
export function SidebarAutoCollapse() {
  const { isMobile, open, setOpen } = useSidebar();

  useEffect(() => {
    if (isMobile || !open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;
      // Bấm trong chính sidebar, hoặc bấm nút SidebarTrigger (đổi trạng thái
      // riêng, không để listener này can thiệp kẻo đóng rồi trigger lại mở).
      if (target.closest('[data-slot="sidebar-container"]')) return;
      if (target.closest('[data-slot="sidebar-trigger"]')) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMobile, open, setOpen]);

  return null;
}
