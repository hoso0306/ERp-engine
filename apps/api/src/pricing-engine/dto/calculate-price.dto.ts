export class ParameterInputDto {
  name: string;
  value: string;
}

export class CalculatePriceDto {
  productId: string;
  parameters: ParameterInputDto[];
}

export class CalculatePriceResultDto {
  systemPrice: number;
  pricingRuleVersionId: string;
  /** Đơn giá/m² tra từ Price Matrix — null khi tính bằng expression fallback. */
  unitPrice: number | null;
  /** Giá trước làm tròn. */
  rawPrice: number;
  /**
   * Thuế suất VAT (%) snapshot từ Pricing Rule Version — KHÔNG tính vào
   * systemPrice. Nơi gọi (Quotation) tự cộng vatAmount sau khi áp dụng
   * chiết khấu (Discount Engine).
   */
  vatRate: number;
  /**
   * Kích thước/biến TÍNH TIỀN sau khi áp min-rule/bậc thang.
   * CHỈ để hiển thị/giải trình — KHÔNG BAO GIỜ truyền sang BOM Engine
   * (BOM luôn dùng kích thước gốc — nguyên tắc billable ≠ actual).
   */
  adjustedVariables: Record<string, number>;
  /** Cảnh báo từ Validation Rule (WARN) — cho phép tiếp tục. */
  warnings: string[];
}
