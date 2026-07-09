"use client";

import * as React from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  submitLabel?: string;
}

export function ChangePasswordForm({
  onSuccess,
  submitLabel = "Đổi mật khẩu",
}: ChangePasswordFormProps) {
  const { changePassword } = useAuth();
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const oldPassword = String(form.get("oldPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success("Đổi mật khẩu thành công.");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="oldPassword">Mật khẩu hiện tại</Label>
        <Input
          id="oldPassword"
          name="oldPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Đang lưu..." : submitLabel}
      </Button>
    </form>
  );
}
