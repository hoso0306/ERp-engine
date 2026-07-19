"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export interface CarrierInfoValue {
  carrierName: string | null;
  carrierPhone: string | null;
  carrierNote: string | null;
}

interface CarrierInfoDialogProps {
  salesOrderId: string;
  salesOrderCode: string;
  value: CarrierInfoValue;
  onSaved: () => void;
  size?: "sm" | "default";
}

// Sửa thông tin nhà xe (009-in-phieu-san-xuat.md) — cùng cơ chế với
// DeliveryAddressDialog nhưng khác nhóm dữ liệu: nhà xe chở hàng, không phải
// người/nơi nhận hàng. Không field nào bắt buộc (chưa chắc đã sắp xe lúc in
// phiếu). Không bắt buộc lý do, sửa được ở mọi Status.
export function CarrierInfoDialog({
  salesOrderId,
  salesOrderCode,
  value,
  onSaved,
  size = "sm",
}: CarrierInfoDialogProps) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");
  const [carrierNote, setCarrierNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!hasPermission("sales-order.view")) return null;

  function openDialog() {
    setCarrierName(value.carrierName ?? "");
    setCarrierPhone(value.carrierPhone ?? "");
    setCarrierNote(value.carrierNote ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost(`/sales-orders/${salesOrderId}/update-carrier-info`, {
        carrierName: carrierName.trim() || null,
        carrierPhone: carrierPhone.trim() || null,
        carrierNote: carrierNote.trim() || null,
      });
      toast.success("Đã cập nhật thông tin nhà xe.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size={size} onClick={openDialog}>
        <Pencil className="mr-2 h-3.5 w-3.5" />
        Sửa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa thông tin nhà xe — {salesOrderCode}</DialogTitle>
          </DialogHeader>
          <form id={`carrier-form-${salesOrderId}`} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`carrier-name-${salesOrderId}`}>Tên nhà xe</Label>
              <Input
                id={`carrier-name-${salesOrderId}`}
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`carrier-phone-${salesOrderId}`}>SĐT nhà xe</Label>
              <Input
                id={`carrier-phone-${salesOrderId}`}
                value={carrierPhone}
                onChange={(e) => setCarrierPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`carrier-note-${salesOrderId}`}>Ghi chú</Label>
              <Textarea
                id={`carrier-note-${salesOrderId}`}
                value={carrierNote}
                onChange={(e) => setCarrierNote(e.target.value)}
                rows={2}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="submit" form={`carrier-form-${salesOrderId}`} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
