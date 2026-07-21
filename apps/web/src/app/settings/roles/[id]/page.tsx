"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Permission {
  id: string;
  resource: string;
  action: string;
  key: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  rolePermissions: { permissionId: string; permission: Permission }[];
}

// Nhãn tiếng Việt cho `resource`/`action` của Permission — chỉ đổi HIỂN THỊ,
// không đổi giá trị gốc gửi lên API (permissionId vẫn dùng key gốc). Quyền
// mới thêm ở DB mà chưa kịp bổ sung bản dịch sẽ tạm hiện mã gốc tiếng Anh
// (fallback ở nơi dùng), không vỡ giao diện.
const RESOURCE_LABELS: Record<string, string> = {
  customer: "Khách hàng",
  dashboard: "Trang tổng quan",
  debt: "Công nợ",
  product: "Sản phẩm",
  production: "Sản xuất",
  "production-center": "Xưởng sản xuất",
  quotation: "Báo giá",
  report: "Báo cáo",
  return: "Hàng trả lại",
  role: "Vai trò",
  "sales-order": "Đơn hàng",
  settings: "Cài đặt",
  user: "Người dùng",
  warehouse: "Kho",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xoá",
  export: "Xuất dữ liệu",
  "create-payment": "Ghi nhận thanh toán",
  activate: "Kích hoạt",
  complete: "Hoàn thành",
  start: "Bắt đầu sản xuất",
  approve: "Duyệt",
  cancel: "Huỷ",
  override: "Ghi đè thủ công",
  print: "In",
  "view-cost": "Xem giá vốn",
  dispose: "Thanh lý",
  "mark-used": "Đánh dấu đã dùng lại",
  disable: "Vô hiệu hoá",
  deliver: "Khách nhận hàng",
  ship: "Gửi xe",
  receipt: "Nhập kho",
};

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const fetchRole = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleData, catalogData] = await Promise.all([
        apiGet<Role>(`/roles/${id}`),
        apiGet<Permission[]>("/permissions"),
      ]);
      setRole(roleData);
      setCatalog(catalogData);
      setName(roleData.name);
      setSelected(new Set(roleData.rolePermissions.map((rp) => rp.permissionId)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải vai trò.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  function toggle(permissionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  }

  function toggleGroup(permissionIds: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const pid of permissionIds) {
        if (checked) next.add(pid);
        else next.delete(pid);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiPatch(`/roles/${id}`, {
        name: name.trim() || undefined,
        permissionIds: Array.from(selected),
      });
      toast.success("Đã lưu.");
      fetchRole();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (!confirm(`Vô hiệu hoá vai trò "${role?.name}"?`)) return;
    setDisabling(true);
    try {
      await apiPost(`/roles/${id}/disable`);
      toast.success("Đã vô hiệu hoá vai trò.");
      fetchRole();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setDisabling(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !role) return <ErrorState description={error ?? "Không tìm thấy vai trò."} onRetry={fetchRole} />;

  const canEdit = hasPermission("role.update");
  const canDisable = hasPermission("role.disable") && role.isActive;

  const groups = new Map<string, Permission[]>();
  for (const p of catalog) {
    const list = groups.get(p.resource) ?? [];
    list.push(p);
    groups.set(p.resource, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={role.name}
        description={`Vai trò — ${role.code}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" render={<Link href="/settings/roles" />}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canDisable && (
              <Button variant="destructive" onClick={handleDisable} disabled={disabling}>
                <Ban className="mr-2 h-4 w-4" />
                {disabling ? "Đang xử lý..." : "Vô hiệu hoá"}
              </Button>
            )}
          </div>
        }
      />

      <div className="rounded-lg border p-5 space-y-4 max-w-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-24 shrink-0">Trạng thái</span>
          <Badge variant={role.isActive ? "default" : "secondary"}>
            {role.isActive ? "Đang dùng" : "Đã vô hiệu hoá"}
          </Badge>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-name">Tên hiển thị</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-base font-semibold">Quyền hạn</h3>
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([resource, permissions]) => {
            const allChecked = permissions.every((p) => selected.has(p.id));
            return (
              <div key={resource} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(v) => canEdit && toggleGroup(permissions.map((p) => p.id), v === true)}
                    disabled={!canEdit}
                  />
                  <span className="font-medium text-sm">{RESOURCE_LABELS[resource] ?? resource}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-6">
                  {permissions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => canEdit && toggle(p.id)}
                        disabled={!canEdit}
                      />
                      {ACTION_LABELS[p.action] ?? p.action}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        )}
      </div>
    </div>
  );
}
