"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface ProductionOrderItem {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  parameters: Parameter[];
  note: string | null;
}

interface ProductionOrderPrintData {
  id: string;
  code: string;
  productionCenterName: string;
  createdAt: string;
  items: ProductionOrderItem[];
  salesOrder: {
    code: string;
    deliveryName: string;
    deliveryPhone: string;
    deliveryAddress: string | null;
    deliveryProvince: string | null;
    deliveryDistrict: string | null;
    deliveryWard: string | null;
    expectedDeliveryDate: string | null;
  };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAddress(o: {
  deliveryAddress: string | null;
  deliveryWard: string | null;
  deliveryDistrict: string | null;
  deliveryProvince: string | null;
}) {
  return [o.deliveryAddress, o.deliveryWard, o.deliveryDistrict, o.deliveryProvince].filter(Boolean).join(", ");
}

function ProductionOrderPrintContent() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const [orders, setOrders] = useState<ProductionOrderPrintData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (ids.length === 0) {
        setError("Không có phiếu sản xuất nào được chọn.");
        return;
      }
      try {
        // Xem trước KHÔNG ghi Timeline PRINTED — chỉ khi bấm "In / Tải PDF"
        // mới gọi POST /production-orders/print để ghi vết (xem
        // 009-in-phieu-san-xuat.md Việc 5).
        const data = await Promise.all(
          ids.map((id) => apiGet<ProductionOrderPrintData>(`/production-orders/${id}`)),
        );
        if (!cancelled) {
          setOrders(data);
          document.title = data.length === 1 ? data[0].code : `In ${data.length} phiếu sản xuất`;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Không tìm thấy phiếu sản xuất.");
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handlePrint() {
    setPrinting(true);
    try {
      await apiPost(`/production-orders/print`, { ids });
      window.print();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Không thể ghi nhận lượt in. Vui lòng thử lại.");
    } finally {
      setPrinting(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A5; margin: 10mm 9mm 10mm 9mm; }
          .po-page { page-break-after: always; }
          .po-page:last-child { page-break-after: auto; }
        }
        :root {
          --navy: #17375e;
          --border: #d5d9e0;
          --grey: #667085;
        }
        body { font-family: "Inter", "Roboto", Arial, sans-serif; font-size: 10.5px; color: #101828; }
        table { border-collapse: collapse; width: 100%; }
        .label { font-size: 9px; color: var(--grey); text-transform: uppercase; letter-spacing: 0.04em; }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={handlePrint}
          disabled={printing}
          style={{ background: "#17375e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
        >
          {printing ? "Đang xử lý..." : "In / Tải PDF"}
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: "#6b7280", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          Đóng
        </button>
      </div>

      {orders.map((order) => (
        <div key={order.id} className="po-page" style={{ maxWidth: 480, margin: "0 auto", padding: "16px 18px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid var(--navy)", paddingBottom: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase" }}>
                Phiếu sản xuất
              </div>
              <div style={{ fontSize: 11, color: "var(--grey)", marginTop: 2 }}>kiêm phiếu giao hàng</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{order.code}</div>
              <div style={{ fontSize: 10.5, color: "var(--grey)" }}>Đơn hàng: {order.salesOrder.code}</div>
              <div style={{ fontSize: 10.5, color: "var(--grey)" }}>Ngày in: {fmtDate(new Date().toISOString())}</div>
            </div>
          </div>

          {/* Xưởng + khách hàng */}
          <div style={{ marginBottom: 12 }}>
            <table style={{ fontSize: 11 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "2px 0", width: "50%" }}><strong>Xưởng:</strong> {order.productionCenterName}</td>
                  <td style={{ padding: "2px 0" }}>
                    <strong>Ngày giao dự kiến:</strong> {order.salesOrder.expectedDeliveryDate ? fmtDate(order.salesOrder.expectedDeliveryDate) : "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0" }} colSpan={2}><strong>Khách hàng:</strong> {order.salesOrder.deliveryName} — {order.salesOrder.deliveryPhone}</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0" }} colSpan={2}><strong>Địa chỉ giao:</strong> {formatAddress(order.salesOrder) || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Sản phẩm */}
          <table style={{ marginBottom: 12, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--navy)", color: "#fff" }}>
                <th style={{ width: 22, padding: "5px 4px", fontSize: 9.5, textAlign: "center", border: "1px solid var(--navy)" }}>STT</th>
                <th style={{ padding: "5px 4px", fontSize: 9.5, textAlign: "left", border: "1px solid var(--navy)" }}>Sản phẩm / Thông số</th>
                <th style={{ width: 40, padding: "5px 4px", fontSize: 9.5, textAlign: "right", border: "1px solid var(--navy)" }}>SL</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center", padding: "5px 4px", fontSize: 10, border: "1px solid var(--border)" }}>{idx + 1}</td>
                  <td style={{ padding: "5px 4px", fontSize: 10, border: "1px solid var(--border)", overflowWrap: "break-word" }}>
                    <div style={{ fontWeight: 600 }}>{item.productName}</div>
                    <div style={{ fontSize: 9, color: "var(--grey)" }}>{item.productCode}</div>
                    {item.parameters.length > 0 && (
                      <div style={{ fontSize: 9, marginTop: 2 }}>
                        {item.parameters.map((p) => (
                          <span key={p.name} style={{ marginRight: 8 }}>
                            <span style={{ color: "var(--grey)" }}>{p.label}: </span>
                            {p.value}{p.unit ? ` ${p.unit}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: 9, marginTop: 2, fontStyle: "italic" }}>Ghi chú: {item.note}</div>
                    )}
                  </td>
                  <td style={{ textAlign: "right", padding: "5px 4px", fontSize: 10, fontWeight: 700, border: "1px solid var(--border)" }}>
                    {Number(item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Chữ ký */}
          <table>
            <tbody>
              <tr>
                <td style={{ width: "33%", textAlign: "center", verticalAlign: "top" }}>
                  <strong style={{ fontSize: 10.5 }}>Xưởng giao</strong>
                  <div style={{ height: 46 }} />
                </td>
                <td style={{ width: "33%", textAlign: "center", verticalAlign: "top" }}>
                  <strong style={{ fontSize: 10.5 }}>Tài xế nhận</strong>
                  <div style={{ height: 46 }} />
                </td>
                <td style={{ width: "34%", textAlign: "center", verticalAlign: "top" }}>
                  <strong style={{ fontSize: 10.5 }}>Khách hàng nhận</strong>
                  <div style={{ height: 46 }} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default function ProductionOrderPrintPage() {
  return (
    <Suspense fallback={null}>
      <ProductionOrderPrintContent />
    </Suspense>
  );
}
