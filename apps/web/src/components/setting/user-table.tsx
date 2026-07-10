"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, KeyRound } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  role: { id: string; code: string; name: string };
}

interface UserTableProps {
  users: UserRow[];
  onEdit: (user: UserRow) => void;
  onResetPassword: (user: UserRow) => void;
}

export function UserTable({ users, onEdit, onResetPassword }: UserTableProps) {
  const { hasPermission, user: currentUser } = useAuth();
  const canEdit = hasPermission("user.update");

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead className="text-center">Trạng thái</TableHead>
            <TableHead>Đăng nhập gần nhất</TableHead>
            {canEdit && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.email}</TableCell>
              <TableCell>{u.name ?? "—"}</TableCell>
              <TableCell>{u.role.name}</TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center gap-1">
                  <Badge variant={u.isActive ? "default" : "secondary"}>
                    {u.isActive ? "Đang hoạt động" : "Đã vô hiệu hoá"}
                  </Badge>
                  {u.mustChangePassword && (
                    <Badge variant="outline" className="text-xs">Chưa đổi mật khẩu</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("vi-VN") : "—"}
              </TableCell>
              {canEdit && (
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {u.id !== currentUser?.id && (
                      <Button variant="ghost" size="icon-sm" onClick={() => onResetPassword(u)} title="Cấp lại mật khẩu tạm">
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
