"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  phone: string;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (customerSearch) params.set("search", customerSearch);
    params.set("limit", "50");
    params.set("status", "ACTIVE");
    fetch(`${API_URL}/api/customers?${params}`)
      .then((r) => r.json())
      .then((json) => setCustomers(json.data ?? []))
      .catch(() => {});
  }, [customerSearch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { toast.error("Vui lòng chọn khách hàng."); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { customerId };
      if (expiryDate) body.expiryDate = expiryDate;
      if (note.trim()) body.note = note.trim();

      const res = await fetch(`${API_URL}/api/quotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể tạo báo giá.");
        return;
      }

      const data = await res.json();
      toast.success("Tạo báo giá thành công.");
      router.push(`/quotations/${data.id}`);
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tạo báo giá mới" description="Chọn khách hàng và điền thông tin cơ bản." />

      <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
        <fieldset className="space-y-4">
          <div className="space-y-2">
            <Label>Khách hàng *</Label>
            <Input
              placeholder="Tìm theo tên hoặc số điện thoại..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerId("");
              }}
              className="mb-2"
            />
            <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Chọn khách hàng..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Ngày hết hạn <span className="text-muted-foreground">(tuỳ chọn)</span></Label>
            <Input
              id="expiryDate"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú <span className="text-muted-foreground">(tuỳ chọn)</span></Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Ghi chú nội bộ..."
            />
          </div>
        </fieldset>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !customerId}>
            {submitting ? "Đang tạo..." : "Tạo báo giá"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/quotations")}>
            Huỷ
          </Button>
        </div>
      </form>
    </div>
  );
}
