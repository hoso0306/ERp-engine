"use client";

import { useEffect, useRef, useState, useCallback, Suspense, type CSSProperties, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { DeliveryAddressDialog } from "@/components/sales-order/delivery-address-dialog";
import { CarrierInfoDialog } from "@/components/sales-order/carrier-info-dialog";
import { useBranding } from "@/lib/use-branding";

interface Parameter {
  name: string;
  label: string;
  value: string;
  // Nhãn hiển thị của option ENUM đã chọn (009-in-phieu-san-xuat.md) — null
  // với tham số không phải ENUM hoặc dữ liệu cũ tạo trước khi có field này.
  valueLabel: string | null;
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
  // Mẫu in riêng Xưởng Cầu Vồng (009-in-phieu-san-xuat.md) — null với các
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
    // Thông tin nhà xe (009-in-phieu-san-xuat.md) — khối "Thông tin giao
    // hàng" trên mẫu in riêng xưởng, sửa được qua CarrierInfoDialog.
    carrierName: string | null;
    carrierPhone: string | null;
    carrierNote: string | null;
    expectedDeliveryDate: string | null;
    createdAt: string;
  };
}

// Mã ProductionCenter thật trong DB (tra trực tiếp — ví dụ XL01/XL02/XL03 ở
// production.md chỉ là minh hoạ, KHÔNG phải mã thật đang dùng). Đặc thù từng
// xưởng cụ thể, không cấu hình được — xem 009-in-phieu-san-xuat.md. Từ
// 20/07/2026: áp dụng mẫu WorkshopOrderContent cho cả 4 xưởng đang có trong
// DB (tra trực tiếp `production_centers`), không chỉ 2 xưởng Cầu Vồng/Cửa
// Lưới như thiết kế gốc — GenericOrderContent giữ lại làm phương án dự phòng
// nếu sau này có thêm xưởng mới chưa kịp thêm mã vào đây.
const CAU_VONG_CENTER_CODE = "XW004";
const CUA_LUOI_CENTER_CODE = "XW001";
const BAT_CENTER_CODE = "XW005";
const GIA_CONG_CENTER_CODE = "XW006";
const WORKSHOP_CENTER_CODES = [CAU_VONG_CENTER_CODE, CUA_LUOI_CENTER_CODE, BAT_CENTER_CODE, GIA_CONG_CENTER_CODE];

interface ProductGroup {
  productCode: string;
  productName: string;
  totalQuantity: number;
  items: ProductionOrderItem[];
}

// Mẫu Xưởng (009-in-phieu-san-xuat.md) — chỉ gộp khi khớp CẢ mã sản phẩm LẪN
// toàn bộ thông số khác Rộng/Cao (loại cửa, số cánh, màu khung, "Loại" cơ
// cấu của Bạt Cuốn...) — xem `groupKeyFor()`. Ban đầu chỉ Cửa Lưới dùng quy
// tắc chặt này, các xưởng khác chỉ gộp theo mã sản phẩm; phát hiện qua
// SO000024 (6 dòng Bạt Cuốn cùng mã, khác "Loại" hoàn toàn, bị gộp lẫn 1 ô
// mô tả — mô tả chỉ lấy từ item đầu nhóm, ẩn mất "Loại" của các dòng còn
// lại) rằng quy tắc lỏng không an toàn cho bất kỳ xưởng nào có tham số ENUM
// phân biệt biến thể ngoài Rộng/Cao (Cầu Vồng: marem/mangremcuon; Gia công:
// maukhung/loaimanh...) — nên áp dụng thống nhất quy tắc chặt cho cả 4 xưởng.
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

function groupKey(item: ProductionOrderItem): string {
  return `${item.productCode}|${otherParamsText(item)}`;
}

