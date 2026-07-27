// Allocation Policy (023-cong-no-payment-allocation-fifo) — tách rời khỏi
// Allocation Engine (DebtService). Chỉ 1 nhiệm vụ: cho 1 Receivable + 1 số
// tiền cần cấn, trả về cách chia subtotal/VAT. Đổi chính sách sau này (vd
// chia theo tỷ lệ subtotal:vat của đơn) chỉ cần viết class mới implement
// cùng interface, không sửa Engine.

export interface AllocationSplit {
  allocatedSubtotal: number;
  allocatedVat: number;
}

export interface AllocationPolicy {
  split(
    receivable: { remainingAmountBeforeVat: number },
    allocatedTotal: number,
  ): AllocationSplit;
}

// Mặc định — đúng hành vi hiện tại của module (debt.md "Track song song Trước
// VAT / Sau VAT"): trừ hết phần trước-VAT của Receivable trước, dư mới trừ
// vào VAT. Khách trả tiền mặt không lấy hoá đơn thì chỉ cần trả tới mức
// trước-VAT. Nếu remainingAmountBeforeVat đã <= 0 (đã trả hết phần gốc từ
// trước, đang trả dần vào VAT), toàn bộ khoản mới đi thẳng vào allocatedVat.
export class BeforeVatFirstPolicy implements AllocationPolicy {
  split(
    receivable: { remainingAmountBeforeVat: number },
    allocatedTotal: number,
  ): AllocationSplit {
    const subtotalAvailable = Math.max(receivable.remainingAmountBeforeVat, 0);
    const allocatedSubtotal = Math.min(allocatedTotal, subtotalAvailable);
    const allocatedVat = allocatedTotal - allocatedSubtotal;
    return { allocatedSubtotal, allocatedVat };
  }
}
