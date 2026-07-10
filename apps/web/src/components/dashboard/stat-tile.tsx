interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger";
}

export function StatTile({ label, value, sub, tone = "default" }: StatTileProps) {
  return (
    <div className="rounded-lg border p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
