"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";

interface ItemParam {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface QuotationItem {
  id: string;
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
  productCode: string;
  productName: string;
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
  productCode: string;
  productName: string;
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
  grandTotal: number;
  items: SalesOrderItem[];
  receivable: { remainingAmount: number } | null;
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
  productCode: string;
  productName: string;
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}


export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [terms, setTerms] = useState<string>("");
  const [debtTotalRemaining, setDebtTotalRemaining] = useState<number>(0);
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

        apiGet<{ totalRemaining: number }>(`/customers/${data.customer.id}/debt-summary`)
          .then((res) => { if (!cancelled) setDebtTotalRemaining(res.totalRemaining); })
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
        productCode: i.productCode,
        productName: i.productName,
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
        productCode: i.productCode,
        productName: i.productName,
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
  const discountAmount = isOrder ? Number(order!.discountAmount) : Number(quotation.discountAmount ?? 0);
  const discountReason = isOrder ? order!.discountReason : quotation.discountReason;
  const grandTotal = isOrder ? Number(order!.grandTotal) : totalAmount + totalVat - discountAmount;

  // Công nợ: "Đơn hàng hiện tại" = số còn phải thu của chính đơn này (đã trừ
  // phần đã thanh toán, nếu có) khi đã duyệt; = grandTotal khi còn là Báo giá.
  // "Nợ hiện có" = tổng công nợ khách (mọi đơn) TRỪ đơn đang in, tránh đếm 2 lần.
  const currentOrderRemaining = isOrder && order!.receivable ? Number(order!.receivable.remainingAmount) : grandTotal;
  const existingDebt = Math.max(0, debtTotalRemaining - (isOrder && order!.receivable ? currentOrderRemaining : 0));
  const totalToPay = existingDebt + currentOrderRemaining;

  const customerAddress = [quotation.customer.address, quotation.customer.district, quotation.customer.province]
    .filter(Boolean)
    .join(", ");

