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
import { apiGet, apiPatch, ApiError } from "@/lib/api";

interface FilterOption {
  id: string;
  name: string;
}

interface CustomerData {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  taxCode: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  customerGroupId: string | null;
  deliveryRouteId: string | null;
  priority: string;
  status: string;
  debtLimit: string;
  debtTermDays: number;
  note: string | null;
  defaultCarrierName: string | null;
  defaultCarrierPhone: string | null;
  defaultCarrierNote: string | null;
}

interface CustomerEditFormProps {
  customer: CustomerData;
}

export function CustomerEditForm({ customer }: CustomerEditFormProps) {
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
      email: form.get("email") || null,
      companyName: form.get("companyName") || null,
      taxCode: form.get("taxCode") || null,
      province: form.get("province") || null,
      district: form.get("district") || null,
      ward: form.get("ward") || null,
      address: form.get("address") || null,
      note: form.get("note") || null,
      priority: form.get("priority"),
      status: form.get("status"),
      defaultCarrierName: form.get("defaultCarrierName") || null,
      defaultCarrierPhone: form.get("defaultCarrierPhone") || null,
      defaultCarrierNote: form.get("defaultCarrierNote") || null,
    };

    const customerGroupId = form.get("customerGroupId");
    body.customerGroupId = customerGroupId && customerGroupId !== "none" ? customerGroupId : null;

    const deliveryRouteId = form.get("deliveryRouteId");
    body.deliveryRouteId = deliveryRouteId && deliveryRouteId !== "none" ? deliveryRouteId : null;

    const debtLimit = form.get("debtLimit");
    if (debtLimit !== null) body.debtLimit = Number(debtLimit);

    const debtTermDays = form.get("debtTermDays");
    if (debtTermDays !== null) body.debtTermDays = Number(debtTermDays);

    try {
      await apiPatch(`/customers/${customer.id}`, body);
      toast.success("Cập nhật thành công.");
      router.push(`/customers/${customer.id}`);
      router.refresh();
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
            <Label>Mã KH</Label>
            <Input value={customer.code} disabled />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select name="status" defaultValue={customer.status}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Hoạt động</SelectItem>
                <SelectItem value="INACTIVE">Ngừng hoạt động</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên khách hàng *</Label>
            <Input id="name" name="name" defaultValue={customer.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Số điện thoại *</Label>
            <Input id="phone" name="phone" defaultValue={customer.phone} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={customer.email ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">
              Tên công ty <span className="text-muted-foreground">(khách doanh nghiệp)</span>
            </Label>
            <Input id="companyName" name="companyName" defaultValue={customer.companyName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxCode">Mã số thuế</Label>
            <Input id="taxCode" name="taxCode" defaultValue={customer.taxCode ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="province">Tỉnh/Thành phố</Label>
            <Input id="province" name="province" defaultValue={customer.province ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">Quận/Huyện</Label>
            <Input id="district" name="district" defaultValue={customer.district ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ward">Phường/Xã</Label>
            <Input id="ward" name="ward" defaultValue={customer.ward ?? ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Địa chỉ chi tiết</Label>
          <Input id="address" name="address" defaultValue={customer.address ?? ""} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">Thông tin kinh doanh</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nhóm khách hàng</Label>
            <Select name="customerGroupId" defaultValue={customer.customerGroupId ?? "none"}>
              <SelectTrigger><SelectValue placeholder="Chọn nhóm" /></SelectTrigger>
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
            <Select name="deliveryRouteId" defaultValue={customer.deliveryRouteId ?? "none"}>
              <SelectTrigger><SelectValue placeholder="Chọn tuyến" /></SelectTrigger>
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
            <Select name="priority" defaultValue={customer.priority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Thấp</SelectItem>
                <SelectItem value="MEDIUM">Trung bình</SelectItem>
                <SelectItem value="HIGH">Cao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtTermDays">Thời hạn công nợ (ngày)</Label>
            <Input id="debtTermDays" name="debtTermDays" type="number" min={0} defaultValue={customer.debtTermDays} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="debtLimit">Hạn mức công nợ (VNĐ)</Label>
          <Input id="debtLimit" name="debtLimit" type="number" min={0} defaultValue={Number(customer.debtLimit)} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium text-muted-foreground">
          Thông tin giao hàng <span className="text-xs">(nhà xe mặc định — tự điền vào đơn hàng mới khi duyệt báo giá)</span>
        </legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="defaultCarrierName">Nhà xe</Label>
            <Input id="defaultCarrierName" name="defaultCarrierName" defaultValue={customer.defaultCarrierName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultCarrierPhone">SĐT nhà xe</Label>
            <Input id="defaultCarrierPhone" name="defaultCarrierPhone" defaultValue={customer.defaultCarrierPhone ?? ""} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCarrierNote">Ghi chú giao hàng</Label>
          <Input id="defaultCarrierNote" name="defaultCarrierNote" defaultValue={customer.defaultCarrierNote ?? ""} />
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="note">Ghi chú</Label>
        <Textarea id="note" name="note" rows={3} defaultValue={customer.note ?? ""} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/customers/${customer.id}`)}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
