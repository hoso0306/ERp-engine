"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";

interface TemporaryPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  temporaryPassword: string;
}

export function TemporaryPasswordDialog({ open, onOpenChange, email, temporaryPassword }: TemporaryPasswordDialogProps) {
  function copy() {
    navigator.clipboard.writeText(temporaryPassword).then(() => toast.success("Đã sao chép mật khẩu tạm."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mật khẩu tạm</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>Mật khẩu này chỉ hiển thị một lần. Hãy gửi cho <strong>{email}</strong> ngay bây giờ.</p>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="font-mono text-sm">{temporaryPassword}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={copy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Đã hiểu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
