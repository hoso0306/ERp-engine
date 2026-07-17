"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading, ErrorState } from "@/components/shared";
import { toast } from "sonner";
import { apiGet, apiPut, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Company {
  id: string;
  companyName: string;
  logo: string | null;
  stamp: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  currency: string;
  currencySymbol: string;
  timezone: string;
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB — ảnh gốc trước khi convert base64

export function CompanyForm() {
  const { hasPermission } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Company>>({});

  const fetchCompany = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Company>("/settings/company");
      setCompany(data);
      setForm(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải thông tin công ty.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  function set<K extends keyof Company>(key: K, value: Company[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleImageSelect(key: "logo" | "stamp", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ chấp nhận file ảnh.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Ảnh vượt quá 2MB, vui lòng chọn ảnh nhỏ hơn.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set(key, reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName?.trim()) { toast.error("Tên công ty là bắt buộc."); return; }
    setSaving(true);
    try {
      const updated = await apiPut<Company>("/settings/company", form);
      setCompany(updated);
      setForm(updated);
      toast.success("Đã lưu thông tin công ty.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !company) return <ErrorState description={error ?? "Không tìm thấy Company Settings."} onRetry={fetchCompany} />;

  const canEdit = hasPermission("settings.update");

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="logo">Logo công ty</Label>
          <div className="flex items-center gap-3">
            {form.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo} alt="Logo" className="h-14 w-14 rounded border object-contain bg-white" />
            )}
            <div className="flex flex-col gap-1">
              <Input
                id="logo"
                type="file"
                accept="image/*"
                disabled={!canEdit}
                onChange={(e) => handleImageSelect("logo", e.target.files?.[0])}
              />
              {form.logo && canEdit && (
                <button type="button" className="text-xs text-muted-foreground underline self-start" onClick={() => set("logo", null)}>
                  Xoá ảnh
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stamp">Con dấu công ty</Label>
          <div className="flex items-center gap-3">
            {form.stamp && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.stamp} alt="Con dấu" className="h-14 w-14 rounded border object-contain bg-white" />
            )}
            <div className="flex flex-col gap-1">
              <Input
                id="stamp"
                type="file"
                accept="image/*"
                disabled={!canEdit}
                onChange={(e) => handleImageSelect("stamp", e.target.files?.[0])}
              />
              {form.stamp && canEdit && (
                <button type="button" className="text-xs text-muted-foreground underline self-start" onClick={() => set("stamp", null)}>
                  Xoá ảnh
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="companyName">Tên công ty *</Label>
          <Input
            id="companyName"
            value={form.companyName ?? ""}
            onChange={(e) => set("companyName", e.target.value)}
            disabled={!canEdit}
            required
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Số điện thoại</Label>
          <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxCode">Mã số thuế</Label>
          <Input id="taxCode" value={form.taxCode ?? ""} onChange={(e) => set("taxCode", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankName">Ngân hàng</Label>
          <Input id="bankName" value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bankAccountNumber">Số tài khoản</Label>
          <Input id="bankAccountNumber" value={form.bankAccountNumber ?? ""} onChange={(e) => set("bankAccountNumber", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="bankAccountHolder">Tên chủ tài khoản</Label>
          <Input id="bankAccountHolder" value={form.bankAccountHolder ?? ""} onChange={(e) => set("bankAccountHolder", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Đơn vị tiền tệ (nhãn)</Label>
          <Input id="currency" value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currencySymbol">Ký hiệu tiền tệ</Label>
          <Input id="currencySymbol" value={form.currencySymbol ?? ""} onChange={(e) => set("currencySymbol", e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="timezone">Múi giờ</Label>
          <Input id="timezone" value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      {canEdit && (
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      )}
    </form>
  );
}