// Tên thật của 2 tham số kích thước trong dữ liệu (tra trực tiếp DB dev —
// toàn bộ Product hiện có đều dùng đúng 2 tên này, KHÔNG phải "width"/"height"
// như ví dụ minh hoạ trong product.md). Xem 009-in-phieu-san-xuat.md.
const WIDTH_PARAM_NAME = "chieurong";
const HEIGHT_PARAM_NAME = "chieucao";
// Tham số nhập tay đại diện giá bán/giá vốn (VD "Hàng phân phối thêm",
// "Chi phí Sửa chữa/Lắp đặt") — không phải thông số mô tả sản phẩm, và đặc
// biệt giá vốn không được lộ cho Xưởng sản xuất, nên không hiện trên phiếu.
// "area" — biến phái sinh snapshot cho bản in Báo giá (BG000031, chốt
// 11/08/2026), không phải thông số Xưởng cần — ẩn khỏi phiếu SX như cũ.
const HIDDEN_PARAM_NAMES = ["dongia", "giavon", "area"];

// Mái hiên di động (SP000115, Xưởng Bạt XW005) là sản phẩm DUY NHẤT trong
// toàn hệ thống không có tham số "chieucao" (chỉ có "chieurong") — thay vào
// đó khổ đua ("khodua") mới là thông số quyết định. Ô "Cao" của riêng dòng
// sản phẩm này hiện giá trị khổ đua thay vì để trống "—". KHÔNG đổi tên cột
// "Cao" thành "Khổ đua" vì 1 phiếu Xưởng Bạt có thể lẫn Mái hiên di động với
// sản phẩm khác có Cao thật (phiếu được gộp theo xưởng, không theo sản phẩm
// — xem quotation-workflow.service.ts groupBy productionCenterId).
const MAI_HIEN_DI_DONG_PRODUCT_CODE = "SP000115";
const MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME = "khodua";

// [Bạt xếp] - Vải bạt (SP000110, Xưởng Bạt) cũng không có "chieucao" — dùng
// "chieudai" (nhãn thật trong dữ liệu: "Chiều nước chảy") làm chiều thứ 2.
// Khác Khổ đua (nhãn phân loại ENUM), đây vẫn là 1 kích thước dạng số nên
// hiện như Rộng/Cao bình thường, kèm chú thích nhỏ "(chiều nước chảy)" bên
// dưới để tránh nhầm là Cao thật.
const VAI_BAT_PRODUCT_CODE = "SP000110";
const VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME = "chieudai";
// Phụ kiện lắp đặt xưởng cần nhưng KHÔNG có trong dữ liệu đặt hàng (chưa từng
// là tham số sản phẩm lúc báo giá/sinh phiếu SX) — để trống, mỗi mục 1 dòng
// riêng cho xưởng tự ghi tay sau khi in.
const VAI_BAT_HANDWRITE_FIELDS = ["U treo", "Buly", "Bi treo", "Dây chia", "Dây kéo"];

// Bạt Cuốn (SP000116, Xưởng Bạt): cơ cấu vận hành ("loai") chiếm bớt không
// gian lắp đặt nên kích thước xưởng phải CẮT khác kích thước khách ĐẶT — số
// liệu do người dùng cung cấp trực tiếp (không suy đoán), áp dụng không điều
// kiện (khác dòng vật tư BOM có sẵn của SP000116 vốn chỉ cộng khi Ống = "Ống
// nhôm cứng" — 2 việc độc lập, không liên quan nhau).
const BAT_CUON_PRODUCT_CODE = "SP000116";
// Trừ khỏi Rộng (đơn vị cm) theo từng giá trị "loai".
const BAT_CUON_WIDTH_DEDUCT_CM_BY_LOAI: Record<string, number> = {
  loxothuong: 3, // Lò xo thường
  loxoham: 4, // Lò xo Hãm
  daukeo: 3, // Đầu kéo (thường)
  daukeotichhop: 4, // Đầu kéo tích hợp
  tayquay: 10, // Tay quay
  motor: 5, // Motor
};
// Riêng Mã bạt lưới nhập khẩu K01/K01 mới: trừ thêm 5cm khỏi Rộng, CỘNG DỒN
// với khoản trừ theo "loai" ở trên (không thay thế); và Cao cộng 15cm thay vì
// 10cm mặc định (không phân biệt "loai" trong cả 2 trường hợp).
const BAT_CUON_MABAT_LUOI_CODES = ["k01", "k01moi"];
const BAT_CUON_MABAT_LUOI_EXTRA_DEDUCT_CM = 5;
const BAT_CUON_HEIGHT_ADD_CM_DEFAULT = 10;
const BAT_CUON_HEIGHT_ADD_CM_MABAT_LUOI = 15;

