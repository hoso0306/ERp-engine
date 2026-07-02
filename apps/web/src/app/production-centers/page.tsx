"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, ConfirmDialog } from "@/components/shared";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ProductionCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ProductionCentersPage() {
  const [centers, setCenters] = useState<ProductionCenter[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionCenter | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductionCenter | null>(null);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/production-centers`);
      if (res.ok) setCenters(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  function openAdd() {
    setEditTarget(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(center: ProductionCenter) {
    setEditTarget(center);
    setName(center.name);
    setDescription(center.description ?? "");
    setIsActive(center.isActive);
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên xưởng là bắt buộc.");
      return;
    }
    setSubmitting(true);
    try {
      const url = editTarget
        ? `${API_URL}/api/production-centers/${editTarget.id}`
        : `${API_URL}/api/production-centers`;
      const res = await fetch(url, {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể lưu.");
        return;
      }
      toast.success(editTarget ? "Đã cập nhật." : "Đã thêm xưởng sản xuất.");
      setDialogOpen(false);
      fetchCenters();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_URL}/api/production-centers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể xoá.");
        return;
      }
      toast.success("Đã xoá xưởng sản xuất.");
      fetchCenters();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  async function toggleActive(center: ProductionCenter) {
    try {
      const res = await fetch(`${API_URL}/api/production-centers/${center.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !center.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể cập nhật.");
        return;
      }
      fetchCenters();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Xưởng sản xuất"
        description="Quản lý danh sách xưởng sản xuất"
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm xưởng
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Mã</TableHead>
              <TableHead>Tên xưởng</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="text-center w-28">Trạng thái</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : centers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có xưởng nào.
                </TableCell>
              </TableRow>
            ) : (
              centers.map((center) => (
                <TableRow key={center.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">{center.code}</TableCell>
                  <TableCell className="font-medium">{center.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{center.description ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => toggleActive(center)} className="cursor-pointer">
                      <Badge variant={center.isActive ? "default" : "secondary"}>
                        {center.isActive ? "Đang dùng" : "Ẩn"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(center)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setDeleteTarget(center); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Chỉnh sửa xưởng" : "Thêm xưởng sản xuất"}
            </DialogTitle>
          </DialogHeader>
          <form id="center-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="center-name">Tên xưởng *</Label>
              <Input
                id="center-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: Xưởng A, Xưởng cắt..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="center-desc">Mô tả</Label>
              <Input
                id="center-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về xưởng"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="center-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="center-active" className="cursor-pointer font-normal">
                Đang sử dụng
              </Label>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Huỷ</Button>
            <Button type="submit" form="center-form" disabled={submitting}>
              {submitting ? "Đang lưu..." : editTarget ? "Lưu thay đổi" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá xưởng sản xuất"
        description={`Xoá xưởng "${deleteTarget?.name}"? Không thể xoá nếu đang được dùng trong sản phẩm.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
