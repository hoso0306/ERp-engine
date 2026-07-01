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

interface ProductType {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function ProductTypesPage() {
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductType | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductType | null>(null);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/product-types`);
      if (res.ok) setTypes(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  function openAdd() {
    setEditTarget(null);
    setName("");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(type: ProductType) {
    setEditTarget(type);
    setName(type.name);
    setIsActive(type.isActive);
    setDialogOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tên loại sản phẩm là bắt buộc.");
      return;
    }
    setSubmitting(true);
    try {
      const url = editTarget
        ? `${API_URL}/api/product-types/${editTarget.id}`
        : `${API_URL}/api/product-types`;
      const res = await fetch(url, {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể lưu.");
        return;
      }
      toast.success(editTarget ? "Đã cập nhật." : "Đã thêm loại sản phẩm.");
      setDialogOpen(false);
      fetchTypes();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API_URL}/api/product-types/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể xoá.");
        return;
      }
      toast.success("Đã xoá loại sản phẩm.");
      fetchTypes();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  async function toggleActive(type: ProductType) {
    try {
      const res = await fetch(`${API_URL}/api/product-types/${type.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !type.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể cập nhật.");
        return;
      }
      fetchTypes();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loại sản phẩm"
        description="Quản lý danh mục phân loại sản phẩm"
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm loại
          </Button>
        }
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">STT</TableHead>
              <TableHead>Tên loại</TableHead>
              <TableHead className="text-center w-28">Trạng thái</TableHead>
              <TableHead className="text-muted-foreground w-44">Ngày tạo</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Đang tải...
                </TableCell>
              </TableRow>
            ) : types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có loại sản phẩm nào.
                </TableCell>
              </TableRow>
            ) : (
              types.map((type, idx) => (
                <TableRow key={type.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => toggleActive(type)} className="cursor-pointer">
                      <Badge variant={type.isActive ? "default" : "secondary"}>
                        {type.isActive ? "Đang dùng" : "Ẩn"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(type.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(type)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeleteTarget(type);
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
            <DialogTitle>
              {editTarget ? "Chỉnh sửa loại sản phẩm" : "Thêm loại sản phẩm"}
            </DialogTitle>
          </DialogHeader>
          <form id="type-form" onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type-name">Tên loại *</Label>
              <Input
                id="type-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: Cửa nhôm, Vách kính..."
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="type-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="type-active" className="cursor-pointer font-normal">
                Đang sử dụng
              </Label>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="type-form" disabled={submitting}>
              {submitting ? "Đang lưu..." : editTarget ? "Lưu thay đổi" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá loại sản phẩm"
        description={`Xoá loại "${deleteTarget?.name}"? Không thể xoá nếu đang được dùng trong sản phẩm.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
