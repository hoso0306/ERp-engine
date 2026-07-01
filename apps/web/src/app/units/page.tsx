"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Unit {
  id: string;
  name: string;
  createdAt: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Unit | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/units`);
      if (res.ok) setUnits(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  function openAdd() {
    setEditTarget(null);
    setName("");
    setDialogOpen(true);
  }

  function openEdit(unit: Unit) {
    setEditTarget(unit);
    setName(unit.name);
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên đơn vị là bắt buộc.");
      return;
    }
    setSubmitting(true);
    try {
      const url = editTarget
        ? `${API_URL}/api/units/${editTarget.id}`
        : `${API_URL}/api/units`;
      const res = await fetch(url, {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể lưu.");
        return;
      }
      toast.success(editTarget ? "Đã cập nhật." : "Đã thêm đơn vị.");
      setDialogOpen(false);
      fetchUnits();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_URL}/api/units/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể xoá.");
        return;
      }
      toast.success("Đã xoá đơn vị.");
      fetchUnits();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn vị tính"
        description="Quản lý danh sách đơn vị đo lường"
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm đơn vị
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>Tên đơn vị</TableHead>
              <TableHead className="text-muted-foreground w-44">Ngày tạo</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có đơn vị nào.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit, idx) => (
                <TableRow key={unit.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(unit.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(unit)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeleteTarget(unit);
                          setDeleteOpen(true);
                        }}
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

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Chỉnh sửa đơn vị" : "Thêm đơn vị"}</DialogTitle>
          </DialogHeader>
          <form id="unit-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Tên đơn vị *</Label>
              <Input
                id="unit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: Cái, m², kg..."
                autoFocus
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="unit-form" disabled={submitting}>
              {submitting ? "Đang lưu..." : editTarget ? "Lưu thay đổi" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá đơn vị"
        description={`Xoá đơn vị "${deleteTarget?.name}"? Không thể xoá nếu đang được sử dụng.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
