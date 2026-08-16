import { BadRequestException } from '@nestjs/common';

// Copy nguyên 3 hàm thuần từ QuotationWorkflowService (calcFinalPrice/
// calcSubtotal/calcVatAmount) — KHÔNG extract/sửa file đó (đã có test bao phủ
// dày), dùng cho luồng "phục dựng hoá đơn" từ Công nợ đầu kỳ
// (VatSettlementService.createFromOpeningBalance(), opening-balance.md). Nếu
// sửa công thức ở 1 bên, nhớ sửa bên kia (apps/api/src/quotation/quotation-workflow.service.ts).

export function calcFinalPrice(
  systemPrice: number,
  discountPercent: number,
  surchargeAfterDiscount = 0,
): number {
  const final = systemPrice * (1 - discountPercent / 100) + surchargeAfterDiscount;

  if (final < 0) {
    throw new BadRequestException(
      'Giá bán cuối không được âm. Vui lòng kiểm tra lại chiết khấu.',
    );
  }

  return Math.round(final);
}

export function calcSubtotal(finalPrice: number, quantity: number): number {
  return Math.round(finalPrice * quantity);
}

// VAT tính SAU Discount Engine (chốt 16/07/2026) — trên subtotal đã chiết
// khấu và extend theo số lượng, không phải trên systemPrice gốc.
// Tách ngược (chốt 16/08/2026): subtotal từ nay ĐÃ GỒM VAT sẵn — xem
// quotation-workflow.service.ts calcVatAmount(), sửa 1 bên nhớ sửa bên kia.
export function calcVatAmount(subtotal: number, vatRate: number): number {
  return Math.round((subtotal * vatRate) / (100 + vatRate));
}
