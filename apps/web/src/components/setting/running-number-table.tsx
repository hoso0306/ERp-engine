"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiPut, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface RunningNumber {
  id: string;
  type: string;
  prefix: string;
  lastNumber: number;
  paddingLength: number;
  enabled: boolean;
}

interface RunningNumberTableProps {
  runningNumbers: RunningNumber[];
  onSaved: () => void;
}

export function RunningNumberTable({ runningNumbers, onSaved }: RunningNumberTableProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("settings.update");
  const [editing, setEditing] = useState<RunningNumber | null>(null);
  const [prefix, setPrefix] = useState("");
  const [paddingLength, setPaddingLength] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  function openEdit(rn: RunningNumber) {
    setEditing(rn);
    setPrefix(rn.prefix);
    setPaddingLength(String(rn.paddingLength));
    setEnabled(rn.enabled);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!prefix.trim()) { toast.error("Prefix là bắt buộc."); return; }
    const padding = parseInt(paddingLength, 10);
    if (!padding || padding <= 0) { toast.error("Padding Length phải lớn hơn 0."); return; }

    setSaving(true);
    try {
      await apiPut(`/settings/running-numbers/${editing.type}`, {
        prefix: prefix.trim(),
        paddingLength: padding,
        enabled,
      });
      toast.success("Đã lưu.");
      setEditing(null);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loại chứng từ</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead className="text-right">Số hiện tại</TableHead>
              <TableHead className="text-right">Padding</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              {canEdit && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {runningNumbers.map((rn) => (
              <TableRow key={rn.id}>
                <TableCell className="font-mono text-xs">{rn.type}</TableCell>
                <TableCell className="font-medium">{rn.prefix}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{rn.lastNumber}</TableCell>
                <TableCell className="text-right text-sm">{rn.paddingLength}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={rn.enabled ? "default" : "secondary"}>
                    {rn.enabled ? "Đang dùng" : "Đã ẩn"}
                  </Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(rn)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sửa {editing?.type}</DialogTitle>
          </DialogHeader>
          <form id="running-number-form" onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rn-prefix">Prefix</Label>
              <Input id="rn-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rn-padding">Padding Length</Label>
              <Input
                id="rn-padding"
                type="number"
                min="1"
                value={paddingLength}
                onChange={(e) => setPaddingLength(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rn-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
              <Label htmlFor="rn-enabled" className="cursor-pointer">Hiển thị trong menu/UI</Label>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Huỷ</Button>
            <Button type="submit" form="running-number-form" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
