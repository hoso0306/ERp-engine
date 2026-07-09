"use client";

import * as React from "react";
import { LogOut, KeyRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  if (!user) return null;

  const displayName = user.name || user.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="max-w-32 truncate">{displayName}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
            <KeyRound />
            Đổi mật khẩu
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => logout()}>
            <LogOut />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu hiện tại và mật khẩu mới.
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm onSuccess={() => setChangePasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
