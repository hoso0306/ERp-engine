"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CustomerTypeahead,
  type CustomerOption,
} from "@/components/quotation/customer-typeahead";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api";

export default function NewQuotationPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) { toast.error("Vui lòng chọn khách hàng."); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { customerId: customer.id };
      if (expiryDate) body.expiryDate = expiryDate;
      if (note.trim()) body.note = note.trim();

      const data = await apiPost<{ id: string }>("/quotations", body);
      toast.success("Tạo báo giá thành công.");
      router.push(`/quotations/${data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
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
            <CustomerTypeahead value={customer} onChange={setCustomer} />
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
          <Button type="submit" disabled={submitting || !customer}>
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
