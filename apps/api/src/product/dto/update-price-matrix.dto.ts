export class PriceMatrixRowDto {
  /** Tổ hợp config: map tên parameter → value, vd {"maukhung":"cafe","socanh":"2"} */
  dimensions: Record<string, string>;
  unitPrice: number;
  displayOrder?: number;
}

/** Bulk replace toàn bộ matrix của một version DRAFT (editor dạng Excel lưu cả bảng). */
export class UpdatePriceMatrixDto {
  rows: PriceMatrixRowDto[];
}
