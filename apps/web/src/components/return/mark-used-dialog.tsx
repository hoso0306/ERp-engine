"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";

interface MarkUsedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  onSaved: () => void;
}

export function MarkUsedDialog({ open, onOpenChange, itemId, onSaved }: MarkUsedDialogProps) {
  const [usedForNote, setUsedForNote] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setUsedForNote("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId) return;
    setSaving(true);
    try {
      await apiPost(`/recovery-inventory/${itemId}/mark-used`, {
        usedForNote: usedForNote.trim() || undefined,
      });
      toast.success("Đã đánh dấu đã sử dụng.");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đánh dấu đã sử dụng</DialogTitle>
        </DialogHeader>
        <form id="mark-used-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hàng thu hồi sẽ chuyển sang trạng thái &quot;Đã sử dụng&quot;, không còn trong kho.
          </p>
          <div className="space-y-2">
            <Label htmlFor="used-for-note">Dùng cho (tuỳ chọn)</Label>
            <Input
              id="used-for-note"
              value={usedForNote}
              onChange={(e) => setUsedForNote(e.target.value)}
              placeholder="Ví dụ: SO000231, hoặc Cắt làm rèm mẫu..."
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="mark-used-form" disabled={saving}>
            {saving ? "Đang lưu..." : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
