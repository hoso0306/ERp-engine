"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { SettingsTabs } from "@/components/setting/settings-tabs";
import { RoleTable, type RoleRow } from "@/components/setting/role-table";
import { RoleCreateDialog } from "@/components/setting/role-create-dialog";
import { apiGet, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface UserRow {
  id: string;
  role: { id: string };
}

export default function RolesPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [userCountByRole, setUserCountByRole] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, usersData] = await Promise.all([
        apiGet<RoleRow[]>("/roles"),
        apiGet<UserRow[]>("/users"),
      ]);
      setRoles(rolesData);
      const counts: Record<string, number> = {};
      for (const u of usersData) {
        counts[u.role.id] = (counts[u.role.id] ?? 0) + 1;
      }
      setUserCountByRole(counts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách vai trò.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  return (
    <div className="space-y-6">
      <SettingsTabs active="roles" />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vai trò</h3>
          <p className="text-sm text-muted-foreground">Quản lý vai trò và phân quyền</p>
        </div>
        {hasPermission("role.create") && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo vai trò
          </Button>
        )}
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchRoles} />}
      {!loading && !error && (
        <>
          <RoleTable roles={roles} userCountByRole={userCountByRole} />
          <RoleCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={fetchRoles} />
        </>
      )}
    </div>
  );
}
