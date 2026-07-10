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
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxCode: string | null;
  currency: string;
  currencySymbol: string;
  timezone: string;
}

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
