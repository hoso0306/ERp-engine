"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  finalPrice: number;
  subtotal: number;
  product: { id: string; code: string; name: string };
  parameters: QuotationItemParam[];
}

interface Quotation {
  id: string;
  code: string;
  status: string;
  expiryDate: string | null;
  note: string | null;
  salesOrderId: string | null;
  createdAt: string;
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string;
    email?: string | null;
    province?: string | null;
    district?: string | null;
    address?: string | null;
    customerGroup: { id: string; name: string; discountPercent: number } | null;
  };
  items: QuotationItem[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtParams(params: QuotationItemParam[]) {
  return params.map((p) => `${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`).join(", ");
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  APPROVED: "Đã duyệt",
  CANCELLED: "Đã huỷ",
};

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/quotations/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Không tìm thấy báo giá.");
        return r.json();
      })
      .then((data: Quotation) => {
        setQuotation(data);
        document.title = `${data.code} - ${data.customer.name}`;
      })
      .catch((e: Error) => setError(e.message));
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

  const grandTotal = quotation.items.reduce((s, i) => s + Number(i.subtotal), 0);
  const groupDiscount = Number(quotation.customer.customerGroup?.discountPercent ?? 0);
  const customerAddress = [
    quotation.customer.address,
    quotation.customer.district,
    quotation.customer.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
        }
        body { font-family: "Times New Roman", Times, serif; font-size: 13px; color: #000; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 5px 7px; vertical-align: top; }
        th { background: #f0f0f0; font-weight: bold; text-align: center; }
      `}</style>

      {/* Print button — hidden in print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          style={{
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 20px",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          In / Tải PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: "#6b7280",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Đóng
        </button>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>
            {/* Company info placeholder */}
            CÔNG TY TNHH ERP ENGINE &nbsp;|&nbsp; Tel: 0900 000 000
          </div>
          <div style={{ fontSize: 22, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2 }}>
            Báo Giá
          </div>
          <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4 }}>
            {quotation.code}
          </div>
        </div>

        {/* Info grid */}
        <table style={{ border: "none", marginBottom: 16 }}>
          <tbody>
            <tr>
              <td style={{ border: "none", width: "50%", paddingLeft: 0 }}>
                <strong>Khách hàng:</strong> {quotation.customer.name}
              </td>
              <td style={{ border: "none", width: "50%" }}>
                <strong>Mã báo giá:</strong> {quotation.code}
              </td>
            </tr>
            <tr>
              <td style={{ border: "none", paddingLeft: 0 }}>
                <strong>Điện thoại:</strong> {quotation.customer.phone}
              </td>
              <td style={{ border: "none" }}>
                <strong>Ngày lập:</strong> {fmtDate(quotation.createdAt)}
              </td>
            </tr>
            {quotation.customer.email && (
              <tr>
                <td style={{ border: "none", paddingLeft: 0 }}>
                  <strong>Email:</strong> {quotation.customer.email}
                </td>
                <td style={{ border: "none" }}>
                  <strong>Trạng thái:</strong> {STATUS_LABEL[quotation.status] ?? quotation.status}
                </td>
              </tr>
            )}
            {customerAddress && (
              <tr>
                <td style={{ border: "none", paddingLeft: 0 }} colSpan={2}>
                  <strong>Địa chỉ:</strong> {customerAddress}
                </td>
              </tr>
            )}
            {quotation.expiryDate && (
              <tr>
                <td style={{ border: "none", paddingLeft: 0 }} colSpan={2}>
                  <strong>Báo giá có hiệu lực đến:</strong> {fmtDate(quotation.expiryDate)}
                </td>
              </tr>
            )}
            {groupDiscount > 0 && (
              <tr>
                <td style={{ border: "none", paddingLeft: 0 }} colSpan={2}>
                  <strong>Nhóm khách hàng:</strong> {quotation.customer.customerGroup?.name} — Chiết khấu {groupDiscount}%
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>STT</th>
              <th>Sản phẩm</th>
              <th>Thông số</th>
              <th style={{ width: 100, textAlign: "right" }}>Giá hệ thống</th>
              <th style={{ width: 70 }}>CK (%)</th>
              <th style={{ width: 100, textAlign: "right" }}>Giá bán</th>
              <th style={{ width: 50, textAlign: "right" }}>SL</th>
              <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, idx) => {
              const hasPctDiscount = Number(item.additionalDiscountPercent) > 0;
              const hasAmtDiscount = Number(item.additionalDiscountAmount) > 0;
              const ckLabel = [
                groupDiscount > 0 ? `Nhóm: ${groupDiscount}%` : null,
                hasPctDiscount ? `Thêm: ${item.additionalDiscountPercent}%` : null,
                hasAmtDiscount ? `Thêm: ${fmt(Number(item.additionalDiscountAmount))}₫` : null,
              ]
                .filter(Boolean)
                .join(", ") || "—";

              return (
                <tr key={item.id}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td>
                    <strong>{item.product.name}</strong>
                    <br />
                    <span style={{ fontSize: 11, color: "#555" }}>{item.product.code}</span>
                  </td>
                  <td style={{ fontSize: 11 }}>{fmtParams(item.parameters) || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(Number(item.systemPrice))}</td>
                  <td style={{ textAlign: "center", fontSize: 11 }}>{ckLabel}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(Number(item.finalPrice))}</td>
                  <td style={{ textAlign: "right" }}>{Number(item.quantity)}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{fmt(Number(item.subtotal))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ textAlign: "right", fontWeight: "bold", border: "1px solid #333" }}>
                TỔNG CỘNG
              </td>
              <td style={{ textAlign: "right", fontWeight: "bold", fontSize: 15, border: "1px solid #333" }}>
                {fmt(grandTotal)} ₫
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Discount reason notes */}
        {quotation.items.some((i) => i.discountReason) && (
          <div style={{ marginBottom: 12, fontSize: 11 }}>
            <em>Lý do chiết khấu: </em>
            {quotation.items
              .filter((i) => i.discountReason)
              .map((i) => `${i.product.name} — ${i.discountReason}`)
              .join("; ")}
          </div>
        )}

        {/* Notes */}
        {quotation.note && (
          <div style={{ marginBottom: 16, borderTop: "1px solid #ccc", paddingTop: 8 }}>
            <strong>Ghi chú:</strong> {quotation.note}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "1px solid #ccc", paddingTop: 16, marginTop: 16 }}>
          <table style={{ border: "none" }}>
            <tbody>
              <tr>
                <td style={{ border: "none", width: "50%", textAlign: "center" }}>
                  <strong>Khách hàng</strong>
                  <br />
                  <span style={{ fontSize: 11, color: "#555" }}>(Ký, ghi rõ họ tên)</span>
                  <br /><br /><br /><br />
                  <span>.....................................</span>
                </td>
                <td style={{ border: "none", width: "50%", textAlign: "center" }}>
                  <strong>Đại diện công ty</strong>
                  <br />
                  <span style={{ fontSize: 11, color: "#555" }}>(Ký, ghi rõ họ tên)</span>
                  <br /><br /><br /><br />
                  <span>.....................................</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