function paramValue(item: ProductionOrderItem, name: string): string {
  return item.parameters.find((p) => p.name === name)?.value ?? "—";
}

// chieurong/chieucao lưu đơn vị mét — deltaCm quy đổi ra mét trước khi cộng.
// Giá trị không parse được số thì trả nguyên văn (không áp công thức).
function batCuonAdjustDimension(raw: string, deltaCm: number): string {
  const num = Number(raw.replace(",", "."));
  if (Number.isNaN(num)) return raw;
  return (num + deltaCm / 100).toString();
}

function isBatCuonMabatLuoi(item: ProductionOrderItem): boolean {
  const mabat = item.parameters.find((p) => p.name === "mabat")?.value;
  return mabat !== undefined && BAT_CUON_MABAT_LUOI_CODES.includes(mabat);
}

function renderWidthCell(item: ProductionOrderItem): ReactNode {
  if (item.productCode === BAT_CUON_PRODUCT_CODE) {
    const loai = item.parameters.find((p) => p.name === "loai")?.value;
    let deductCm = loai ? (BAT_CUON_WIDTH_DEDUCT_CM_BY_LOAI[loai] ?? 0) : 0;
    if (isBatCuonMabatLuoi(item)) {
      deductCm += BAT_CUON_MABAT_LUOI_EXTRA_DEDUCT_CM;
    }
    return formatDimension(batCuonAdjustDimension(paramValue(item, WIDTH_PARAM_NAME), -deductCm));
  }
  return formatDimension(paramValue(item, WIDTH_PARAM_NAME));
}

function renderHeightCell(item: ProductionOrderItem): ReactNode {
  if (item.productCode === MAI_HIEN_DI_DONG_PRODUCT_CODE) {
    const p = item.parameters.find((param) => param.name === MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME);
    return p?.valueLabel ?? p?.value ?? "—";
  }
  if (item.productCode === VAI_BAT_PRODUCT_CODE) {
    return (
      <>
        {formatDimension(paramValue(item, VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME))}
        <div style={{ fontSize: 8, fontWeight: 400, color: "#666" }}>(chiều nước chảy)</div>
      </>
    );
  }
  if (item.productCode === BAT_CUON_PRODUCT_CODE) {
    const addCm = isBatCuonMabatLuoi(item) ? BAT_CUON_HEIGHT_ADD_CM_MABAT_LUOI : BAT_CUON_HEIGHT_ADD_CM_DEFAULT;
    return formatDimension(batCuonAdjustDimension(paramValue(item, HEIGHT_PARAM_NAME), addCm));
  }
  return formatDimension(paramValue(item, HEIGHT_PARAM_NAME));
}

