"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreditCard, Search } from "lucide-react";
import { DebtDashboardPanel } from "@/components/debt/debt-dashboard-panel";
import { DebtGroupSwitch } from "@/components/debt/debt-group-switch";
import { ReceivableByCustomerTable } from "@/components/debt/receivable-by-customer-table";
import { AllocatePaymentDialog } from "@/components/debt/allocate-payment-dialog";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface CustomerDebtRow {
  customerId: string;
  customerName: string;
  customerPhone: string;
  receivableCount: number;
  totalRemaining: number;
  daysOverdue: number | null;
  riskLevel: string | null;
  debtLimit: number;
  creditExceeded: boolean;
}

type CustomerTab = "all" | "overdue" | "credit_exceeded";
type CustomerSort = "remaining_desc" | "name_asc";

// Rà soát tab Công nợ (chốt 26/07/2026) — route riêng cho view gộp theo
// khách hàng, song song /debts (theo đơn hàng). API GET /receivables/by-customer
// group SUM(remainingAmount) theo customerId (xem debt.service.ts).
function DebtsByCustomerPageContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<CustomerDebtRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CustomerTab>("all");
  const [sortBy, setSortBy] = useState<CustomerSort>("remaining_desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tab === "overdue") params.set("overdue", "true");
      if (tab === "credit_exceeded") params.set("creditExceeded", "true");
      params.set("sortBy", sortBy);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: CustomerDebtRow[]; meta: typeof meta }>(
        `/receivables/by-customer?${params}`,
      );
      setRows(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách công nợ theo khách hàng.");
    } finally {
      setLoading(false);
    }
  }, [search, tab, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchRows, search]);

  useEffect(() => {
    setPage(1);
  }, [search, tab, sortBy]);

  // Click-through từ Dashboard (026-cai-tien-dashboard.md mục 7) — tile
  // "Quá hạn"/"Vượt hạn mức" đưa thẳng sang đúng tab tương ứng.
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "overdue") setTab("overdue");
    if (filterParam === "creditExceeded") setTab("credit_exceeded");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công nợ"
        description="Theo dõi công nợ phải thu, gộp theo từng khách hàng"
        actions={
          hasPermission("debt.create-payment") && (
            <Button onClick={() => setAllocateOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Ghi nhận thanh toán
            </Button>
          )
        }
      />

      <DebtGroupSwitch active="customer" />

      <DebtDashboardPanel />

      <div className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab((v as CustomerTab) ?? "all")}>
          <TabsList>
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="overdue">Quá hạn</TabsTrigger>
            <TabsTrigger value="credit_exceeded">Vượt hạn mức</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên / SĐT khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy((v as CustomerSort) ?? "remaining_desc")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="remaining_desc">Số nợ giảm dần</SelectItem>
              <SelectItem value="name_asc">Tên khách hàng (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchRows} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState title="Không có công nợ" description="Không có khách hàng nào khớp bộ lọc." />
      )}
      {!loading && !error && rows.length > 0 && (
        <ReceivableByCustomerTable
          rows={rows}
          meta={meta}
          onPageChange={setPage}
          onPaymentSaved={fetchRows}
        />
      )}

      <AllocatePaymentDialog
        open={allocateOpen}
        onOpenChange={setAllocateOpen}
        onSaved={fetchRows}
      />
    </div>
  );
}

export default function DebtsByCustomerPage() {
  return (
    <Suspense fallback={null}>
      <DebtsByCustomerPageContent />
    </Suspense>
  );
}
