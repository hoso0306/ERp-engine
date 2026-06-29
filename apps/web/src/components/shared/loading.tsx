import { Loader2 } from "lucide-react";

export function Loading({ message = "Đang tải..." }: { message?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