// Chuẩn hoá hiển thị Rộng/Cao — luôn hiện đủ 3 chữ số thập phân (vd "1,200",
// "11,000") cho đồng nhất giữa các dòng trên phiếu, dù dữ liệu gốc nhập
// thiếu số 0 (vd "1.2") hay dùng dấu chấm/phẩy khác nhau. Không sửa dữ liệu
// gốc đã lưu (đúng nguyên tắc Snapshot) — chỉ chuẩn hoá lúc hiển thị. Giá
// trị không parse được số thì hiện nguyên văn.
function formatDimension(raw: string): string {
  const num = Number(raw.replace(",", "."));
  if (Number.isNaN(num)) return raw;
  return num.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Mẫu Xưởng (009-in-phieu-san-xuat.md) — dòng mô tả dưới tên sản phẩm gồm
// các thông số KHÁC Rộng/Cao (loại cửa, số cánh, màu khung...), CHỈ hiển thị
// giá trị + đơn vị (bỏ nhãn — "Cửa sổ" thay vì "Loại cửa cuaso"), nối bằng dấu
// phẩy. Nếu sản phẩm không có thông số nào khác (như Rèm ở Cầu Vồng) thì để
// trống hẳn.
//
// Ưu tiên `valueLabel` (nhãn hiển thị option ENUM, vd "Cửa sổ") nếu có, rơi về
// `value` (mã gốc, vd "cuaso") cho tham số không phải ENUM hoặc đơn cũ tạo
// trước khi có field `valueLabel` (không snapshot lại được, chấp nhận hiện mã
// thô cho dữ liệu lịch sử — đúng nguyên tắc Snapshot, CLAUDE.md mục 7).
function otherParamsText(item: ProductionOrderItem): string {
  return item.parameters
    .filter(
      (p) =>
        p.name !== WIDTH_PARAM_NAME &&
        p.name !== HEIGHT_PARAM_NAME &&
        // Mái hiên di động / Vải bạt: khổ đua / chiều nước chảy đã hiện riêng
        // ở ô "Cao" (renderHeightCell), không lặp lại trong dòng mô tả.
        p.name !== MAI_HIEN_HEIGHT_OVERRIDE_PARAM_NAME &&
        p.name !== VAI_BAT_HEIGHT_OVERRIDE_PARAM_NAME &&
        !HIDDEN_PARAM_NAMES.includes(p.name),
    )
    .map((p) => {
      // Nhãn ENUM (vd "Mở 1 cánh") đã tự mô tả đầy đủ — không nối thêm unit
      // nữa, kẻo lặp từ (vd unit="cánh" → "Mở 1 cánh cánh"). Chỉ nối unit khi
      // hiển thị value thô (tham số không phải ENUM / chưa có valueLabel).
      if (p.valueLabel) return p.valueLabel;
      return p.unit ? `${p.value} ${p.unit}` : p.value;
    })
    .join(", ");
}

// Cột "Ghi chú" gộp (mẫu Xưởng) chỉ có 1 dòng cao cố định — thay vì cho ô
// cao dần theo nội dung (phá vỡ chiều cao các dòng khác cùng hàng), chữ tự
// NHỎ LẠI khi gõ dài hơn để luôn vừa trong 1 dòng, đọc rõ khi gõ ngắn.
//
// Đo bằng canvas thay vì đoán theo số ký tự (cách cũ co nhỏ quá sớm, chưa
// gõ hết nửa cột đã giảm) — chỉ giảm cỡ chữ khi bề rộng chữ thật sự chạm
// hết bề rộng ô, gõ tiếp mới giảm thêm.
const NOTE_MAX_FONT_SIZE = 22;
const NOTE_MIN_FONT_SIZE = 7;
const NOTE_FONT_FAMILY = "Inter, Roboto, Arial, sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx!;
}

// Cỡ chữ lớn nhất (bội số 0.5) để text vừa đúng `availableWidth` (px).
function fitNoteFontSize(text: string, availableWidth: number): number {
  const ctx = getMeasureContext();
  let size = NOTE_MAX_FONT_SIZE;
  while (size > NOTE_MIN_FONT_SIZE) {
    ctx.font = `${size}px ${NOTE_FONT_FAMILY}`;
    if (ctx.measureText(text).width <= availableWidth) break;
    size -= 0.5;
  }
  return size;
}

