"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { ExportQuotationMenu } from "@/components/quotation/export-quotation-menu";

interface ItemParam {
  name: string;
  label: string;
  value: string;
  // Nhãn hiển thị của option ENUM đã chọn (vd "Cửa sổ" thay vì mã gốc
  // "cuaso") — API đã snapshot sẵn (quotation-workflow.service.ts), null với
  // tham số không phải ENUM hoặc dữ liệu cũ tạo trước khi có field này.
  valueLabel: string | null;
  unit: string | null;
}

interface QuotationItem {
  id: string;
  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025) — bản in
  // giữ 1 bảng chung, không tách nhóm Sản phẩm/Vật tư (đã chốt).
  itemType?: "PRODUCT" | "MATERIAL";
  quantity: number;
  systemPrice: number;
  unitPrice: number | null;
  discountPercent: number;
  surchargeAfterDiscount: number;
  finalPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  note: string | null;
  // Snapshot cảnh báo Validation Rule (WARN) tại thời điểm tính giá dòng này.
  warnings: string[] | null;
  productCode: string | null;
  productName: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  materialUnit?: string | null;
  parameters: ItemParam[];
}

interface Quotation {
  id: string;
  code: string;
  status: string;
  expiryDate: string | null;
  note: string | null;
  salesOrderId: string | null;
  createdAt: string;
  // Giảm thêm cấp toàn báo giá (Sprint 04, chốt 16/07/2026).
  discountAmount: number;
  discountReason: string | null;
  // Phí vận chuyển (chốt 27/07/2026) — không chịu VAT.
  shippingFee: number;
  customer: {
    id: string;
    code: string;
    name: string;
    companyName?: string | null;
    phone: string;
    email?: string | null;
    province?: string | null;
    district?: string | null;
    address?: string | null;
    taxCode?: string | null;
    customerGroup: { id: string; name: string } | null;
  };
  items: QuotationItem[];
  // Dùng để suy ra "Người phụ trách" khi báo giá chưa duyệt — action
  // QUOTATION_CREATED đã snapshot createdByName (migration actor_name_snapshot).
  timeline: { action: string; createdByName: string | null }[];
}

interface SalesOrderItem {
  id: string;
  itemType?: "PRODUCT" | "MATERIAL";
  productCode: string | null;
  productName: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  materialUnit?: string | null;
  quantity: number;
  systemPrice: number;
  unitPrice: number | null;
  discountPercent: number;
  surchargeAfterDiscount: number;
  finalPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  note: string | null;
  parameters: ItemParam[];
}

interface SalesOrder {
  id: string;
  code: string;
  ownerName: string | null;
  createdAt: string;
  totalAmount: number;
  totalVatAmount: number;
  discountAmount: number;
  discountReason: string | null;
  shippingFee: number;
  grandTotal: number;
  items: SalesOrderItem[];
  receivable: {
    remainingAmount: number;
    remainingAmountBeforeVat: number;
    paidAmount: number;
  } | null;
}

interface Company {
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
}

interface Setting {
  key: string;
  value: string;
}

