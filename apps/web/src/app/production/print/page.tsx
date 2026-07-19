"use client";

import { useEffect, useState, useCallback, Suspense, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { DeliveryAddressDialog } from "@/components/sales-order/delivery-address-dialog";

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
  // Mẫu in riêng Xưởng Cầu Vồng (010-mau-in-xuong-cau-vong.md) — null với các
  // xưởng cũ chưa cần phân biệt mẫu in.
  productionCenterCode: string | null;
  createdAt: string;
  items: ProductionOrderItem[];
  salesOrder: {
    id: string;
    code: string;
    deliveryName: string;
    deliveryPhone: string;
    deliveryAddress: string | null;
    deliveryProvince: string | null;
    deliveryDistrict: string | null;
    deliveryWard: string | null;
    expectedDeliveryDate: string | null;
    createdAt: string;
  };
}

// Mã ProductionCenter thật trong DB (tra trực tiếp — ví dụ XL01/XL02/XL03 ở
// production.md chỉ là minh hoạ, KHÔNG phải mã thật đang dùng). Đặc thù từng
// xưởng cụ thể, không cấu hình được — xem 010-mau-in-xuong-cau-vong.md /
// 011-mau-in-xuong-cua-luoi.md.
const CAU_VONG_CENTER_CODE = "XW004";
const CUA_LUOI_CENTER_CODE = "XW001";

interface ProductGroup {
  productCode: string;
  productName: string;
  totalQuantity: number;
  items: ProductionOrderItem[];
}

// Mẫu Xưởng (013-gop-dong-theo-xuong.md) — quy tắc gộp dòng khác nhau theo
// từng xưởng: Cầu Vồng chỉ gộp theo mã sản phẩm; Cửa Lưới phải khớp CẢ mã sản
// phẩm LẪN toàn bộ thông số khác Rộng/Cao (loại cửa, số cánh, màu khung...)
// mới được gộp — truyền `keyFn` khác nhau từ nơi gọi, xem `groupKeyFor()`.
function groupItems(
  items: ProductionOrderItem[],
  keyFn: (item: ProductionOrderItem) => string,
): ProductGroup[] {
  const groups: ProductGroup[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({
        productCode: item.productCode,
        productName: item.productName,
        totalQuantity: 0,
        items: [],
      });
    }
    groups[idx].items.push(item);
    groups[idx].totalQuantity += Number(item.quantity);
  }
  return groups;
}

function groupKeyFor(productionCenterCode: string | null) {
  if (productionCenterCode === CUA_LUOI_CENTER_CODE) {
    // Chỉ gộp khi cùng mã sản phẩm VÀ cùng toàn bộ thông số khác Rộng/Cao.
    return (item: ProductionOrderItem) => `${item.productCode}|${otherParamsText(item)}`;
  }
  // Cầu Vồng (và mặc định): chỉ cần cùng mã sản phẩm.
  return (item: ProductionOrderItem) => item.productCode;
}

// Tên thật của 2 tham số kích thước trong dữ liệu (tra trực tiếp DB dev —
// toàn bộ Product hiện có đều dùng đúng 2 tên này, KHÔNG phải "width"/"height"
// như ví dụ minh hoạ trong product.md). Xem 017-fix-ten-tham-so-kich-thuoc.md.
const WIDTH_PARAM_NAME = "chieurong";
const HEIGHT_PARAM_NAME = "chieucao";

function paramValue(item: ProductionOrderItem, name: string): string {
  return item.parameters.find((p) => p.name === name)?.value ?? "—";
}

