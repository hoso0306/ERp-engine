"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import {
  ValidationRuleDialog,
  type ValidationRule,
} from "@/components/product/validation-rule-dialog";
import type { ConditionParameter } from "@/components/product/condition-builder";

export function ValidationRuleSection({ productId }: { productId: string }) {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [parameters, setParameters] = useState<ConditionParameter[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ValidationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ValidationRule | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await apiGet<ValidationRule[]>(`/products/${productId}/validation-rules`);
      setRules(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
    apiGet<ConditionParameter[]>(`/products/${productId}/parameters`)
      .then(setParameters)
      .catch(() => {});
  }, [productId, loadData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/products/${productId}/validation-rules/${deleteTarget.id}`);
      toast.success("Đã xoá.");
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Validation Rule (cảnh báo/chặn khi cấu hình bất thường)
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm Rule
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có Validation Rule nào.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Điều kiện vi phạm</TableHead>
                <TableHead className="w-24">Mức độ</TableHead>
                <TableHead>Thông báo</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.expression}</TableCell>
                  <TableCell>
                    <Badge variant={r.severity === "BLOCK" ? "destructive" : "secondary"}>
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.message}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditTarget(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ValidationRuleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        productId={productId}
        parameters={parameters}
        onSaved={loadData}
      />
      <ValidationRuleDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        productId={productId}
        parameters={parameters}
        item={editTarget}
        onSaved={loadData}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá Validation Rule"
        description={`Xoá rule "${deleteTarget?.message}"?`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
