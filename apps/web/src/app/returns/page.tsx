"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { ReturnTable } from "@/components/return/return-table";
import { RecoveryInventoryTable, type RecoveryInventoryRow } from "@/components/return/recovery-inventory-table";
import { MarkUsedDialog } from "@/components/return/mark-used-dialog";
import { RecoveryInventoryEditDialog } from "@/components/return/recovery-inventory-edit-dialog";
import { ConfirmDialog } from "@/components/shared";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface ReturnRow {
  id: string;
  code: string;
  salesOrderId: string;
  salesOrderCode: string;
  customerName: string;
  returnDate: string;
  status: string;
  _count: { items: number };
}

export default function ReturnsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState("returns");

  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recoveryItems, setRecoveryItems] = useState<RecoveryInventoryRow[]>([]);
  const [recoveryMeta, setRecoveryMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [recoverySearch, setRecoverySearch] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("all");
  const [recoveryPage, setRecoveryPage] = useState(1);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [markUsedTarget, setMarkUsedTarget] = useState<RecoveryInventoryRow | null>(null);
  const [disposeTarget, setDisposeTarget] = useState<RecoveryInventoryRow | null>(null);
  const [editTarget, setEditTarget] = useState<RecoveryInventoryRow | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: ReturnRow[]; meta: typeof meta }>(`/returns?${params}`);
      setReturns(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách phiếu hoàn.");
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    if (tab !== "returns") return;
    const timer = setTimeout(fetchReturns, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, fetchReturns, search]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const fetchRecovery = useCallback(async () => {
    setRecoveryLoading(true);
    setRecoveryError(null);
    try {
      const params = new URLSearchParams();
      if (recoverySearch) params.set("search", recoverySearch);
      if (recoveryStatus !== "all") params.set("status", recoveryStatus);
      params.set("page", String(recoveryPage));
      params.set("limit", "10");

      const json = await apiGet<{ data: RecoveryInventoryRow[]; meta: typeof recoveryMeta }>(`/recovery-inventory?${params}`);
      setRecoveryItems(json.data);
      setRecoveryMeta(json.meta);
    } catch {
      setRecoveryError("Không thể tải kho thu hồi.");
    } finally {
      setRecoveryLoading(false);
    }
  }, [recoverySearch, recoveryStatus, recoveryPage]);

  useEffect(() => {
    if (tab !== "recovery") return;
    const timer = setTimeout(fetchRecovery, recoverySearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, fetchRecovery, recoverySearch]);

  useEffect(() => {
    setRecoveryPage(1);
  }, [recoverySearch, recoveryStatus]);

  async function handleDispose() {
    if (!disposeTarget) return;
    try {
      await apiPost(`/recovery-inventory/${disposeTarget.id}/dispose`);
      toast.success("Đã thanh lý hàng thu hồi.");
      fetchRecovery();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setDisposeTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng hoàn"
        description="Ghi nhận hàng khách trả và quản lý kho thu hồi"
        actions={
          hasPermission("return.create") && (
            <Button onClick={() => router.push("/returns/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo phiếu hoàn
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="returns">Phiếu hoàn</TabsTrigger>
          <TabsTrigger value="recovery">Kho thu hồi</TabsTrigger>
        </TabsList>

        <TabsContent value="returns" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã phiếu, mã đơn, tên khách hàng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="PROCESSING">Đang xử lý</SelectItem>
                <SelectItem value="COMPLETED">Hoàn tất</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading && <Loading />}
          {error && <ErrorState description={error} onRetry={fetchReturns} />}
          {!loading && !error && returns.length === 0 && (
            <EmptyState title="Không có phiếu hoàn" description="Không có phiếu hoàn nào khớp bộ lọc." />
          )}
          {!loading && !error && returns.length > 0 && (
            <ReturnTable
              returns={returns}
              meta={meta}
              onPageChange={setPage}
              canViewOrder={hasPermission("sales-order.view")}
            />
          )}
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo mã, sản phẩm, mã phiếu gốc..."
                value={recoverySearch}
                onChange={(e) => setRecoverySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={recoveryStatus} onValueChange={(v) => setRecoveryStatus(v ?? "all")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="AVAILABLE">Còn trong kho</SelectItem>
                <SelectItem value="USED">Đã sử dụng</SelectItem>
                <SelectItem value="DISPOSED">Đã thanh lý</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recoveryLoading && <Loading />}
          {recoveryError && <ErrorState description={recoveryError} onRetry={fetchRecovery} />}
          {!recoveryLoading && !recoveryError && recoveryItems.length === 0 && (
            <EmptyState title="Không có hàng thu hồi" description="Không có hàng thu hồi nào khớp bộ lọc." />
          )}
          {!recoveryLoading && !recoveryError && recoveryItems.length > 0 && (
            <RecoveryInventoryTable
              items={recoveryItems}
              meta={recoveryMeta}
              onPageChange={setRecoveryPage}
              canMarkUsed={hasPermission("return.mark-used")}
              canDispose={hasPermission("return.dispose")}
              canUpdate={hasPermission("return.update")}
              onMarkUsed={setMarkUsedTarget}
              onDispose={setDisposeTarget}
              onEdit={setEditTarget}
            />
          )}
        </TabsContent>
      </Tabs>

      <MarkUsedDialog
        open={!!markUsedTarget}
        onOpenChange={(v) => { if (!v) setMarkUsedTarget(null); }}
        itemId={markUsedTarget?.id ?? null}
        onSaved={fetchRecovery}
      />

      <RecoveryInventoryEditDialog
        open={!!editTarget}
        onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        item={editTarget}
        onSaved={fetchRecovery}
      />

      <ConfirmDialog
        open={!!disposeTarget}
        onOpenChange={(v) => { if (!v) setDisposeTarget(null); }}
        title="Thanh lý hàng thu hồi"
        description={`Xác nhận thanh lý "${disposeTarget?.productName ?? ""}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Thanh lý"
        variant="destructive"
        onConfirm={handleDispose}
      />
    </div>
  );
}
