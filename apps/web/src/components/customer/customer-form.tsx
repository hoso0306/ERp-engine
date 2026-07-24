"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface FilterOption {
  id: string;
  name: string;
}

export function CustomerForm() {
  const router = useRouter();
  const [groups, setGroups] = useState<FilterOption[]>([]);
  const [routes, setRoutes] = useState<FilterOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<FilterOption[]>("/customers/groups").then(setGroups).catch(() => {});
    apiGet<FilterOption[]>("/customers/routes").then(setRoutes).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      phone: form.get("phone"),
    };

    const optional = [
      "email", "companyName", "taxCode", "province", "district", "ward", "address", "note",
      "defaultCarrierName", "defaultCarrierPhone", "defaultCarrierNote",
    ];
    for (const key of optional) {
      const val = form.get(key);
      if (val && String(val).trim()) body[key] = String(val).trim();
    }

    const customerGroupId = form.get("customerGroupId");
    if (customerGroupId && customerGroupId !== "none") body.customerGroupId = customerGroupId;

    const deliveryRouteId = form.get("deliveryRouteId");
    if (deliveryRouteId && deliveryRouteId !== "none") body.deliveryRouteId = deliveryRouteId;

    const priority = form.get("priority");
    if (priority) body.priority = priority;

    const debtLimit = form.get("debtLimit");
    if (debtLimit && String(debtLimit).trim()) body.debtLimit = Number(debtLimit);

    const debtTermDays = form.get("debtTermDays");
    if (debtTermDays && String(debtTermDays).trim()) body.debtTermDays = Number(debtTermDays);

    try {
      await apiPost("/customers", body);
      toast.success("Tạo khách hàng thành công.");
      router.push("/customers");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin cơ bản</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên khách hàng *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại *</Label>
            <Input id="phone" name="phone" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              Tên công ty <span className="text-muted-foreground">(khách doanh nghiệp)</span>
            </Label>
            <Input id="companyName" name="companyName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxCode">Mã số thuế</Label>
            <Input id="taxCode" name="taxCode" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="province">Tỉnh/Thành phố</Label>
            <Input id="province" name="province" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">Quận/Huyện</Label>
            <Input id="district" name="district" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ward">Phường/Xã</Label>
            <Input id="ward" name="ward" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Địa chỉ chi tiết</Label>
          <Input id="address" name="address" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin kinh doanh</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nhóm khách hàng</Label>
            <Select name="customerGroupId" defaultValue="none">
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhóm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không chọn</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tuyến giao hàng</Label>
            <Select name="deliveryRouteId" defaultValue="none">
              <SelectTrigger>
                <SelectValue placeholder="Chọn tuyến" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không chọn</SelectItem>
                {routes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mức độ ưu tiên</Label>
            <Select name="priority" defaultValue="MEDIUM">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Thấp</SelectItem>
                <SelectItem value="MEDIUM">Trung bình</SelectItem>
                <SelectItem value="HIGH">Cao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtTermDays">Thời hạn công nợ (ngày)</Label>
            <Input id="debtTermDays" name="debtTermDays" type="number" min={0} defaultValue={30} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="debtLimit">Hạn mức công nợ (VNĐ)</Label>
          <Input id="debtLimit" name="debtLimit" type="number" min={0} defaultValue={0} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          Thông tin giao hàng <span className="text-xs">(nhà xe mặc định — tự điền vào đơn hàng mới khi duyệt báo giá)</span>
        </legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="defaultCarrierName">Nhà xe</Label>
            <Input id="defaultCarrierName" name="defaultCarrierName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultCarrierPhone">SĐT nhà xe</Label>
            <Input id="defaultCarrierPhone" name="defaultCarrierPhone" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCarrierNote">Ghi chú giao hàng</Label>
          <Input id="defaultCarrierNote" name="defaultCarrierNote" />
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <Textarea id="note" name="note" rows={3} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Tạo khách hàng"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/customers")}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
