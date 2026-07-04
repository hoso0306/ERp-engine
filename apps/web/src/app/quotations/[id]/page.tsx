"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Pencil, Plus, ArrowLeft, Send, XCircle, CheckCircle, FileDown, Settings2, Clock } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { QuotationStatusBadge } from "@/components/quotation/quotation-status-badge";
import { QuotationItemDialog } from "@/components/quotation/quotation-item-dialog";
import { QuotationItemTable } from "@/components/quotation/quotation-item-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface QuotationItemParam {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface QuotationItem {
  id: string;
  productId: string;
  quantity: number;
  systemPrice: number;
  groupDiscount: number;
  additionalDiscountPercent: number;
  additionalDiscountAmount: number;
  discountReason: string | null;
  discountBy: string | null;
  finalPrice: number;
  subtotal: number;
  product: { id: string; code: string; name: string };
  parameters: QuotationItemParam[];
}

interface QuotationTimeline {
  id: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
}

interface Quotation {
  id: string;
  code: string;
  status: string;
  expiryDate: string | null;
  note: string | null;
  salesOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
    customerGroup: { id: string; name: string; discountPercent: number } | null;
  };
  items: QuotationItem[];
  timeline: QuotationTimeline[];
}

const TIMELINE_LABEL: Record<string, string> = {
  QUOTATION_CREATED: "Tạo báo giá",
  QUOTATION_SENT: "Gửi báo giá",
  QUOTATION_APPROVED: "Khách đã duyệt",
  QUOTATION_CANCELLED: "Huỷ báo giá",
  QUOTATION_MANUAL_OVERRIDE: "Điều chỉnh thủ công",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  APPROVED: "Đã duyệt",
  CANCELLED: "Đã huỷ",
};

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date(new Date().toDateString());
}

