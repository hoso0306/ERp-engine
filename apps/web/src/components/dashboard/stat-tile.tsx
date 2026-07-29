import Link from "next/link";

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger";
  // Click-through về danh sách đã lọc sẵn (026-cai-tien-dashboard.md mục 7)
  // — tuỳ chọn, tile không truyền href vẫn hiển thị như cũ (không click được).
  href?: string;
}

export function StatTile({ label, value, sub, tone = "default", href }: StatTileProps) {
  const content = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border p-4 space-y-1 transition-colors hover:bg-accent"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-lg border p-4 space-y-1">{content}</div>;
}
