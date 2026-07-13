export class CreateDerivedParameterDto {
  /** Tên biến (vd: area) — dùng được trong công thức giá, định mức, condition. */
  name: string;
  expression: string;
  unit?: string;
  displayOrder?: number;
}

export class UpdateDerivedParameterDto {
  name?: string;
  expression?: string;
  unit?: string | null;
  displayOrder?: number;
}
