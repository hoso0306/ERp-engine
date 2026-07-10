"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiPost, apiPatch, ApiError } from "@/lib/api";
import type { UserRow } from "./user-table";

interface RoleOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  roles: RoleOption[];
  onSaved: (result: { email: string; temporaryPassword?: string }) => void;
}

export function UserDialog({ open, onOpenChange, user, roles, onSaved }: UserDialogProps) {
  const isEdit = !!user;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "");
      setName(user?.name ?? "");
      setRoleId(user?.role.id ?? "");
      setIsActive(user?.isActive ?? true);
    }
  }, [open, user]);

  const activeRoles = roles.filter((r) => r.isActive || r.id === roleId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !email.trim()) { toast.error("Email là bắt buộc."); return; }
    if (!roleId) { toast.error("Vui lòng chọn vai trò."); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await apiPatch(`/users/${user.id}`, {
          name: name.trim() || undefined,
          roleId,
          isActive,
        });
        toast.success("Đã cập nhật.");
        onSaved({ email: user.email });
      } else {
        const created = await apiPost<{ email: string; temporaryPassword: string }>("/users", {
          email: email.trim(),
          name: name.trim() || undefined,
          roleId,
        });
        toast.success("Đã tạo tài khoản.");
        onSaved({ email: created.email, temporaryPassword: created.temporaryPassword });
      }
      onOpenChange(false);
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
          <DialogTitle>{isEdit ? "Sửa người dùng" : "Tạo người dùng"}</DialogTitle>
        </DialogHeader>
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-email">Email {!isEdit && "*"}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              required={!isEdit}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">Tên hiển thị</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vai trò *</Label>
            <Select value={roleId} onValueChange={(v) => setRoleId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò..." />
              </SelectTrigger>
              <SelectContent>
                {activeRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox id="user-active" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
              <Label htmlFor="user-active" className="cursor-pointer">Đang hoạt động</Label>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button type="submit" form="user-form" disabled={saving || !roleId}>
            {saving ? "Đang lưu..." : isEdit ? "Lưu" : "Tạo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
