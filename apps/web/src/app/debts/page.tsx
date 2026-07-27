import { redirect } from "next/navigation";

// Mặc định vào tab Công nợ hiển thị "Theo khách hàng" (rà soát chốt
// 26/07/2026) — cùng pattern redirect đã dùng ở /settings → /settings/company.
// Sidebar vẫn trỏ href="/debts" (không đổi) để active-state
// (`pathname.startsWith(item.href)`) tiếp tục khớp mọi route con
// (/debts/by-customer, /debts/by-order, /debts/[id]).
export default function DebtsPage() {
  redirect("/debts/by-customer");
}
