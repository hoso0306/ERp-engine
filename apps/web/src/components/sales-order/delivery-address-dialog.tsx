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

export interface DeliveryAddressValue {
  deliveryName: string;
  deliveryPhone: string;
  deliveryAddress: string | null;
  deliveryProvince: string | null;
  deliveryDistrict: string | null;
  deliveryWard: string | null;
}

interface DeliveryAddressDialogProps {
  salesOrderId: string;
  salesOrderCode: string;
  value: DeliveryAddressValue;
  onSaved: () => void;
  size?: "sm" | "default";
}

// Dùng chung ở 3 nơi (Đơn hàng, Phiếu sản xuất, xem trước bản in) — sửa địa
// chỉ tác động SalesOrder.delivery* của đơn này, không đụng Customer (xem
// knowledge/modules/order.md mục "Địa chỉ giao hàng"). Không bắt buộc lý do,
// sửa được ở mọi Status.
export function DeliveryAddressDialog({
  salesOrderId,
  salesOrderCode,
  value,
  onSaved,
  size = "sm",
}: DeliveryAddressDialogProps) {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryProvince, setDeliveryProvince] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryWard, setDeliveryWard] = useState("");
  const [saving, setSaving] = useState(false);

  if (!hasPermission("sales-order.view")) return null;

  function openDialog() {
    setDeliveryName(value.deliveryName);
    setDeliveryPhone(value.deliveryPhone);
    setDeliveryAddress(value.deliveryAddress ?? "");
    setDeliveryProvince(value.deliveryProvince ?? "");
    setDeliveryDistrict(value.deliveryDistrict ?? "");
    setDeliveryWard(value.deliveryWard ?? "");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deliveryName.trim() || !deliveryPhone.trim()) {
      toast.error("Vui lòng nhập tên và số điện thoại nhận hàng.");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/sales-orders/${salesOrderId}/update-delivery-address`, {
        deliveryName: deliveryName.trim(),
        deliveryPhone: deliveryPhone.trim(),
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryProvince: deliveryProvince.trim() || null,
        deliveryDistrict: deliveryDistrict.trim() || null,
        deliveryWard: deliveryWard.trim() || null,
      });
      toast.success("Đã cập nhật địa chỉ giao hàng.");
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
            <DialogTitle>Sửa địa chỉ giao hàng — {salesOrderCode}</DialogTitle>
          </DialogHeader>
          <form id={`delivery-form-${salesOrderId}`} onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chỉ áp dụng cho đơn hàng này — không ảnh hưởng địa chỉ mặc định của khách hàng.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`delivery-name-${salesOrderId}`}>Người nhận *</Label>
                <Input
                  id={`delivery-name-${salesOrderId}`}
                  value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`delivery-phone-${salesOrderId}`}>Số điện thoại *</Label>
                <Input
                  id={`delivery-phone-${salesOrderId}`}
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`delivery-address-${salesOrderId}`}>Địa chỉ</Label>
              <Textarea
                id={`delivery-address-${salesOrderId}`}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={2}
                placeholder="Số nhà, đường, công trình..."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`delivery-ward-${salesOrderId}`}>Phường/Xã</Label>
                <Input
                  id={`delivery-ward-${salesOrderId}`}
                  value={deliveryWard}
                  onChange={(e) => setDeliveryWard(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`delivery-district-${salesOrderId}`}>Quận/Huyện</Label>
                <Input
                  id={`delivery-district-${salesOrderId}`}
                  value={deliveryDistrict}
                  onChange={(e) => setDeliveryDistrict(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`delivery-province-${salesOrderId}`}>Tỉnh/Thành</Label>
                <Input
                  id={`delivery-province-${salesOrderId}`}
                  value={deliveryProvince}
                  onChange={(e) => setDeliveryProvince(e.target.value)}
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button
              type="submit"
              form={`delivery-form-${salesOrderId}`}
              disabled={saving || !deliveryName.trim() || !deliveryPhone.trim()}
            >
              {saving ? "Đang lưu..." : "Lưu địa chỉ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}