// Ô ghi chú tự co giãn — đo lại mỗi khi nội dung đổi, dựa trên chiều rộng
// thật của chính textarea (đã trừ padding qua box-sizing: border-box).
function NoteCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [fontSize, setFontSize] = useState(NOTE_MAX_FONT_SIZE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const available = el.clientWidth - 6; // trừ padding ngang 3px x 2 của .note-textarea
    if (available <= 0) return;
    setFontSize(fitNoteFontSize(value, available));
  }, [value]);

  return (
    <textarea
      ref={ref}
      className="note-textarea"
      rows={1}
      style={{ fontSize }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
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
  // Logo công ty trên mẫu in riêng xưởng (009-in-phieu-san-xuat.md) — fetch 1
  // lần cho cả lượt in, truyền xuống từng WorkshopOrderContent.
  const branding = useBranding();

  const [orders, setOrders] = useState<ProductionOrderPrintData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  // Cho phép người dùng ép khổ A4 khi phiếu quá dài (nhiều dòng sản phẩm)
  // tràn sang trang 2 trên A5, dễ thất lạc. "auto" = giữ khổ mặc định theo
  // loại mẫu như trước (A5 ngang cho mẫu xưởng, A5 dọc cho mẫu chung).
  const [paperSize, setPaperSize] = useState<"auto" | "A4">("auto");

  // Xem trước KHÔNG ghi Timeline PRINTED (và không Start) — chỉ khi bấm "In
  // và bắt đầu SX / Tải PDF" mới gọi POST /production-orders/print để ghi vết
  // + tự Start các phiếu đang PENDING (chốt 10/08/2026). Tách riêng để dùng
  // lại được sau khi sửa địa chỉ giao hàng.
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

  // 009-in-phieu-san-xuat.md — CSS "named page" (page: <name>) không hoạt
  // động trên Chromium thật khi test bằng Playwright (vẫn ra khổ Letter dọc
  // mặc định). Đổi sang tính 1 khổ giấy DUY NHẤT cho cả lượt in, dựa theo
  // danh sách phiếu đang in: có ít nhất 1 phiếu thuộc mẫu xưởng (Cầu Vồng/Cửa
  // Lưới) → mặc định A5 ngang; ngược lại A5 dọc như mẫu chung. Người dùng có
  // thể ép khổ A4 (dropdown bên dưới) cho lượt in đang chọn, ví dụ khi phiếu
  // quá nhiều dòng sản phẩm tràn sang trang 2 trên A5.
  // Đánh đổi đã biết: in gộp lẫn xưởng có mẫu riêng + xưởng khác trong cùng 1
  // lượt vẫn dùng chung 1 khổ giấy (không tách riêng theo từng trang được).
  const anyWorkshopTicket = orders.some(
    (o) => o.productionCenterCode !== null && WORKSHOP_CENTER_CODES.includes(o.productionCenterCode),
  );
  // A4 LUÔN in dọc (portrait), kể cả khi thay cho mẫu xưởng vốn là A5 ngang:
  // A4 dọc (210mm) có bề ngang đúng bằng A5 ngang (210mm), nên giữ nguyên
  // margin trái/phải + bề rộng nội dung 190mm của WorkshopOrderContent mà
  // không cần scale lại — chỉ trang được "kéo dài" thêm để đủ chỗ cho nhiều
  // dòng sản phẩm, không đổi hướng sang A4 ngang.
  const pageCss =
    paperSize === "A4"
      ? anyWorkshopTicket
        ? "@page { size: A4 portrait; margin: 8mm 10mm; }"
        : "@page { size: A4 portrait; margin: 10mm 9mm; }"
      : anyWorkshopTicket
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
        /* Ghi chú sửa tại trang in (chỉ cục bộ, không lưu DB) — textarea tự
           giãn chiều cao theo nội dung (field-sizing: content) để luôn in đủ
           chữ, không bị cắt/cuộn như input 1 dòng. */
        .note-textarea {
          width: 100%;
          display: block;
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          font: inherit;
          color: inherit;
          padding: 5px 3px;
          overflow: hidden;
          field-sizing: content;
          text-decoration: underline;
        }
        /* 5 field phụ kiện Vải bạt (U treo/Buly/Bi treo/Dây chia/Dây kéo) —
           gõ trực tiếp trên trang in, to đậm như dòng mô tả (13px/700) để
           dễ đọc lúc sản xuất, gạch chấm báo hiệu có chỗ bấm vào nhập. */
        .vaibat-field-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          color: inherit;
          padding: 0 2px;
          border-bottom: 1px dotted #999;
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 flex gap-2 items-center z-50">
        <select
          value={paperSize}
          onChange={(e) => setPaperSize(e.target.value as "auto" | "A4")}
          style={{ border: "1px solid #d5d9e0", borderRadius: 6, padding: "8px 10px", fontSize: 14, background: "#fff" }}
        >
          <option value="auto">Khổ mặc định</option>
          <option value="A4">Khổ A4 (đơn dài)</option>
        </select>
        <button
          onClick={handlePrint}
          disabled={printing}
          style={{ background: "#17375e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 14, cursor: "pointer", fontWeight: 600 }}
        >
          {printing ? "Đang xử lý..." : "In và bắt đầu SX / Tải PDF"}
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
          order.productionCenterCode !== null && WORKSHOP_CENTER_CODES.includes(order.productionCenterCode);
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
              <WorkshopOrderContent order={order} onSaved={loadOrders} branding={branding} />
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
                {item.parameters.filter((p) => !HIDDEN_PARAM_NAMES.includes(p.name)).length > 0 && (
                  <div style={{ fontSize: 9, marginTop: 2 }}>
                    {item.parameters
                      .filter((p) => !HIDDEN_PARAM_NAMES.includes(p.name))
                      .map((p) => (
                        <span key={p.name} style={{ marginRight: 8 }}>
                          <span style={{ color: "var(--grey)" }}>{p.label}: </span>
                          {p.valueLabel ?? (p.name === WIDTH_PARAM_NAME || p.name === HEIGHT_PARAM_NAME ? formatDimension(p.value) : p.value)}
                          {p.unit ? ` ${p.unit}` : ""}
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

// Mẫu in dùng chung cho cả 4 xưởng (009-in-phieu-san-xuat.md) — cùng bố cục
// (rowSpan gộp dòng, tiêu đề có phụ đề tên xưởng, A5 ngang, không ô ký tên),
// cùng điều kiện gộp dòng — xem `groupKey()`: chỉ gộp khi cùng mã sản phẩm
// LẪN toàn bộ thông số khác Rộng/Cao.
// Thiết kế theo tư duy phiếu sản xuất giấy:
// không phải 1 bảng HTML duy nhất — header/khối thông tin dựng bằng flex/div,
// CHỈ bảng sản phẩm mới dùng <table> (đúng bản chất dữ liệu dạng bảng). Ưu
// tiên tốc độ đọc của công nhân: phân cấp cỡ chữ rõ (tên khách, Rộng/Cao rất
// lớn; mã tra cứu rất nhỏ), viền mảnh, không card/bo góc/đổ bóng.
const WORKSHOP_BORDER = "0.75px solid #000";

function WorkshopOrderContent({
  order,
  onSaved,
  branding,
}: {
  order: ProductionOrderPrintData;
  onSaved: () => void;
  branding: { companyName: string | null; logo: string | null } | null;
}) {
  const groups = groupItems(order.items, groupKey);
  const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  // Sửa ghi chú CHỈ trên trang in — chỉnh cục bộ (state FE), không gọi API,
  // không đổi SalesOrderItem.note. Refresh lại trang là mất, đúng ý định "chỉ
  // sửa bản in đang xem, không ảnh hưởng gì tới đơn hàng".
  // Gộp theo NHÓM giống cột "Tên sản phẩm" (key = id item đầu nhóm, rowSpan
  // = số dòng trong nhóm) — 1 ô Ghi chú dùng chung cho cả nhóm sản phẩm đã
  // gộp, không phải 1 ô/dòng như trước. Giá trị khởi tạo lấy note của item
  // đầu nhóm (item.note của các dòng còn lại trong nhóm bị bỏ qua trên UI).
  const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((group) => [group.items[0].id, group.items[0].note ?? ""])),
  );

  // 5 thông số phụ kiện Vải bạt (VAI_BAT_HANDWRITE_FIELDS) — gõ trực tiếp
  // trên trang in trước khi bấm in, CHỈ cục bộ (state FE, giống noteOverrides
  // ở trên), không có ở đâu khác trong dữ liệu vì chưa từng là tham số sản
  // phẩm lúc báo giá. Key = "{id item đầu nhóm}:{nhãn field}".
  const [vaiBatFieldOverrides, setVaiBatFieldOverrides] = useState<Record<string, string>>({});

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
          gridTemplateColumns: "0.7fr 3fr 0.7fr",
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {branding?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo}
              alt=""
              style={{ maxHeight: 34, maxWidth: 100, objectFit: "contain" }}
            />
          )}
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.5 }}>PHIẾU SX - XUẤT KHO</div>
        </div>
        <div style={{ ...lookupStyle, textAlign: "right" }}>
          <div>Ngày đặt hàng: {fmtDate(order.salesOrder.createdAt)}</div>
          <div>
            Hạn giao hàng:{" "}
            {order.salesOrder.expectedDeliveryDate ? fmtDate(order.salesOrder.expectedDeliveryDate) : "—"}
          </div>
          <div>{order.productionCenterName}</div>
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
          <div style={{ fontSize: 12.5, marginTop: 3 }}>{formatAddress(order.salesOrder) || "—"}</div>
          <div style={{ fontSize: 12.5, marginTop: 1 }}>SĐT: {order.salesOrder.deliveryPhone}</div>
        </div>
        <div style={{ flex: 1, border: WORKSHOP_BORDER, padding: "5px 8px" }}>
          <div style={boxLabelStyle}>Thông tin giao hàng</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {order.salesOrder.carrierName || (
                <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 120 }}>&nbsp;</span>
              )}
            </div>
            <span className="no-print">
              <CarrierInfoDialog
                salesOrderId={order.salesOrder.id}
                salesOrderCode={order.salesOrder.code}
                value={order.salesOrder}
                onSaved={onSaved}
              />
            </span>
          </div>
          <div style={{ fontSize: 11, marginTop: 3 }}>
            SĐT:{" "}
            {order.salesOrder.carrierPhone || (
              <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 90 }}>&nbsp;</span>
            )}
          </div>
          <div style={{ fontSize: 11, marginTop: 1 }}>
            Ghi chú:{" "}
            {order.salesOrder.carrierNote || (
              <span style={{ display: "inline-block", borderBottom: "1px dotted #999", minWidth: 90 }}>&nbsp;</span>
            )}
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
          <col style={{ width: "28%" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={thStyle}>STT</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Tên sản phẩm</th>
            <th style={thStyle}>Rộng</th>
            <th style={thStyle}>Cao</th>
            <th style={thStyle}>SL</th>
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
                        <div style={{ fontSize: 11, fontWeight: 500, color: "#444" }}>{group.productName}</div>
                        {description && (
                          <div
                            style={
                              order.productionCenterCode === BAT_CENTER_CODE
                                ? // Xưởng Bạt: sản phẩm như Mái hiên di động có nhiều
                                  // thông số phụ (khổ đua, mã bạt, vật liệu tay, cơ
                                  // cấu, quảng cáo, ống) — ép 1 dòng sẽ bị cắt mất
                                  // thông tin, nên cho xuống dòng tự nhiên.
                                  { fontSize: 13, fontWeight: 700, marginTop: 2, overflowWrap: "break-word" }
                                : {
                                    fontSize: 13,
                                    fontWeight: 700,
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }
                            }
                          >
                            {description}
                          </div>
                        )}
                        {group.productCode === VAI_BAT_PRODUCT_CODE && (
                          <div style={{ marginTop: 4 }}>
                            {VAI_BAT_HANDWRITE_FIELDS.map((label) => {
                              const key = `${group.items[0].id}:${label}`;
                              return (
                                <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 3 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{label}:</span>
                                  <input
                                    className="vaibat-field-input"
                                    value={vaiBatFieldOverrides[key] ?? ""}
                                    onChange={(e) =>
                                      setVaiBatFieldOverrides((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    )}
                    <td style={tdBigStyle}>{renderWidthCell(item)}</td>
                    <td style={tdBigStyle}>{renderHeightCell(item)}</td>
                    <td style={tdBigStyle}>{Number(item.quantity)}</td>
                    {itemIdx === 0 && (
                      <td
                        rowSpan={group.items.length}
                        style={{ ...tdStyle, textAlign: "left", padding: 0, verticalAlign: "top" }}
                      >
                        <NoteCell
                          value={noteOverrides[group.items[0].id] ?? ""}
                          onChange={(value) =>
                            setNoteOverrides((prev) => ({ ...prev, [group.items[0].id]: value }))
                          }
                        />
                      </td>
                    )}
                  </tr>
                );
              });
            });
          })()}
          <tr>
            <td colSpan={4} style={{ ...tdStyle, fontWeight: 700 }}>TỔNG CỘNG</td>
            <td style={tdBigStyle}>{totalQuantity}</td>
            <td style={{ border: WORKSHOP_BORDER }} />
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