  // companyName/name cùng tồn tại trên Customer: companyName = tên đại lý (nếu
  // khách là doanh nghiệp), name = người đại diện/liên hệ trực tiếp.
  const customerDisplayName = quotation.customer.companyName || quotation.customer.name;
  const contactPerson = quotation.customer.companyName ? quotation.customer.name : null;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 15mm 14mm 15mm 14mm; }
        }
        :root {
          --navy: #17375e;
          --border: #d5d9e0;
          --grey: #667085;
        }
        body { font-family: "Inter", "Roboto", Arial, sans-serif; font-size: 12.5px; color: #101828; }
        table { border-collapse: collapse; width: 100%; }
        .label { font-size: 10.5px; color: var(--grey); text-transform: uppercase; letter-spacing: 0.04em; }
      `}</style>

      {/* Print button — hidden in print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          style={{ background: "#17375e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
        >
          In / Tải PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          Đóng
        </button>
      </div>

      {/* Page content */}
      {/* zIndex:0 (không phải "auto") tạo stacking context riêng, cô lập —
          watermark bên trong dùng zIndex:-1 chỉ nằm dưới nội dung của DIV
          NÀY, không phụ thuộc ancestor bên ngoài. */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 24px", position: "relative", zIndex: 0 }}>
        {company?.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo}
            alt=""
            style={{
              position: "absolute",
              top: 300,
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 340,
              height: 340,
              objectFit: "contain",
              opacity: 0.1,
              zIndex: -1,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Block 1 — Thông tin công ty + tiêu đề chứng từ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid var(--navy)", paddingBottom: 14, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", maxWidth: 380 }}>
            {company?.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo} alt="" style={{ maxHeight: 52, maxWidth: 120, objectFit: "contain" }} />
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{company?.companyName ?? "..."}</div>
              <div style={{ fontSize: 11, color: "var(--grey)", marginTop: 4, lineHeight: 1.6 }}>
                {company?.address && <div>{company.address}</div>}
                {(company?.phone || company?.email) && (
                  <div>{[company?.phone && `ĐT: ${company.phone}`, company?.email].filter(Boolean).join(" · ")}</div>
                )}
                {company?.website && <div>{company.website}</div>}
                {company?.taxCode && <div>MST: {company.taxCode}</div>}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 1 }}>
              {title}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{code}</div>
            <div style={{ fontSize: 11.5, color: "var(--grey)", marginTop: 6, lineHeight: 1.7 }}>
              <div>Ngày lập: {fmtDate(documentDate)}</div>
              {!isOrder && quotation.expiryDate && <div>Hiệu lực đến: {fmtDate(quotation.expiryDate)}</div>}
              {ownerName && <div>Người phụ trách: {ownerName}</div>}
            </div>
          </div>
        </div>

        {/* Block 2 — Thông tin khách hàng */}
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 6 }}>Thông tin khách hàng</div>
          <table style={{ fontSize: 12.5 }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px 0", width: "50%" }}><strong>{customerDisplayName}</strong> <span style={{ color: "var(--grey)", fontSize: 11 }}>({quotation.customer.code})</span></td>
                <td style={{ padding: "2px 0" }}>Điện thoại: {quotation.customer.phone}</td>
              </tr>
              {(contactPerson || quotation.customer.email) && (
                <tr>
                  <td style={{ padding: "2px 0" }}>{contactPerson && <>Người liên hệ: {contactPerson}</>}</td>
                  <td style={{ padding: "2px 0" }}>{quotation.customer.email && <>Email: {quotation.customer.email}</>}</td>
                </tr>
              )}
              {(customerAddress || quotation.customer.customerGroup) && (
                <tr>
                  <td style={{ padding: "2px 0" }}>{customerAddress && <>Địa chỉ: {customerAddress}</>}</td>
                  <td style={{ padding: "2px 0" }}>{quotation.customer.customerGroup && <>Nhóm khách hàng: {quotation.customer.customerGroup.name}</>}</td>
                </tr>
              )}
              {quotation.customer.taxCode && (
                <tr>
                  <td style={{ padding: "2px 0" }} colSpan={2}>MST: {quotation.customer.taxCode}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Block 3 — Chi tiết sản phẩm */}
        {/* table-layout: fixed để các width dưới đây là tỉ lệ cố định — tránh
            browser tự co giãn theo nội dung khiến cột Thông số bị bóp hẹp. */}
        <table style={{ marginBottom: 4, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "var(--navy)", color: "#fff" }}>
              <th style={{ width: 26, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "center", border: "1px solid var(--navy)" }}>STT</th>
              <th style={{ width: 118, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "left", border: "1px solid var(--navy)" }}>Sản phẩm</th>
              <th style={{ width: 150, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "left", border: "1px solid var(--navy)" }}>Thông số</th>
              <th style={{ width: 88, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "right", border: "1px solid var(--navy)" }}>Giá bán</th>
              <th style={{ width: 46, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "center", border: "1px solid var(--navy)" }}>CK</th>
              <th style={{ width: 55, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "right", border: "1px solid var(--navy)" }}>Phụ phí</th>
              <th style={{ width: 38, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "right", border: "1px solid var(--navy)" }}>SL</th>
              <th style={{ width: 95, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "right", border: "1px solid var(--navy)" }}>Thành tiền</th>
              <th style={{ width: 70, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "right", border: "1px solid var(--navy)" }}>VAT</th>
              <th style={{ width: 70, padding: "7px 6px", fontSize: 11, fontWeight: 600, textAlign: "left", border: "1px solid var(--navy)" }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const noteParts = [
                ...(item.warnings ?? []).map((w) => `⚠ ${w}`),
                ...(item.note ? [item.note] : []),
              ];

              return (
                <tr key={item.id}>
                  <td style={{ textAlign: "center", padding: "6px", fontSize: 12, border: "1px solid var(--border)" }}>{idx + 1}</td>
                  <td style={{ padding: "6px", fontSize: 12, border: "1px solid var(--border)", overflowWrap: "break-word" }}>
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    <div style={{ fontSize: 10.5, color: "var(--grey)" }}>{item.productCode}</div>
                  </td>
                  <td style={{ padding: "6px", fontSize: 11, border: "1px solid var(--border)" }}>
                    {item.parameters.length > 0 ? (
                      item.parameters.map((p) => (
                        <div key={p.name}>
                          <span style={{ color: "var(--grey)" }}>{p.label}: </span>
                          {p.value}
                          {p.unit ? ` ${p.unit}` : ""}
                        </div>
                      ))
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "6px", fontSize: 12, border: "1px solid var(--border)" }}>
                    {item.unitPrice !== null ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{fmt(item.unitPrice)}</div>
                        <div style={{ fontSize: 10.5, color: "var(--grey)" }}>đ/m²</div>
                      </>
                    ) : (
                      fmt(item.systemPrice)
                    )}
                  </td>
                  <td style={{ textAlign: "center", padding: "6px", fontSize: 11, border: "1px solid var(--border)" }}>
                    {item.discountPercent > 0 ? `${item.discountPercent}%` : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "6px", fontSize: 11, border: "1px solid var(--border)" }}>
                    {item.surchargeAfterDiscount > 0 ? fmt(item.surchargeAfterDiscount) : "—"}
                  </td>
                  <td style={{ textAlign: "right", padding: "6px", fontSize: 12, border: "1px solid var(--border)" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "6px", fontSize: 12, fontWeight: 700, border: "1px solid var(--border)" }}>{fmt(item.subtotal)}</td>
                  <td style={{ textAlign: "right", padding: "6px", fontSize: 11, border: "1px solid var(--border)" }}>
                    {item.vatRate > 0 ? <>{item.vatRate}%<br />{fmt(item.vatAmount)}</> : "—"}
                  </td>
                  <td style={{ padding: "6px", fontSize: 10.5, border: "1px solid var(--border)", overflowWrap: "break-word" }}>
                    {noteParts.length > 0 ? noteParts.join("; ") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Block 4a — Tổng tiền đơn hàng (tách biệt hoàn toàn khỏi công nợ) */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <table style={{ width: 300 }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 12 }}>Tổng tiền hàng</td>
                <td style={{ padding: "3px 0", fontSize: 12, textAlign: "right" }}>{fmt(totalAmount)} ₫</td>
              </tr>
              {discountAmount > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", fontSize: 12 }}>Giảm thêm</td>
                  <td style={{ padding: "3px 0", fontSize: 12, textAlign: "right" }}>−{fmt(discountAmount)} ₫</td>
                </tr>
              )}
              {totalVat > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", fontSize: 12 }}>VAT</td>
                  <td style={{ padding: "3px 0", fontSize: 12, textAlign: "right" }}>{fmt(totalVat)} ₫</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }} />
              </tr>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 13.5, fontWeight: 700, color: "var(--navy)" }}>THÀNH TIỀN ĐƠN HÀNG</td>
                <td style={{ padding: "3px 0", fontSize: 15, fontWeight: 700, color: "var(--navy)", textAlign: "right" }}>{fmt(grandTotal)} ₫</td>
              </tr>
            </tbody>
          </table>
        </div>

        {discountAmount > 0 && discountReason && (
          <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--grey)", marginTop: 2 }}>
            <em>Lý do giảm thêm: {discountReason}</em>
          </div>
        )}

        {/* Block 4b — Tình hình công nợ */}
        <div style={{ marginTop: 22, background: "#f7f8fa", border: "1px solid var(--border)", borderRadius: 4, padding: "14px 18px" }}>
          <div className="label" style={{ marginBottom: 8, color: "var(--navy)", fontWeight: 700 }}>Tình hình công nợ</div>
          <table>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 12.5 }}>Nợ hiện có (các đơn khác)</td>
                <td style={{ padding: "3px 0", fontSize: 12.5, textAlign: "right" }}>{fmt(existingDebt)} ₫</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 0", fontSize: 12.5 }}>{isOrder ? "Đơn hàng này" : "Báo giá này (nếu xác nhận)"}</td>
                <td style={{ padding: "3px 0", fontSize: 12.5, textAlign: "right" }}>{fmt(currentOrderRemaining)} ₫</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }} />
              </tr>
              <tr>
                <td style={{ padding: "4px 0", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>TỔNG CẦN THANH TOÁN</td>
                <td style={{ padding: "4px 0", fontSize: 20, fontWeight: 700, color: "var(--navy)", textAlign: "right" }}>{fmt(totalToPay)} ₫</td>
              </tr>
            </tbody>
          </table>
        </div>

        {quotation.note && (
          <div style={{ marginTop: 16, fontSize: 11.5 }}>
            <strong>Ghi chú:</strong> {quotation.note}
          </div>
        )}

        {/* Block 5 — Thông tin thanh toán */}
        {(company?.bankName || company?.bankAccountNumber) && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>Thông tin thanh toán</div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {company?.bankName && <div>Ngân hàng: {company.bankName}</div>}
              {company?.bankAccountNumber && <div>Số tài khoản: {company.bankAccountNumber}</div>}
              {company?.bankAccountHolder && <div>Chủ tài khoản: {company.bankAccountHolder}</div>}
              <div>Nội dung chuyển khoản: {code}</div>
            </div>
          </div>
        )}

        {terms && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12, fontSize: 11, whiteSpace: "pre-line", color: "var(--grey)" }}>
            <strong style={{ color: "#101828" }}>Điều khoản:</strong> {terms}
          </div>
        )}

        {/* Chữ ký */}
        <div style={{ marginTop: 40 }}>
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