// View-model chuẩn hoá — dùng chung 1 layout cho cả 2 trạng thái Báo giá
// (chưa duyệt) / Xác nhận đơn hàng (đã duyệt, có SalesOrder).
interface ViewItem {
  id: string;
  itemType: "PRODUCT" | "MATERIAL";
  // Đã resolve fallback tại lúc map (MATERIAL đọc materialCode/Name/Unit,
  // PRODUCT đọc productCode/Name) — phần render dưới không cần biết nguồn.
  productCode: string;
  productName: string;
  unit: string | null;
  parameters: ItemParam[];
  systemPrice: number;
  unitPrice: number | null;
  discountPercent: number;
  surchargeAfterDiscount: number;
  quantity: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  note: string | null;
  warnings: string[] | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function fmt2(n: number) {
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Rộng/Cao — 3 chữ số sau dấu phẩy (vd "1,200"), khớp độ chính xác nhập liệu
// mét cho phép số thập phân (product.md mục "Quy ước đơn vị kích thước").
function fmt3(n: number) {
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Tên thật của 2 tham số kích thước trong dữ liệu (giống production/print/page.tsx)
// — nhập theo MÉT, cho phép số thập phân (product.md mục "Quy ước đơn vị kích
// thước"), không cần quy đổi.
const WIDTH_PARAM_NAME = "chieurong";
const HEIGHT_PARAM_NAME = "chieucao";
// Biến phái sinh "area" snapshot sẵn (BG000031, chốt 11/08/2026) — fallback
// tính M2 cho sản phẩm không có cặp chieurong/chieucao (Mái hiên, Bạt xếp...).
// Sản phẩm có đủ Rộng/Cao vẫn ưu tiên tính rong*cao như cũ, không đổi hành vi.
const AREA_PARAM_NAME = "area";

// Cột Cao cho 2 sản phẩm không có "chieucao" — giống hệt cách phiếu sản xuất
// hiển thị (production/print/page.tsx renderHeightCell, chốt 11/08/2026):
// Mái hiên di động dùng "khổ đua" (ENUM, hiện valueLabel), Bạt xếp dùng
// "chieudai" (tên thật: "Chiều nước chảy", vẫn là số đo nên format như Cao
// bình thường + chú thích nhỏ để không nhầm là chiều cao thật). Cột M2 KHÔNG
// đổi — vẫn dùng snapshot "area" (khổ đua là mã phân loại, không phải số đo).
const MAI_HIEN_DI_DONG_PRODUCT_CODE = "SP000115";
const MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME = "khodua";
const VAI_BAT_PRODUCT_CODE = "SP000110";
const VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME = "chieudai";
// Tham số nhập tay đại diện giá bán/giá vốn (VD "Hàng phân phối thêm",
// "Chi phí Sửa chữa/Lắp đặt") — không phải thông số mô tả sản phẩm, không
// hiện trên bản in (giá vốn đặc biệt không được lộ cho khách).
const HIDDEN_PARAM_NAMES = ["dongia", "giavon"];

// Sản phẩm có công thức giá không đơn thuần "unitPrice * area" (có hệ số/điều
// kiện giảm giá riêng trong Pricing Rule) khiến "Đơn giá" tra bảng ma trận
// không khớp giá thật khách trả (chốt 11/08/2026). Chỉ áp dụng đúng các mã đã
// xác nhận — KHÔNG áp dụng chung cho mọi sản phẩm ma trận để tránh nhiễu số
// do làm tròn ở các sản phẩm đang hiển thị đúng (~85 sản phẩm khác), và
// KHÔNG gồm SP000138/139/140 (người dùng chọn giữ nguyên cách hiển thị cũ,
// dùng Validation Rule ghi chú % thay vì đổi hiển thị — xem product SP000138
// note "Giá thay thế bằng 70% giá gốc").
const EFFECTIVE_UNIT_PRICE_PRODUCT_CODES = new Set([
  "SP000116", // Bạt Cuốn — công thức trừ thêm khi area > 10m²
  "SP000146", // Mành Tăm — nhánh "vẽ thủ công" dùng giá nhập tay, không phải giá tra bảng
]);

function paramNumber(params: ItemParam[], name: string): number | null {
  const raw = params.find((p) => p.name === name)?.value;
  const n = raw !== undefined ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Ô Cao cho Mái hiên di động / Bạt xếp — giống production/print/page.tsx
// renderHeightCell. CHỈ đổi cách HIỂN THỊ, không ảnh hưởng m2 (vẫn tính từ
// AREA_PARAM_NAME như cũ) vì "Khổ đua" là mã phân loại, không phải số đo.
function renderHeightCellFallback(item: { productCode: string | null; parameters: ItemParam[] }) {
  if (item.productCode === MAI_HIEN_DI_DONG_PRODUCT_CODE) {
    const p = item.parameters.find((param) => param.name === MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME);
    return p?.valueLabel ?? p?.value ?? "—";
  }
  if (item.productCode === VAI_BAT_PRODUCT_CODE) {
    const n = paramNumber(item.parameters, VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME);
    return n !== null ? (
      <>
        {fmt3(n)}
        <div style={{ fontSize: 8, fontWeight: 400, color: "#666" }}>(chiều nước chảy)</div>
      </>
    ) : (
      "—"
    );
  }
  return "—";
}

// Gộp dòng bảng theo cùng mã sản phẩm + cùng toàn bộ thông số KHÁC Rộng/Cao
// (giống rule mẫu Xưởng Cửa Lưới, production/print/page.tsx groupKeyFor) —
// Rộng/Cao vẫn hiển thị riêng từng dòng trong nhóm.
function groupItemsForDisplay<T extends { productCode: string; parameters: ItemParam[] }>(items: T[]): T[][] {
  const groups: T[][] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const otherParamsKey = item.parameters
      .filter(
        (p) =>
          p.name !== WIDTH_PARAM_NAME &&
          p.name !== HEIGHT_PARAM_NAME &&
          p.name !== AREA_PARAM_NAME &&
          p.name !== MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME &&
          p.name !== VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME,
      )
      .map((p) => `${p.name}:${p.value}`)
      .sort()
      .join("|");
    const key = `${item.productCode}::${otherParamsKey}`;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push([]);
    }
    groups[idx].push(item);
  }
  return groups;
}


export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [terms, setTerms] = useState<string>("");
  const [debtTotalRemaining, setDebtTotalRemaining] = useState<number>(0);
  const [debtTotalRemainingBeforeVat, setDebtTotalRemainingBeforeVat] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiGet<Quotation>(`/quotations/${id}`);
        if (cancelled) return;
        setQuotation(data);

        // Đã duyệt → có Sales Order — dùng làm nguồn chính (Block 1/3/4),
        // Block 2 Khách hàng vẫn đọc quotation.customer (Sales Order chỉ
        // snapshot customerName/customerPhone, không đủ field).
        if (data.salesOrderId) {
          apiGet<SalesOrder>(`/sales-orders/${data.salesOrderId}`)
            .then((so) => {
              if (!cancelled) {
                setOrder(so);
                document.title = `${so.code} - ${data.customer.name}`;
              }
            })
            .catch(() => {});
        } else {
          document.title = `${data.code} - ${data.customer.name}`;
        }

        apiGet<{ totalRemaining: number; totalRemainingBeforeVat: number }>(
          `/customers/${data.customer.id}/debt-summary`,
        )
          .then((res) => {
            if (!cancelled) {
              setDebtTotalRemaining(res.totalRemaining);
              setDebtTotalRemainingBeforeVat(res.totalRemainingBeforeVat);
            }
          })
          .catch(() => {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không tìm thấy báo giá.");
      }
    }

    load();

    apiGet<Company | null>("/settings/company")
      .then((data) => { if (!cancelled) setCompany(data); })
      .catch(() => {});

    apiGet<Setting[]>("/settings/Document")
      .then((data) => {
        if (cancelled) return;
        setTerms(data.find((s) => s.key === "quotationDefaultTerms")?.value ?? "");
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const isOrder = !!order;
  const title = isOrder ? "XÁC NHẬN ĐƠN HÀNG" : "BÁO GIÁ";
  const code = isOrder ? order!.code : quotation.code;
  const documentDate = isOrder ? order!.createdAt : quotation.createdAt;
  const ownerName =
    (isOrder ? order!.ownerName : null) ??
    quotation.timeline.find((t) => t.action === "QUOTATION_CREATED")?.createdByName ??
    null;

  const items: ViewItem[] = isOrder
    ? order!.items.map((i) => ({
        id: i.id,
        itemType: i.itemType ?? "PRODUCT",
        productCode: i.itemType === "MATERIAL" ? (i.materialCode ?? "") : (i.productCode ?? ""),
        productName: i.itemType === "MATERIAL" ? (i.materialName ?? "") : (i.productName ?? ""),
        unit: i.itemType === "MATERIAL" ? (i.materialUnit ?? null) : null,
        parameters: i.parameters,
        systemPrice: Number(i.systemPrice),
        unitPrice: i.unitPrice !== null ? Number(i.unitPrice) : null,
        discountPercent: Number(i.discountPercent),
        surchargeAfterDiscount: Number(i.surchargeAfterDiscount ?? 0),
        quantity: Number(i.quantity),
        subtotal: Number(i.subtotal),
        vatRate: Number(i.vatRate),
        vatAmount: Number(i.vatAmount),
        note: i.note,
        warnings: null,
      }))
    : quotation.items.map((i) => ({
        id: i.id,
        itemType: i.itemType ?? "PRODUCT",
        productCode: i.itemType === "MATERIAL" ? (i.materialCode ?? "") : (i.productCode ?? ""),
        productName: i.itemType === "MATERIAL" ? (i.materialName ?? "") : (i.productName ?? ""),
        unit: i.itemType === "MATERIAL" ? (i.materialUnit ?? null) : null,
        parameters: i.parameters,
        systemPrice: Number(i.systemPrice),
        unitPrice: i.unitPrice !== null ? Number(i.unitPrice) : null,
        discountPercent: Number(i.discountPercent),
        surchargeAfterDiscount: Number(i.surchargeAfterDiscount ?? 0),
        quantity: Number(i.quantity),
        subtotal: Number(i.subtotal),
        vatRate: Number(i.vatRate),
        vatAmount: Number(i.vatAmount),
        note: i.note,
        warnings: i.warnings,
      }));

  // Order: tổng tiền đã snapshot sẵn (Derived Data hợp lệ — xem SalesOrder.grandTotal).
  // Quotation (chưa duyệt): chưa có field tổng nào lưu sẵn — tính tại FE từ items.
  const totalAmount = isOrder
    ? Number(order!.totalAmount)
    : items.reduce((s, i) => s + i.subtotal, 0);
  const totalVat = isOrder
    ? Number(order!.totalVatAmount)
    : items.reduce((s, i) => s + i.vatAmount, 0);
  // Tổng SL/M2 hàng TỔNG — tính tại thời điểm hiển thị (Derived Data hợp lệ,
  // giống m2 từng dòng), chỉ cộng M2 các dòng có đủ Rộng/Cao.
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const totalM2 = items.reduce((s, i) => {
    const rong = paramNumber(i.parameters, WIDTH_PARAM_NAME);
    const cao = paramNumber(i.parameters, HEIGHT_PARAM_NAME);
    const area = paramNumber(i.parameters, AREA_PARAM_NAME);
    const m2 = rong !== null && cao !== null ? rong * cao : area;
    return s + (m2 !== null ? m2 * i.quantity : 0);
  }, 0);
  const discountAmount = isOrder ? Number(order!.discountAmount) : Number(quotation.discountAmount ?? 0);
  const discountReason = isOrder ? order!.discountReason : quotation.discountReason;
  const shippingFee = isOrder ? Number(order!.shippingFee) : Number(quotation.shippingFee ?? 0);
  const grandTotal = isOrder
    ? Number(order!.grandTotal)
    : totalAmount + totalVat - discountAmount + shippingFee;

  // Công nợ: "Đơn hàng hiện tại" = số còn phải thu của chính đơn này (đã trừ
  // phần đã thanh toán, nếu có) khi đã duyệt; = grandTotal khi còn là Báo giá.
  // "Nợ hiện có" = tổng công nợ khách (mọi đơn) TRỪ đơn đang in, tránh đếm 2 lần.
  const currentOrderRemaining = isOrder && order!.receivable ? Number(order!.receivable.remainingAmount) : grandTotal;
  const existingDebt = Math.max(0, debtTotalRemaining - (isOrder && order!.receivable ? currentOrderRemaining : 0));
  const totalToPay = existingDebt + currentOrderRemaining;

  // Công nợ song song trước-VAT (023-cong-no-truoc-sau-vat) — khách trả tiền
  // mặt không lấy hoá đơn thì chỉ cần trả mức này. "Đã thanh toán" trừ đều cả
  // 2 mức (1 Payment không tách được phần gốc/VAT) nên dùng chung 1 số.
  const totalAmountBeforeVat = totalAmount - discountAmount + shippingFee;
  const paidAmount = isOrder && order!.receivable ? Number(order!.receivable.paidAmount) : 0;
  const currentOrderRemainingBeforeVat =
    isOrder && order!.receivable ? Number(order!.receivable.remainingAmountBeforeVat) : totalAmountBeforeVat;
  // KHÔNG floor tại 0 — âm là trạng thái hợp lệ (đã trả vào phần VAT của đơn khác).
  const existingDebtBeforeVat =
    debtTotalRemainingBeforeVat - (isOrder && order!.receivable ? currentOrderRemainingBeforeVat : 0);
  const totalToPayBeforeVat = existingDebtBeforeVat + currentOrderRemainingBeforeVat;

  const customerAddress = [quotation.customer.address, quotation.customer.district, quotation.customer.province]
    .filter(Boolean)
    .join(", ");

  // companyName/name cùng tồn tại trên Customer: companyName = tên đại lý (nếu
  // khách là doanh nghiệp), name = người đại diện/liên hệ trực tiếp.
  const customerDisplayName = quotation.customer.companyName || quotation.customer.name;
  const contactPerson = quotation.customer.companyName ? quotation.customer.name : null;

  // Bố cục theo mẫu "Hóa đơn bán hàng" thực tế công ty đang dùng (ảnh tham
  // khảo 24/07/2026): header công ty + tiêu đề xếp chồng giữa trang, tông
  // xanh dương/đỏ. Tổng đơn + công nợ tách thành 2 khối riêng bên dưới bảng
  // sản phẩm (chốt 24/07/2026 theo phản hồi), không gộp vào bảng.
  const HEAD_BG = "#dbe9f7";
  const TOTAL_ROW_BG = "#fef3c7";
  const DEBT_COLOR = "#b91c1c";
  const PAID_COLOR = "#15803d";
  const GRAND_COLOR = "#1155cc";
  const BORDER = "1px solid #333";
  const thStyle: CSSProperties = {
    padding: "6px 5px", fontSize: 10, fontWeight: 700, border: BORDER, textAlign: "center",
  };
  const tdStyle: CSSProperties = { padding: "5px", fontSize: 11.5, border: BORDER };
  // Header "Trước VAT"/"Sau VAT" dùng chung cho cả khối Tổng đơn và Công nợ.
  const vatColHeaderStyle: CSSProperties = {
    padding: "2px 0 6px", fontSize: 11, fontWeight: 700, textDecoration: "underline", color: GRAND_COLOR, textAlign: "right",
  };
  const itemGroups = groupItemsForDisplay(items);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 15mm 14mm 15mm 14mm; }
        }
        :root {
          --grey: #667085;
        }
        body { font-family: "Inter", "Roboto", Arial, sans-serif; font-size: 12.5px; color: #101828; }
        table { border-collapse: collapse; width: 100%; }
      `}</style>

      {/* Print button — hidden in print */}
      <div className="no-print fixed top-4 right-4 flex items-center gap-2 z-50">
        <ExportQuotationMenu
          quotationId={quotation.id}
          quotationCode={code}
          mode="inline"
          onExportPdf={() => window.print()}
        />
        <button
          onClick={() => window.close()}
          style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          Đóng
        </button>
      </div>

      {/* Page content */}
      {/* Không cần khớp khổ A4 để in — chủ yếu dùng chụp ảnh (Ctrl+V gửi Zalo)
          nên nới rộng thoải mái hơn cho bảng đỡ chật, @page A4 chỉ còn ý
          nghĩa khi bấm "Xuất PDF". */}
      <div
        id="quotation-print-content"
        style={{ position: "relative", isolation: "isolate", maxWidth: 980, margin: "0 auto", padding: "20px 24px", color: "#101828" }}
      >
        {/* Watermark logo mờ nền — giống hệt cách làm ở AppLayout (trang chủ
            và mọi trang trong app), xem components/layout/app-layout.tsx. */}
        {company?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo}
            alt=""
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 600,
              objectFit: "contain",
              opacity: 0.08,
              zIndex: -1,
              pointerEvents: "none",
            }}
          />
        )}
        {/* 1. Header — logo lệch trái tuyệt đối (không tính vào canh giữa),
            khối chữ công ty + tiêu đề chứng từ căn giữa độc lập theo tâm
            trang, thẳng hàng với "BÁO GIÁ". */}
        <div style={{ position: "relative", textAlign: "center", marginBottom: 16 }}>
          {company?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo}
              alt=""
              style={{ position: "absolute", left: 0, top: 0, height: 56, maxWidth: 130, objectFit: "contain" }}
            />
          )}
          <div style={{ fontSize: 16, fontWeight: 800, color: "#c00000" }}>{company?.companyName ?? "..."}</div>
          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>
            {company?.address && <>Địa chỉ: {company.address}</>}
            {company?.phone && <>{company?.address ? " · " : ""}SDT:{company.phone}</>}
          </div>
          <div style={{ fontSize: 9.5, color: "var(--grey)", marginTop: 2 }}>
            {[company?.email, company?.website].filter(Boolean).join(" · ")}
            {company?.taxCode && <> · MST: {company.taxCode}</>}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: "#1155cc", marginTop: 12, textTransform: "uppercase" }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: "var(--grey)", marginTop: 4 }}>
            Ngày lập: {fmtDate(documentDate)}
            {!isOrder && quotation.expiryDate && <> · Hiệu lực đến: {fmtDate(quotation.expiryDate)}</>}
            {ownerName && <> · Người phụ trách: {ownerName}</>}
          </div>
        </div>

        {/* 2. Tên khách hàng (trái) đối diện Mã báo giá (phải). */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
          <div style={{ fontSize: 13.5 }}>
            <strong>Khách hàng: </strong>{customerDisplayName}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            {isOrder ? "Mã đơn hàng" : "Mã báo giá"}: {code}
          </div>
        </div>
        {/* Chi tiết liên hệ nhỏ bên dưới. */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--grey)", marginTop: 2, lineHeight: 1.6 }}>
            SĐT: {quotation.customer.phone}
            {contactPerson && <> · Người liên hệ: {contactPerson}</>}
            {quotation.customer.email && <> · Email: {quotation.customer.email}</>}
            {customerAddress && <> · Địa chỉ: {customerAddress}</>}
            {quotation.customer.customerGroup && <> · Nhóm khách hàng: {quotation.customer.customerGroup.name}</>}
            {quotation.customer.taxCode && <> · MST: {quotation.customer.taxCode}</>}
          </div>
        </div>

        {/* 3. Bảng chi tiết — Rộng/Cao/M2 tách cột riêng (đơn vị mét, không
            quy đổi — product.md mục "Quy ước đơn vị kích thước"). Công nợ
            hiển thị ở khối riêng bên dưới bảng, không gộp vào đây. */}
        <table style={{ marginBottom: 4, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 28 }} /><col style={{ width: 175 }} /><col style={{ width: 55 }} />
            <col style={{ width: 55 }} /><col style={{ width: 36 }} /><col style={{ width: 55 }} />
            <col style={{ width: 95 }} /><col style={{ width: 100 }} /><col style={{ width: 65 }} />
            <col style={{ width: 80 }} /><col style={{ width: 125 }} /><col style={{ width: 82 }} />
          </colgroup>
          <thead>
            <tr style={{ background: HEAD_BG }}>
              <th style={thStyle}>STT</th>
              <th style={thStyle}>Sản phẩm</th>
              <th style={thStyle}>Rộng</th>
              <th style={thStyle}>Cao</th>
              <th style={thStyle}>SL</th>
              <th style={thStyle}>M2</th>
              <th style={thStyle}>Đơn giá</th>
              <th style={thStyle}>Thành Tiền</th>
              <th style={thStyle}>Mức thuế VAT</th>
              <th style={thStyle}>Tiền Thuế</th>
              <th style={thStyle}>Thành tiền<br />(bao gồm VAT)</th>
              <th style={thStyle}>Chú thích</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let stt = 0;
              return itemGroups.map((group) =>
                group.map((item, itemIdx) => {
                  stt += 1;
                  const rong = paramNumber(item.parameters, WIDTH_PARAM_NAME);
                  const cao = paramNumber(item.parameters, HEIGHT_PARAM_NAME);
                  const area = paramNumber(item.parameters, AREA_PARAM_NAME);
                  const m2 =
                    rong !== null && cao !== null
                      ? rong * cao * item.quantity
                      : area !== null
                        ? area * item.quantity
                        : null;
                  // Giá/m² hiệu lực (đã gồm mọi hệ số/giảm giá trong công thức
                  // + chiết khấu khách hàng %, nếu có) cho các sản phẩm trong
                  // danh sách trên — dùng systemPrice × (1 − CK%), KHÔNG cộng
                  // `surchargeAfterDiscount`: đây là phụ phí LẮP ĐẶT (vd theo
                  // Loại cơ cấu/Ống của SP116), một khoản CỘNG THẲNG không
                  // tính theo m², nếu gộp cả vào rồi chia lại diện tích sẽ ra
                  // giá/m² sai (bug phát hiện 11/08/2026 — ban đầu dùng thẳng
                  // `subtotal`, đã bao gồm surcharge). Rơi về hiển thị
                  // unitPrice thô như cũ nếu không dựng được diện tích.
                  const effectiveUnitPrice =
                    item.productCode &&
                    EFFECTIVE_UNIT_PRICE_PRODUCT_CODES.has(item.productCode) &&
                    m2 !== null &&
                    m2 > 0
                      ? (item.systemPrice * (1 - item.discountPercent / 100) * item.quantity) / m2
                      : null;
                  const otherParams = item.parameters.filter(
                    (p) =>
                      p.name !== WIDTH_PARAM_NAME &&
                      p.name !== HEIGHT_PARAM_NAME &&
                      p.name !== AREA_PARAM_NAME &&
                      // Mái hiên di động / Vải bạt: khổ đua / chiều nước chảy đã
                      // hiện riêng ở ô Cao (renderHeightCell), không lặp lại.
                      p.name !== MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME &&
                      p.name !== VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME &&
                      !HIDDEN_PARAM_NAMES.includes(p.name),
                  );
                  const hasWarnings = !!item.warnings && item.warnings.length > 0;

                  return (
                    <tr key={item.id}>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{stt}</td>
                      {/* Gộp theo cùng mã sản phẩm + cùng thông số khác Rộng/Cao
                          (rule "Cửa Lưới", production/print/page.tsx groupKeyFor)
                          — chỉ dòng đầu nhóm render ô này, rowSpan hết cả nhóm.
                          Style cùng cách trình bày cột "Tên sản phẩm" mẫu Xưởng:
                          tên nhỏ màu xám, thông số đậm không kèm nhãn. */}
                      {itemIdx === 0 && (
                        <td
                          rowSpan={group.length}
                          style={{ ...tdStyle, overflowWrap: "break-word", verticalAlign: "middle" }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 500, color: "#444" }}>{item.productName}</div>
                          {item.itemType === "MATERIAL" && (
                            <div style={{ fontSize: 9, color: "var(--grey)" }}>Vật tư bán lẻ</div>
                          )}
                          {otherParams.length > 0 && (
                            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                              {otherParams.map((p) => p.valueLabel || (p.unit ? `${p.value} ${p.unit}` : p.value)).join(", ")}
                            </div>
                          )}
                        </td>
                      )}
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>{rong !== null ? fmt3(rong) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>
                        {cao !== null ? fmt3(cao) : renderHeightCellFallback(item)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700 }}>
                        {item.quantity}
                        {item.unit && <span style={{ fontWeight: 400 }}> {item.unit}</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{m2 !== null ? fmt2(m2) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <div>
                          {effectiveUnitPrice !== null
                            ? `${fmt(effectiveUnitPrice)}/m²`
                            : item.unitPrice !== null
                              ? `${fmt(item.unitPrice)}/m²`
                              : fmt(item.systemPrice)}
                        </div>
                        {/* Khi đã hiện giá hiệu lực (gồm sẵn chiết khấu), ẩn CK%
                            — để khỏi khiến người xem tưởng phải trừ thêm lần
                            nữa. Phụ phí lắp đặt (surchargeAfterDiscount) luôn
                            hiện riêng vì effectiveUnitPrice không gồm khoản
                            này (không tính theo m², xem comment tính toán). */}
                        {(() => {
                          const showCK = effectiveUnitPrice === null && item.discountPercent > 0;
                          const showSurcharge = item.surchargeAfterDiscount > 0;
                          return (
                            (showCK || showSurcharge) && (
                              <div style={{ fontSize: 9.5, color: "var(--grey)" }}>
                                {showCK && `CK ${item.discountPercent}%`}
                                {showCK && showSurcharge && " · "}
                                {showSurcharge && `+${fmt(item.surchargeAfterDiscount)}`}
                              </div>
                            )
                          );
                        })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(item.subtotal)}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{item.vatRate > 0 ? `${item.vatRate}%` : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{item.vatRate > 0 ? fmt(item.vatAmount) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(item.subtotal + item.vatAmount)}</td>
                      {/* Cột Chú thích — cảnh báo Validation Rule (WARN) + Ghi chú
                          người dùng, luôn theo TỪNG dòng (kể cả khi cột Sản
                          phẩm đã gộp) vì đây là cột duy nhất Báo giá có để ghi chú. */}
                      <td style={{ ...tdStyle, fontSize: 9, overflowWrap: "break-word" }}>
                        {hasWarnings && item.warnings!.map((w, i) => <div key={`w${i}`} style={{ color: "#b45309" }}>⚠ {w}</div>)}
                        {item.note && <div style={{ fontStyle: "italic", color: "var(--grey)" }}>Ghi chú: {item.note}</div>}
                        {!hasWarnings && !item.note && "—"}
                      </td>
                    </tr>
                  );
                }),
              );
            })()}

            {/* Dòng đệm tạo khoảng cách cho dễ nhìn trước dòng Tổng — không
                viền, không nội dung. */}
            <tr>
              <td colSpan={12} style={{ border: "none", height: 10 }} />
            </tr>
            {/* Hàng Tổng — chữ "TỔNG" ở cột Sản phẩm, kèm tổng SL/M2; số liệu
                Thành Tiền/Tiền Thuế/Thành tiền (bao gồm VAT) là tổng cộng
                nguyên trạng — không trừ Giảm thêm cấp báo giá (số đó đã phản
                ánh trong khối Tình hình công nợ bên dưới, dòng "Báo giá này"). */}
            <tr>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, background: TOTAL_ROW_BG }}>TỔNG</td>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, background: TOTAL_ROW_BG }}>{totalQuantity}</td>
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 800, background: TOTAL_ROW_BG }}>{fmt2(totalM2)}</td>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, background: TOTAL_ROW_BG }}>{fmt(totalAmount)}</td>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, background: TOTAL_ROW_BG }}>{fmt(totalVat)}</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, background: TOTAL_ROW_BG, color: GRAND_COLOR, fontSize: 13 }}>
                {fmt(totalAmount + totalVat)}
              </td>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
            </tr>
          </tbody>
        </table>

        {discountAmount > 0 && discountReason && (
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: "#c0392b", marginTop: 4 }}>
            Giảm thêm {fmt(discountAmount)} ₫ — Lý do: {discountReason}
          </div>
        )}
        {shippingFee > 0 && (
          <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--grey)", marginTop: 4 }}>
            <em>Đã gồm phí vận chuyển: {fmt(shippingFee)} ₫</em>
          </div>
        )}

        {/* Tình hình công nợ — khối riêng (chốt 24/07/2026 theo phản hồi,
            không gộp vào bảng sản phẩm nữa). Trước VAT / Sau VAT song song —
            khách trả tiền mặt không lấy hoá đơn thì chỉ cần trả mức trước-VAT. */}
        <div style={{ marginTop: 16, border: BORDER, borderRadius: 6, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GRAND_COLOR, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
            Tình hình công nợ
          </div>
          <table>
            <thead>
              <tr>
                <td style={{ padding: "2px 0 6px" }} />
                <td style={vatColHeaderStyle}>Trước VAT</td>
                <td style={vatColHeaderStyle}>Sau VAT</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 12.5 }}>{isOrder ? "Đơn hàng này" : "Báo giá này (nếu xác nhận)"}</td>
                <td style={{ padding: "3px 0", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{fmt(totalAmountBeforeVat)} ₫</td>
                <td style={{ padding: "3px 0", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{fmt(grandTotal)} ₫</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 12.5 }}>Công nợ cũ (các đơn khác)</td>
                <td style={{ padding: "3px 0", fontSize: 13, textAlign: "right", color: DEBT_COLOR, fontWeight: 700 }}>{fmt(existingDebtBeforeVat)} ₫</td>
                <td style={{ padding: "3px 0", fontSize: 13, textAlign: "right", color: DEBT_COLOR, fontWeight: 700 }}>{fmt(existingDebt)} ₫</td>
              </tr>
              {paidAmount > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", fontSize: 12.5 }}>Đã thanh toán</td>
                  <td style={{ padding: "3px 0", fontSize: 13, textAlign: "right", color: PAID_COLOR, fontWeight: 700 }}>−{fmt(paidAmount)} ₫</td>
                  <td style={{ padding: "3px 0", fontSize: 13, textAlign: "right", color: PAID_COLOR, fontWeight: 700 }}>−{fmt(paidAmount)} ₫</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} style={{ borderTop: BORDER, paddingTop: 8 }} />
              </tr>
              <tr>
                <td style={{ padding: "4px 0", fontSize: 14, fontWeight: 700 }}>TỔNG PHẢI THANH TOÁN</td>
                <td style={{ padding: "4px 0", fontSize: 17, fontWeight: 800, textAlign: "right", color: GRAND_COLOR }}>{fmt(totalToPayBeforeVat)} ₫</td>
                <td style={{ padding: "4px 0", fontSize: 17, fontWeight: 800, textAlign: "right", color: GRAND_COLOR }}>{fmt(totalToPay)} ₫</td>
              </tr>
            </tbody>
          </table>
        </div>

        {quotation.note && (
          <div style={{ marginTop: 16, fontSize: 11.5 }}>
            <strong>Ghi chú:</strong> {quotation.note}
          </div>
        )}

        {/* Thông tin thanh toán — chuyển khoản. */}
        {(company?.bankName || company?.bankAccountNumber) && (
          <div style={{ marginTop: 16, borderTop: BORDER, paddingTop: 10 }}>
            <div style={{ fontSize: 10.5, color: "var(--grey)", textTransform: "uppercase", letterSpacing: 0.04, marginBottom: 4 }}>
              Thông tin thanh toán
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {company?.bankName && <div>Ngân hàng: {company.bankName}</div>}
              {company?.bankAccountNumber && <div>Số tài khoản: {company.bankAccountNumber}</div>}
              {company?.bankAccountHolder && <div>Chủ tài khoản: {company.bankAccountHolder}</div>}
              <div>Nội dung chuyển khoản: {code}</div>
            </div>
          </div>
        )}

        {terms && (
          <div style={{ marginTop: 16, borderTop: BORDER, paddingTop: 12, fontSize: 11, whiteSpace: "pre-line", color: "var(--grey)" }}>
            <strong style={{ color: "#101828" }}>Điều khoản:</strong> {terms}
          </div>
        )}

        {/* 4. Chữ ký — Khách hàng xác nhận / Đại diện công ty đóng dấu, giữ
            nguyên (khác "Người lập phiếu/Người nhận hàng" của ảnh mẫu — vì
            đây là bước khách DUYỆT báo giá/đơn hàng, không phải phiếu giao
            nhận hàng nội bộ). */}
        <div style={{ marginTop: 36 }}>
          <table>
            <tbody>
              <tr>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                  <strong>Khách hàng</strong>
                  <div style={{ fontSize: 11, color: "var(--grey)" }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: 70 }} />
                </td>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", position: "relative" }}>
                  <strong>Đại diện công ty</strong>
                  <div style={{ fontSize: 11, color: "var(--grey)" }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: 70 }} />
                  {company?.stamp && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.stamp}
                      alt=""
                      style={{
                        position: "absolute",
                        top: 16,
                        left: "50%",
                        transform: "translateX(-50%) rotate(-8deg)",
                        width: 92,
                        height: 92,
                        objectFit: "contain",
                        opacity: 0.85,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
