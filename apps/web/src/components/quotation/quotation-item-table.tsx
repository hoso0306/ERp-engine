"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Trash2 } from "lucide-react";

interface Parameter {
  name: string;
  label: string;
  value: string;
  valueLabel: string | null;
  unit: string | null;
}

interface QuotationItemRow {
  id: string;
  productId: string;
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
  // Snapshot tại thời điểm thêm/sửa dòng — hiển thị đọc từ đây, không đọc Product.
  productCode: string;
  productName: string;
  // Chỉ dùng điều hướng (navigation), không dùng hiển thị.
  product: { id: string; code: string; name: string };
  parameters: Parameter[];
}

// 022-gia-von-loi-nhuan-bao-gia.md — chỉ OWNER/ADMIN nhận được map này (page
// cha chỉ fetch cost-summary khi hasPermission("quotation.view-cost")).
interface ItemCostInfo {
  costUnitPrice: number;
  totalCost: number;
  costAvailable: boolean;
}

interface QuotationItemTableProps {
  items: QuotationItemRow[];
  editable: boolean;
  onEdit: (item: QuotationItemRow) => void;
  onDelete: (itemId: string) => void;
  // Nhân đôi dòng: thêm 1 dòng mới cùng productId/quantity/parameters/note —
  // giá/chiết khấu/VAT được BE tự tính lại như thêm dòng mới bình thường,
  // không copy nguyên số đã snapshot (đúng nguyên tắc addItem hiện có).
  onDuplicate: (item: QuotationItemRow) => void;
  // Giảm thêm cấp toàn báo giá (Sprint 04, chốt 16/07/2026) — hiện dòng riêng
  // trước "Tổng thanh toán" nếu có.
  discountAmount?: number;
  // Giá vốn ước tính theo dòng — undefined nếu không có quyền xem.
  costByItemId?: Map<string, ItemCostInfo>;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function QuotationItemTable({ items, editable, onEdit, onDelete, onDuplicate, discountAmount = 0, costByItemId }: QuotationItemTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Chưa có sản phẩm nào. {editable ? "Nhấn \"Thêm sản phẩm\" để bắt đầu." : ""}
      </p>
    );
  }

  const showCost = !!costByItemId;
  const totalAmount = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalVat = items.reduce((s, i) => s + Number(i.vatAmount ?? 0), 0);
  const totalCost = costByItemId
    ? items.reduce((s, i) => s + (costByItemId.get(i.id)?.totalCost ?? 0), 0)
    : 0;
  const hasIncompleteCost = costByItemId
    ? items.some((i) => costByItemId.get(i.id)?.costAvailable === false)
    : false;
  const profit = totalAmount - totalCost;
  // Luôn = 9 (Sản phẩm..Chú thích) — không phụ thuộc editable, vì cột action
  // (nếu có) được thêm riêng qua {editable && <TableCell/>} ở cuối mỗi hàng,
  // không phải một phần của colSpan nhãn. Chỉ dùng khi showCost=true (giá trị
  // rơi đúng cột "Giá vốn" ngay sau).
  const colSpan = 10;
  // Các dòng tổng tiền hàng/VAT phải thẳng cột với "Thành tiền"/"VAT" ở bảng
  // trên, thay vì dồn hết vào colSpan rồi lệch sang cột "Chú thích"/"Giá vốn".
  // labelColsToAmount: STT, Sản phẩm, Thông số, Giá bán, Chiết khấu, Phụ phí, SL.
  const labelColsToAmount = 7;
  const labelColsToVat = labelColsToAmount + 1; // + Thành tiền
  const fillerAfterVat = 1 + (showCost ? 1 : 0); // Chú thích, (Giá vốn)
  const totalCols = 10 + (showCost ? 1 : 0) + (editable ? 1 : 0);

  return (
    <div className="rounded-md border">
      {/* table-layout: fixed + colgroup — bảng "auto" trước đó tự giãn cột
          "Chú thích" ra hấp thụ khoảng trống thừa của w-full dù đã set
          width/max-width trên <td>, vì width/max-width không phải là ràng
          buộc cứng trong table-layout auto. Fixed + colgroup mới ép đúng % bề
          rộng từng cột, không cột nào tự giãn ra ngoài ý muốn. */}
      <Table className="table-fixed">
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "15%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "4%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          {showCost && <col style={{ width: "8%" }} />}
          {/* px cố định, không phải % — cần đủ chỗ cho 3 nút icon (Sửa/Nhân
              đôi/Xoá), % nhỏ ở màn hẹp sẽ làm nút tràn đè lên cột trước. */}
          {editable && <col style={{ width: "116px" }} />}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">STT</TableHead>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-center">Chiết khấu</TableHead>
            <TableHead className="text-right">Phụ phí</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="text-right">VAT</TableHead>
            <TableHead>Chú thích</TableHead>
            {showCost && <TableHead className="text-right">Giá vốn</TableHead>}
            {editable && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id}>
              <TableCell className="text-center text-sm text-muted-foreground">{idx + 1}</TableCell>
              <TableCell className="whitespace-normal break-words">
                <div className="font-medium">{item.productName}</div>
                <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div className="space-y-0.5">
                  {item.parameters.length > 0
                    ? item.parameters.map((p) => (
                        <div key={p.name} className="truncate max-w-[180px]">
                          <span className="text-muted-foreground/70">{p.label}:</span>{" "}
                          {p.value}{p.unit ? ` ${p.unit}` : ""}
                        </div>
                      ))
                    : "—"}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {item.unitPrice !== null ? (
                  <>
                    <div className="font-semibold">{formatNumber(Number(item.unitPrice))}</div>
                    <div className="text-xs text-muted-foreground font-sans">đ/m²</div>
                  </>
                ) : (
                  formatMoney(Number(item.systemPrice))
                )}
              </TableCell>
              <TableCell className="text-center text-sm">
                {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : "—"}
              </TableCell>
              <TableCell className="text-right text-sm whitespace-normal break-words">
                {Number(item.surchargeAfterDiscount) > 0
                  ? formatMoney(Number(item.surchargeAfterDiscount))
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold whitespace-normal break-words">
                {formatMoney(Number(item.subtotal))}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground whitespace-normal break-words">
                {Number(item.vatRate) > 0
                  ? `${item.vatRate}% · ${formatMoney(Number(item.vatAmount))}`
                  : "—"}
              </TableCell>
              <TableCell className="text-xs whitespace-normal break-words space-y-0.5">
                {/* TableCell gốc (ui/table.tsx) có sẵn "whitespace-nowrap" —
                    phải override lại bằng "whitespace-normal" thì chữ mới
                    xuống hàng được. Bề rộng cột giờ do <colgroup> ở đầu bảng
                    quyết định (table-fixed) — không cần w-28/width riêng ở
                    đây nữa. */}
                {item.warnings?.map((w, idx) => (
                  <div key={idx} className="text-amber-600 dark:text-amber-500">⚠ {w}</div>
                ))}
                {item.note && <div className="text-muted-foreground">{item.note}</div>}
                {!item.warnings?.length && !item.note && "—"}
              </TableCell>
              {showCost && (
                <TableCell className="text-right font-mono text-sm text-muted-foreground whitespace-normal break-words">
                  {(() => {
                    const cost = costByItemId!.get(item.id);
                    if (!cost || !cost.costAvailable) {
                      return (
                        <span title="Sản phẩm chưa có Định mức vật tư đang hoạt động">—</span>
                      );
                    }
                    return formatMoney(cost.costUnitPrice);
                  })()}
                </TableCell>
              )}
              {editable && (
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Nhân đôi dòng này" onClick={() => onDuplicate(item)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {/* Khoảng cách với các dòng sản phẩm phía trên. */}
          <TableRow>
            <TableCell colSpan={totalCols} className="h-3 p-0 border-0" />
          </TableRow>
          {/* Dòng "TỔNG" — như 1 dòng sản phẩm, chữ TỔNG thẳng cột "Phụ phí",
              các số tự rơi đúng cột Thành tiền/VAT như dòng sản phẩm phía
              trên, mỗi số 1 màu/cỡ riêng theo mức quan trọng (tiền hàng: to,
              đậm; VAT: to hơn nhưng không đậm, màu phụ). Đặt TRƯỚC nhóm giá
              vốn/lợi nhuận (chỉ Owner/Admin có quyền xem) vì đây là số ai xem
              báo giá cũng thấy. */}
          <TableRow className="bg-muted/50">
            <TableCell colSpan={5} />
            <TableCell className="text-right font-bold whitespace-normal break-words">TỔNG</TableCell>
            <TableCell />
            <TableCell className="text-right font-mono text-sm font-bold whitespace-normal break-words">
              {formatMoney(totalAmount)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-muted-foreground whitespace-normal break-words">
              {totalVat > 0 ? formatMoney(totalVat) : "—"}
            </TableCell>
            <TableCell colSpan={fillerAfterVat} />
            {editable && <TableCell />}
          </TableRow>
          {discountAmount > 0 && (
            <TableRow className="bg-muted/50">
              <TableCell colSpan={labelColsToVat} className="text-right text-sm font-medium text-destructive whitespace-normal break-words">
                Giảm thêm
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-destructive whitespace-normal break-words">
                −{formatMoney(discountAmount)}
              </TableCell>
              <TableCell colSpan={fillerAfterVat} />
              {editable && <TableCell />}
            </TableRow>
          )}
          {/* Tổng thanh toán: CHỮ thẳng cột với "TỔNG" (bắt đầu từ cột Phụ
              phí, căn trái — không right-align cả colSpan nữa vì sẽ đẩy chữ
              sát vào ô số liệu), SỐ LIỆU vẫn thẳng cột VAT (giống Tổng
              VAT/Giảm thêm phía trên). Gộp chung hàng với Tổng giá vốn (khi
              có quyền xem) — Tổng giá vốn vẫn rơi đúng cột "Giá vốn" như dòng
              sản phẩm phía trên. */}
          {totalVat > 0 || discountAmount > 0 ? (
            <TableRow className="bg-muted/50 border-t-2 border-foreground/15">
              <TableCell colSpan={labelColsToAmount - 2} />
              <TableCell colSpan={3} className="text-left text-sm font-bold whitespace-normal break-words">
                Tổng thanh toán
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-bold text-primary whitespace-normal break-words">
                {formatMoney(totalAmount + totalVat - discountAmount)}
              </TableCell>
              {showCost ? (
                <>
                  <TableCell className="text-right text-sm font-bold text-muted-foreground whitespace-normal break-words">
                    Tổng giá vốn (ước tính){hasIncompleteCost && " *"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-green-400 whitespace-normal break-words">
                    {formatMoney(totalCost)}
                  </TableCell>
                </>
              ) : (
                <TableCell colSpan={fillerAfterVat} />
              )}
              {editable && <TableCell />}
            </TableRow>
          ) : (
            showCost && (
              <TableRow className="bg-muted/50 border-t-2 border-foreground/15">
                <TableCell colSpan={colSpan} className="text-right text-sm font-bold text-muted-foreground whitespace-normal break-words">
                  Tổng giá vốn (ước tính){hasIncompleteCost && " *"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold text-green-400 whitespace-normal break-words">
                  {formatMoney(totalCost)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
            )
          )}
          {showCost && (
            <>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm font-bold whitespace-normal break-words">
                  Lợi nhuận (ước tính)
                </TableCell>
                <TableCell
                  className={`text-right font-mono text-sm font-bold whitespace-normal break-words ${profit < 0 ? "text-destructive" : "text-green-700"}`}
                >
                  {profit >= 0 ? "+" : ""}
                  {formatMoney(profit)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
              {hasIncompleteCost && (
                <TableRow>
                  <TableCell colSpan={colSpan + 1 + (editable ? 1 : 0)} className="text-xs text-muted-foreground text-right pt-0">
                    * Một số sản phẩm chưa có Định mức vật tư đang hoạt động — giá vốn chưa đầy đủ.
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
