"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiPut, ApiError } from "@/lib/api";

interface RecoveryInventoryEditTarget {
  id: string;
  location: string | null;
  imageUrl: string | null;
}

interface RecoveryInventoryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecoveryInventoryEditTarget | null;
  onSaved: () => void;
}

export function RecoveryInventoryEditDialog({ open, onOpenChange, item, onSaved }: RecoveryInventoryEditDialogProps) {
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setLocation(item.location ?? "");
      setImageUrl(item.imageUrl ?? "");
    }
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    try {
      await apiPut(`/recovery-inventory/${item.id}`, {
        location: location.trim() || null,
        imageUrl: imageUrl.trim() || null,
      });
      toast.success("Đã cập nhật hàng thu hồi.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa hàng thu hồi</DialogTitle>
        </DialogHeader>
        <form id="recovery-edit-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-location">Vị trí</Label>
            <Input
              id="recovery-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ví dụ: Kệ A3, Kho phụ..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-image-url">Đường dẫn ảnh</Label>
            <Input
              id="recovery-image-url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="recovery-edit-form" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