// Mẫu Xưởng (012-hop-nhat-mau-in-xuong.md) — dòng mô tả dưới tên sản phẩm gồm
// các thông số KHÁC Rộng/Cao (khung, loại cửa, số cánh, hệ...), mỗi thông số
// hiển thị "label value unit" (bỏ phần nào không có), nối bằng dấu phẩy. Nếu
// sản phẩm không có thông số nào khác (như Rèm ở Cầu Vồng) thì để trống hẳn.
function otherParamsText(item: ProductionOrderItem): string {
  return item.parameters
    .filter((p) => p.name !== WIDTH_PARAM_NAME && p.name !== HEIGHT_PARAM_NAME)
    .map((p) => {
      const withLabel = p.label ? `${p.label} ${p.value}` : p.value;
      return p.unit ? `${withLabel} ${p.unit}` : withLabel;
    })
    .join(", ");
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

  // Xem trước KHÔNG ghi Timeline PRINTED — chỉ khi bấm "In / Tải PDF" mới gọi
  // POST /production-orders/print để ghi vết (xem 009-in-phieu-san-xuat.md
  // Việc 5). Tách riêng để dùng lại được sau khi sửa địa chỉ giao hàng.
  const loadOrders = useCallback(async () => {
    if (ids.length === 0) {
      setError("Không có phiếu sản xuất nào được chọn.");
      return;
    }
    try {
      const data = await Promise.all(
        ids.map((id) => apiGet<ProductionOrderPrintData>(`/production-orders/${id}`)),
      );
      setOrders(data);
      document.title = data.length === 1 ? data[0].code : `In ${data.length} phiếu sản xuất`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tìm thấy phiếu sản xuất.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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

  // 018-fix-khong-gian-tren-a5.md — CSS "named page" (page: <name>) không hoạt
  // động trên Chromium thật khi test bằng Playwright (vẫn ra khổ Letter dọc
  // mặc định). Đổi sang tính 1 khổ giấy DUY NHẤT cho cả lượt in, dựa theo
  // danh sách phiếu đang in: có ít nhất 1 phiếu thuộc mẫu xưởng (Cầu Vồng/Cửa
  // Lưới) → cả lượt in dùng A5 ngang; ngược lại giữ A5 dọc như mẫu chung.
  // Đánh đổi đã biết: in gộp lẫn xưởng có mẫu riêng + xưởng khác trong cùng 1
  // lượt vẫn dùng chung 1 khổ giấy (không tách riêng theo từng trang được).
  const anyWorkshopTicket = orders.some(
    (o) => o.productionCenterCode === CAU_VONG_CENTER_CODE || o.productionCenterCode === CUA_LUOI_CENTER_CODE,
  );
  const pageCss = anyWorkshopTicket
    ? "@page { size: A5 landscape; margin: 8mm 10mm; }"
    : "@page { size: A5; margin: 10mm 9mm 10mm 9mm; }";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          ${pageCss}
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

      {orders.map((order) => {
        const isWorkshopTicket =
          order.productionCenterCode === CAU_VONG_CENTER_CODE ||
          order.productionCenterCode === CUA_LUOI_CENTER_CODE;
        return (
          <div
            key={order.id}
            className="po-page"
            style={
              isWorkshopTicket
                ? { width: "190mm", margin: "0 auto" }
                : { maxWidth: 480, margin: "0 auto", padding: "16px 18px" }
            }
          >
            {isWorkshopTicket ? (
              <WorkshopOrderContent order={order} onSaved={loadOrders} />
            ) : (
              <GenericOrderContent order={order} onSaved={loadOrders} />
            )}
          </div>
        );
      })}
    </>
  );
}

function GenericOrderContent({
  order,
  onSaved,
}: {
  order: ProductionOrderPrintData;
  onSaved: () => void;
}) {
  return (
    <>
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
              <td style={{ padding: "2px 0" }} colSpan={2}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span><strong>Khách hàng:</strong> {order.salesOrder.deliveryName} — {order.salesOrder.deliveryPhone}</span>
                  <span className="no-print">
                    <DeliveryAddressDialog
                      salesOrderId={order.salesOrder.id}
                      salesOrderCode={order.salesOrder.code}
                      value={order.salesOrder}
                      onSaved={onSaved}
                    />
                  </span>
                </div>
              </td>
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
    </>
  );
}

// Mẫu in dùng chung cho Xưởng Cầu Vồng + Xưởng Cửa Lưới
// (012-hop-nhat-mau-in-xuong.md, 013-gop-dong-theo-xuong.md) — cùng bố cục
// (rowSpan gộp dòng, tiêu đề có phụ đề tên xưởng, A5 ngang, không ô ký tên),
// nhưng ĐIỀU KIỆN gộp dòng khác nhau theo xưởng — xem `groupKeyFor()`: Cầu
// Vồng chỉ cần cùng mã sản phẩm; Cửa Lưới phải cùng cả mã sản phẩm lẫn toàn bộ
// thông số khác Rộng/Cao (loại cửa, số cánh, màu khung...).
// Thiết kế theo tư duy phiếu sản xuất giấy (016-thiet-ke-lai-phieu-xuong.md):
// không phải 1 bảng HTML duy nhất — header/khối thông tin dựng bằng flex/div,
// CHỈ bảng sản phẩm mới dùng <table> (đúng bản chất dữ liệu dạng bảng). Ưu
// tiên tốc độ đọc của công nhân: phân cấp cỡ chữ rõ (tên khách, Rộng/Cao rất
// lớn; mã tra cứu rất nhỏ), viền mảnh, không card/bo góc/đổ bóng.
const WORKSHOP_BORDER = "0.75px solid #000";

function WorkshopOrderContent({
  order,
  onSaved,
}: {
  order: ProductionOrderPrintData;
  onSaved: () => void;
}) {
  const groups = groupItems(order.items, groupKeyFor(order.productionCenterCode));
  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  const lookupStyle: CSSProperties = { fontSize: 9, color: "#555", lineHeight: 1.6 };
  const boxLabelStyle: CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    borderBottom: WORKSHOP_BORDER,
    paddingBottom: 3,
    marginBottom: 4,
  };
  const thStyle: CSSProperties = {
    padding: "5px 3px",
    fontSize: 10,
    textAlign: "center",
    border: WORKSHOP_BORDER,
    textTransform: "uppercase",
    fontWeight: 700,
  };
  const tdStyle: CSSProperties = {
    textAlign: "center",
    padding: "5px 3px",
    fontSize: 11,
    border: WORKSHOP_BORDER,
  };
  const tdBigStyle: CSSProperties = { ...tdStyle, fontSize: 15, fontWeight: 800 };

  return (
    <div style={{ display: "flex", flexDirection: "column", color: "#000" }}>
      {/* 1. Header — ~13% chiều cao, 3 cột cân đối (trái/phải tra cứu, giữa tiêu đề) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          alignItems: "center",
          borderBottom: "1.5px solid #000",
          paddingBottom: 6,
          marginBottom: 8,
        }}
      >
        <div style={lookupStyle}>
          <div>Mã đơn hàng: {order.salesOrder.code}</div>
          <div>Mã phiếu SX: {order.code}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.5 }}>PHIẾU SX - XUẤT KHO</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>
            {order.productionCenterName}
          </div>
        </div>
        <div style={{ ...lookupStyle, textAlign: "right" }}>
          <div>Ngày đặt hàng: {fmtDate(order.salesOrder.createdAt)}</div>
          <div>
            Hạn giao hàng:{" "}
            {order.salesOrder.expectedDeliveryDate ? fmtDate(order.salesOrder.expectedDeliveryDate) : "—"}
          </div>
          <div>Xưởng: {order.productionCenterName}</div>
        </div>
      </div>

      {/* 2. Hai khung thông tin — tên KH / tên nhà xe là điểm nhấn lớn nhất */}
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, border: WORKSHOP_BORDER, padding: "5px 8px" }}>
          <div style={boxLabelStyle}>Thông tin khách hàng</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{order.salesOrder.deliveryName}</div>
            <span className="no-print">
              <DeliveryAddressDialog
                salesOrderId={order.salesOrder.id}
                salesOrderCode={order.salesOrder.code}
                value={order.salesOrder}
                onSaved={onSaved}
              />
            </span>
          </div>
          <div style={{ fontSize: 11, marginTop: 3 }}>{formatAddress(order.salesOrder) || "—"}</div>
          <div style={{ fontSize: 11, marginTop: 1 }}>{order.salesOrder.deliveryPhone}</div>
        </div>
        <div style={{ flex: 1, border: WORKSHOP_BORDER, padding: "5px 8px" }}>
          <div style={boxLabelStyle}>Thông tin giao hàng</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            Tên nhà xe: <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 120 }}>&nbsp;</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            SĐT: <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 90 }}>&nbsp;</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 1 }}>
            Ghi chú: <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 90 }}>&nbsp;</span>
          </div>
        </div>
      </div>

      {/* 3. Bảng sản phẩm — ~70% chiều cao, chỉ phần này là <table> */}
      <table style={{ tableLayout: "fixed", flex: 1 }}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "39%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={thStyle}>STT</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Tên sản phẩm</th>
            <th style={thStyle}>Rộng</th>
            <th style={thStyle}>Cao</th>
            <th style={thStyle}>SL</th>
            <th style={thStyle}>Nhôm</th>
            <th style={thStyle}>Vải</th>
            <th style={thStyle}>Đóng gói</th>
            <th style={thStyle}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let stt = 0;
            return groups.map((group) => {
              const description = otherParamsText(group.items[0]);
              return group.items.map((item, itemIdx) => {
                stt += 1;
                return (
                  <tr key={item.id}>
                    <td style={tdStyle}>{stt}</td>
                    {itemIdx === 0 && (
                      <td
                        rowSpan={group.items.length}
                        style={{ padding: "5px 8px", border: WORKSHOP_BORDER, verticalAlign: "middle", textAlign: "left" }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{group.productName}</div>
                        {description && (
                          <div
                            style={{
                              fontSize: 10,
                              marginTop: 1,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {description}
                          </div>
                        )}
                      </td>
                    )}
                    <td style={tdBigStyle}>{paramValue(item, WIDTH_PARAM_NAME)}</td>
                    <td style={tdBigStyle}>{paramValue(item, HEIGHT_PARAM_NAME)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{Number(item.quantity)}</td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, textAlign: "left", fontSize: 10 }}>{item.note ?? ""}</td>
                  </tr>
                );
              });
            });
          })()}
          <tr>
            <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>TỔNG CỘNG</td>
            <td style={{ ...tdStyle, fontWeight: 700 }}>{totalQuantity}</td>
            <td colSpan={4} style={{ border: WORKSHOP_BORDER }} />
          </tr>
        </tbody>
      </table>

      {/* 4. Footer — rất nhỏ */}
      <div style={{ fontSize: 8, fontStyle: "italic", borderTop: WORKSHOP_BORDER, paddingTop: 3, marginTop: 6 }}>
        <strong>Lưu ý:</strong> Kiểm tra kỹ kích thước, chủng loại trước khi sản xuất và xuất kho. Phiếu có giá trị kiểm phiếu xuất kho.
      </div>
    </div>
  );
}

export default function ProductionOrderPrintPage() {
  return (
    <Suspense fallback={null}>
      <ProductionOrderPrintContent />
    </Suspense>
  );
}