function isEditable(status: string): boolean {
  return status === "DRAFT" || status === "SENT";
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit header dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editExpiry, setEditExpiry] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuotationItem | null>(null);

  // Cancel dialog (Task 05)
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  // Send action (Task 05)
  const [sending, setSending] = useState(false);

  // Approve action (Task 06)
  const [approving, setApproving] = useState(false);

  // Manual Override dialog (Task 08)
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideBy, setOverrideBy] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const fetchQuotation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}`);
      if (!res.ok) { setError("Không tìm thấy báo giá."); return; }
      const data = await res.json();
      setQuotation(data);
    } catch {
      setError("Không thể tải báo giá.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchQuotation(); }, [fetchQuotation]);

  function openEditHeader() {
    if (!quotation) return;
    setEditExpiry(
      quotation.expiryDate ? new Date(quotation.expiryDate).toISOString().split("T")[0] : "",
    );
    setEditNote(quotation.note ?? "");
    setEditOpen(true);
  }

  async function saveHeader(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editNote.trim() || null, expiryDate: editExpiry || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể lưu.");
        return;
      }
      toast.success("Đã cập nhật.");
      setEditOpen(false);
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleApprove() {
    if (!confirm("Xác nhận khách hàng đã duyệt báo giá này? Hành động sẽ sinh Đơn hàng và Phiếu sản xuất.")) return;
    setApproving(true);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể duyệt báo giá.");
        return;
      }
      toast.success("Đã duyệt báo giá. Đơn hàng và Phiếu sản xuất đã được tạo.");
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSend() {
    if (!confirm("Xác nhận gửi báo giá cho khách hàng?")) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể gửi báo giá.");
        return;
      }
      toast.success("Đã gửi báo giá.");
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelReason.trim()) { toast.error("Vui lòng nhập lý do huỷ."); return; }
    setCancelSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể huỷ báo giá.");
        return;
      }
      toast.success("Đã huỷ báo giá.");
      setCancelOpen(false);
      setCancelReason("");
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setCancelSaving(false);
    }
  }

  async function handleOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideStatus) { toast.error("Vui lòng chọn trạng thái mới."); return; }
    if (!overrideReason.trim()) { toast.error("Vui lòng nhập lý do điều chỉnh."); return; }
    setOverrideSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStatus: overrideStatus,
          reason: overrideReason.trim(),
          overrideBy: overrideBy.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể điều chỉnh.");
        return;
      }
      toast.success("Đã điều chỉnh trạng thái.");
      setOverrideOpen(false);
      setOverrideReason("");
      setOverrideBy("");
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setOverrideSaving(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Xoá sản phẩm này khỏi báo giá?")) return;
    try {
      const res = await fetch(`${API_URL}/api/quotations/${id}/items/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể xoá.");
        return;
      }
      toast.success("Đã xoá sản phẩm.");
      fetchQuotation();
    } catch {
      toast.error("Lỗi kết nối server.");
    }
  }

  if (loading) return <Loading />;
  if (error || !quotation) return <ErrorState description={error ?? "Không tìm thấy báo giá."} onRetry={fetchQuotation} />;

  const editable = isEditable(quotation.status);
  const expired = isExpired(quotation.expiryDate);
  const groupDiscount = Number(quotation.customer.customerGroup?.discountPercent ?? 0);
  const canCancel = quotation.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={quotation.code}
        description={`Báo giá cho ${quotation.customer.name}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/quotations")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {editable && (
              <Button variant="outline" onClick={openEditHeader}>
                <Pencil className="mr-2 h-4 w-4" />
                Sửa thông tin
              </Button>
            )}
            {/* Task 07: PDF download */}
            {quotation.status !== "CANCELLED" && (
              <a href={`/quotations/${id}/print`} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <FileDown className="mr-2 h-4 w-4" />
                  Tải PDF
                </Button>
              </a>
            )}
            {/* Task 05: Send */}
            {quotation.status === "DRAFT" && (
              <Button onClick={handleSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Đang gửi..." : "Gửi báo giá"}
              </Button>
            )}
            {/* Task 06: Approve */}
            {quotation.status === "SENT" && (
              <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                {approving ? "Đang xử lý..." : "Khách đã duyệt"}
              </Button>
            )}
            {/* Task 05: Cancel */}
            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => { setCancelReason(""); setCancelOpen(true); }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Huỷ báo giá
              </Button>
            )}
            {/* Task 08: Manual Override */}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setOverrideStatus("");
                setOverrideReason("");
                setOverrideBy("");
                setOverrideOpen(true);
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Override
            </Button>
          </div>
        }
      />

      {/* Header Info */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">Trạng thái</span>
            <QuotationStatusBadge status={quotation.status} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">Khách hàng</span>
            <span className="font-medium">{quotation.customer.name}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">Số điện thoại</span>
            <span>{quotation.customer.phone}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">Nhóm KH</span>
            <span>{quotation.customer.customerGroup?.name ?? "—"}</span>
          </div>
          {groupDiscount > 0 && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32 shrink-0">CK nhóm</span>
              <Badge variant="secondary">{groupDiscount}%</Badge>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <span className="text-muted-foreground w-32 shrink-0">Ngày hết hạn</span>
            {quotation.expiryDate ? (
              <span className={expired ? "text-destructive flex items-center gap-1" : ""}>
                {expired && <AlertCircle className="h-4 w-4" />}
                {new Date(quotation.expiryDate).toLocaleDateString("vi-VN")}
                {expired && (
                  <Badge variant="destructive" className="ml-1 text-xs">Đã quá hạn</Badge>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          {quotation.salesOrderId && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-32 shrink-0">Đơn hàng</span>
              <Badge variant="secondary" className="font-mono text-xs">Đã tạo đơn hàng</Badge>
            </div>
          )}
          {quotation.note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-32 shrink-0">Ghi chú</span>
              <span>{quotation.note}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Items section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Danh sách sản phẩm</h3>
          {editable && (
            <Button
              onClick={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Thêm sản phẩm
            </Button>
          )}
        </div>

        <QuotationItemTable
          items={quotation.items}
          editable={editable}
          onEdit={(item) => {
            setEditingItem(item);
            setItemDialogOpen(true);
          }}
          onDelete={deleteItem}
        />
      </div>

      {/* Edit Header Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa thông tin báo giá</DialogTitle>
          </DialogHeader>
          <form id="edit-header-form" onSubmit={saveHeader} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-expiry">Ngày hết hạn</Label>
              <Input
                id="edit-expiry"
                type="date"
                value={editExpiry}
                onChange={(e) => setEditExpiry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Ghi chú</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Huỷ</Button>
            <Button type="submit" form="edit-header-form" disabled={editSaving}>
              {editSaving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog (Task 05) */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Huỷ báo giá {quotation.code}</DialogTitle>
          </DialogHeader>
          <form id="cancel-form" onSubmit={handleCancel} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hành động này không thể hoàn tác. Vui lòng nhập lý do huỷ.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Lý do huỷ *</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Khách đổi ý, báo giá sai thông số..."
                required
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Đóng</Button>
            <Button
              type="submit"
              form="cancel-form"
              variant="destructive"
              disabled={cancelSaving || !cancelReason.trim()}
            >
              {cancelSaving ? "Đang huỷ..." : "Xác nhận huỷ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Override Dialog (Task 08) */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Điều chỉnh thủ công — {quotation.code}</DialogTitle>
          </DialogHeader>
          <form id="override-form" onSubmit={handleOverride} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Trạng thái hiện tại:{" "}
              <strong>{STATUS_LABEL[quotation.status] ?? quotation.status}</strong>
            </p>
            <div className="space-y-2">
              <Label>Trạng thái mới *</Label>
              <Select
                value={overrideStatus}
                onValueChange={(v) => setOverrideStatus(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL)
                    .filter(([k]) => k !== quotation.status)
                    .map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">Lý do *</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Mô tả lý do điều chỉnh thủ công..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-by">Người thực hiện</Label>
              <Input
                id="override-by"
                value={overrideBy}
                onChange={(e) => setOverrideBy(e.target.value)}
                placeholder="Tên người duyệt override..."
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Đóng</Button>
            <Button
              type="submit"
              form="override-form"
              variant="destructive"
              disabled={overrideSaving || !overrideStatus || !overrideReason.trim()}
            >
              {overrideSaving ? "Đang lưu..." : "Xác nhận Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Add/Edit Dialog */}
      <QuotationItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        quotationId={id}
        groupDiscount={groupDiscount}
        item={editingItem}
        onSaved={fetchQuotation}
      />

      {/* Timeline Section (Task 08) */}
      {quotation.timeline && quotation.timeline.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lịch sử hoạt động
            </h3>
            <ol className="relative border-l border-muted-foreground/20 ml-3 space-y-4">
              {quotation.timeline.map((entry) => {
                const payload = entry.payload as Record<string, unknown> | null;
                return (
                  <li key={entry.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
                    <div className="text-sm font-medium">
                      {TIMELINE_LABEL[entry.action] ?? entry.action}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("vi-VN")}
                      {entry.createdBy && ` — ${entry.createdBy}`}
                    </div>
                    {payload && (
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {!!payload.reason && (
                          <div>Lý do: <span className="text-foreground">{String(payload.reason)}</span></div>
                        )}
                        {!!payload.salesOrderCode && (
                          <div>Đơn hàng: <span className="text-foreground font-mono">{String(payload.salesOrderCode)}</span></div>
                        )}
                        {Array.isArray(payload.productionOrders) && payload.productionOrders.length > 0 && (
                          <div>Phiếu sản xuất: <span className="text-foreground font-mono">{(payload.productionOrders as string[]).join(", ")}</span></div>
                        )}
                        {!!payload.oldStatus && !!payload.newStatus && (
                          <div>
                            Trạng thái: <span className="text-foreground">
                              {STATUS_LABEL[String(payload.oldStatus)] ?? String(payload.oldStatus)}
                            </span>
                            {" → "}
                            <span className="text-foreground">
                              {STATUS_LABEL[String(payload.newStatus)] ?? String(payload.newStatus)}
                            </span>
                          </div>
                        )}
                        {!!payload.overrideBy && (
                          <div>Người thực hiện: <span className="text-foreground">{String(payload.overrideBy)}</span></div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
