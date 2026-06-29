import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "Không có dữ liệu",
  description = "Chưa có dữ liệu nào được tạo.",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20">
      <Inbox className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
