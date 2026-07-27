"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";

// opening-balance.md — item giờ có 2 nguồn loại trừ nhau: Receivable (đơn
// hàng thật, có snapshot customerName/Phone trên SalesOrder) hoặc
// OpeningBalance (Công nợ đầu kỳ, không có snapshot này — lấy tên khách qua
// customerId của VatSettlement).
interface VatSettlementItem {
  id: string;
  amount: number;
  receivable: {
    salesOrder: { code: string; customerName: string; customerPhone: string };
  } | null;
  openingBalance: { code: string } | null;
}

interface VatSettlement {
  id: string;
  code: string;
  customerId: string;
  status: string;
  totalAmount: number;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  createdAt: string;
  items: VatSettlementItem[];
}

interface CustomerBrief {
  name: string;
  phone: string;
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

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Trang in VatSettlement (024-cong-no-vat-settlement.md Việc 5) — tái dùng
// pattern "in từ trình duyệt" của quotations/[id]/print/page.tsx (không dùng
// service PDF-generation server-side). Đây là chứng từ nội bộ (theo dõi phần
// VAT thu sau), không cần đầy đủ layout hóa đơn như báo giá/đơn hàng.
export default function VatSettlementPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [settlement, setSettlement] = useState<VatSettlement | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<CustomerBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiGet<VatSettlement>(`/vat-settlements/${id}`)
      .then((data) => {
        if (cancelled) return;
        setSettlement(data);
        document.title = `${data.code} - VAT Settlement`;
        // Nguồn Công nợ đầu kỳ không có snapshot customerName/Phone (khác
        // Receivable) — lấy trực tiếp từ Customer qua customerId.
        apiGet<CustomerBrief>(`/customers/${data.customerId}`)
          .then((c) => { if (!cancelled) setCustomer(c); })
          .catch(() => {});
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Không tìm thấy VAT Settlement."); });

    apiGet<Company | null>("/settings/company")
      .then((data) => { if (!cancelled) setCompany(data); })
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

  if (!settlement) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  const firstItem = settlement.items[0]?.receivable?.salesOrder;
  const customerName = firstItem?.customerName ?? customer?.name;
  const customerPhone = firstItem?.customerPhone ?? customer?.phone;
  const HEAD_BG = "#dbe9f7";
  const TOTAL_ROW_BG = "#fef3c7";
  const GRAND_COLOR = "#1155cc";
  const BORDER = "1px solid #333";
  const thStyle: CSSProperties = { padding: "6px 5px", fontSize: 10, fontWeight: 700, border: BORDER, textAlign: "center" };
  const tdStyle: CSSProperties = { padding: "5px", fontSize: 11.5, border: BORDER };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 15mm 14mm 15mm 14mm; }
        }
        body { font-family: "Inter", "Roboto", Arial, sans-serif; font-size: 12.5px; color: #101828; }
        table { border-collapse: collapse; width: 100%; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex items-center gap-2 z-50">
        <button
          onClick={() => window.print()}
          style={{ background: "#1155cc", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          In / Xuất PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          Đóng
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px", color: "#101828" }}>
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
          <div style={{ fontSize: 9.5, color: "#667085", marginTop: 2 }}>
            {[company?.email, company?.website].filter(Boolean).join(" · ")}
            {company?.taxCode && <> · MST: {company.taxCode}</>}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: GRAND_COLOR, marginTop: 12, textTransform: "uppercase" }}>
            Phiếu VAT Settlement
          </div>
          <div style={{ fontSize: 11, color: "#667085", marginTop: 4 }}>
            Ngày lập: {fmtDate(settlement.createdAt)}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ fontSize: 13.5 }}>
            <strong>Khách hàng: </strong>{customerName ?? "—"}
            {customerPhone && <span style={{ fontSize: 11, color: "#667085" }}> · SĐT: {customerPhone}</span>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Mã: {settlement.code}</div>
        </div>

        <table style={{ marginBottom: 4 }}>
          <thead>
            <tr style={{ background: HEAD_BG }}>
              <th style={thStyle}>STT</th>
              <th style={thStyle}>Đơn hàng</th>
              <th style={thStyle}>Phần VAT</th>
            </tr>
          </thead>
          <tbody>
            {settlement.items.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, textAlign: "center" }}>{idx + 1}</td>
                <td style={tdStyle}>
                  {item.receivable?.salesOrder.code ?? (item.openingBalance ? `${item.openingBalance.code} (Công nợ đầu kỳ)` : "—")}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(Number(item.amount))}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...tdStyle, background: TOTAL_ROW_BG }} />
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, background: TOTAL_ROW_BG }}>TỔNG</td>
              <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800, background: TOTAL_ROW_BG, color: GRAND_COLOR, fontSize: 13 }}>
                {fmt(Number(settlement.totalAmount))}
              </td>
            </tr>
          </tbody>
        </table>

        {settlement.invoiceNumber && (
          <div style={{ marginTop: 12, fontSize: 11.5 }}>
            <strong>Số hóa đơn:</strong> {settlement.invoiceNumber}
            {settlement.invoiceDate && <> · <strong>Ngày hóa đơn:</strong> {fmtDate(settlement.invoiceDate)}</>}
          </div>
        )}

        {(company?.bankName || company?.bankAccountNumber) && (
          <div style={{ marginTop: 16, borderTop: BORDER, paddingTop: 10 }}>
            <div style={{ fontSize: 10.5, color: "#667085", textTransform: "uppercase", letterSpacing: 0.04, marginBottom: 4 }}>
              Thông tin thanh toán
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {company?.bankName && <div>Ngân hàng: {company.bankName}</div>}
              {company?.bankAccountNumber && <div>Số tài khoản: {company.bankAccountNumber}</div>}
              {company?.bankAccountHolder && <div>Chủ tài khoản: {company.bankAccountHolder}</div>}
              <div>Nội dung chuyển khoản: {settlement.code}</div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <table>
            <tbody>
              <tr>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                  <strong>Khách hàng</strong>
                  <div style={{ fontSize: 11, color: "#667085" }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: 70 }} />
                </td>
                <td style={{ width: "50%", textAlign: "center", verticalAlign: "top", position: "relative" }}>
                  <strong>Đại diện công ty</strong>
                  <div style={{ fontSize: 11, color: "#667085" }}>(Ký, ghi rõ họ tên)</div>
                  <div style={{ height: 70 }} />
                  {company?.stamp && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.stamp}
                      alt=""
                      style={{
                        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%) rotate(-8deg)",
                        width: 92, height: 92, objectFit: "contain", opacity: 0.85, pointerEvents: "none",
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
