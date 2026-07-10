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

interface RoleCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RoleCreateDialog({ open, onOpenChange, onSaved }: RoleCreateDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setCode("");
    setName("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { toast.error("Code và tên vai trò là bắt buộc."); return; }
    setSaving(true);
    try {
      await apiPost("/roles", { code: code.trim().toUpperCase(), name: name.trim() });
      toast.success("Đã tạo vai trò.");
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Tạo vai trò</DialogTitle>
        </DialogHeader>
        <form id="role-create-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-code">Code *</Label>
            <Input
              id="role-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="vd: SUPERVISOR"
              required
            />
            <p className="text-xs text-muted-foreground">Không đổi được sau khi tạo.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-name">Tên hiển thị *</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: Giám sát xưởng"
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="role-create-form" disabled={saving}>
            {saving ? "Đang tạo..." : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
