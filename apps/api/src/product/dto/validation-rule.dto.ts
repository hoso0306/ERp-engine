export class CreateValidationRuleDto {
  /** Expression mô tả điều kiện VI PHẠM (true → cảnh báo/chặn), vd: chieucao > 2 * chieurong */
  expression: string;
  /** WARN (mặc định) hoặc BLOCK */
  severity?: string;
  message: string;
  displayOrder?: number;
}

export class UpdateValidationRuleDto {
  expression?: string;
  severity?: string;
  message?: string;
  displayOrder?: number;
}
