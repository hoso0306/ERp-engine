"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserTable, type UserRow } from "@/components/setting/user-table";
import { UserDialog } from "@/components/setting/user-dialog";
import { TemporaryPasswordDialog } from "@/components/setting/temporary-password-dialog";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface RoleOption {
  id: string;
  name: string;
  isActive: boolean;
}

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  const [tempPasswordOpen, setTempPasswordOpen] = useState(false);
  const [tempPasswordEmail, setTempPasswordEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<UserRow[]>("/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    apiGet<RoleOption[]>("/roles").then(setRoles).catch(() => {});
  }, [fetchUsers]);

  function handleSaved(result: { email: string; temporaryPassword?: string }) {
    fetchUsers();
    if (result.temporaryPassword) {
      setTempPasswordEmail(result.email);
      setTempPassword(result.temporaryPassword);
      setTempPasswordOpen(true);
    }
  }

  async function handleResetPassword(user: UserRow) {
    if (!confirm(`Cấp lại mật khẩu tạm cho ${user.email}?`)) return;
    try {
      const result = await apiPatch<{ temporaryPassword: string }>(`/users/${user.id}`, {
        resetPassword: true,
      });
      fetchUsers();
      setTempPasswordEmail(user.email);
      setTempPassword(result.temporaryPassword);
      setTempPasswordOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={fetchUsers} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Người dùng"
        description="Quản lý tài khoản nhân viên"
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" render={<Link href="/settings" />}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {hasPermission("user.create") && (
              <Button onClick={() => { setEditingUser(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Tạo người dùng
              </Button>
            )}
          </div>
        }
      />

      <UserTable
        users={users}
        onEdit={(u) => { setEditingUser(u); setDialogOpen(true); }}
        onResetPassword={handleResetPassword}
      />

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        roles={roles}
        onSaved={handleSaved}
      />

      <TemporaryPasswordDialog
        open={tempPasswordOpen}
        onOpenChange={setTempPasswordOpen}
        email={tempPasswordEmail}
        temporaryPassword={tempPassword}
      />
    </div>
  );
}
