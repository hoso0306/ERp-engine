import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  // numFmt '@' = định dạng Text — dùng cho cột SĐT để Excel không tự cắt
  // số 0 đầu khi người dùng nhập liệu vào file (testlan1 mục Khách hàng).
  numFmt?: string;
  // Dropdown chọn từ danh sách (Excel Data Validation) — dùng cho cột tương
  // ứng với ô Select trên web (VD: Nhóm KH, Ưu tiên...), giúp người dùng
  // không gõ sai giá trị khi điền file. Bỏ qua nếu rỗng.
  validationList?: string[];
}

@Injectable()
export class ExcelService {
  async readFile(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    return workbook.getWorksheet(1)!;
  }

  async export(
    res: Response,
    filename: string,
    columns: ExcelColumn[],
    rows: Record<string, unknown>[],
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');

    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
      ...(col.numFmt ? { style: { numFmt: col.numFmt } } : {}),
    }));

    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow(row);
    }

    this.applyDropdownValidations(workbook, sheet, columns);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  // Data Validation dạng list không nhận trực tiếp mảng giá trị — phải trỏ
  // formula tới 1 vùng ô. Danh sách chứa dấu phẩy (tên tiếng Việt) nên KHÔNG
  // dùng inline list ("A,B,C"), phải ghi ra sheet ẩn rồi tham chiếu range.
  private readonly VALIDATION_ROW_COUNT = 500;

  private applyDropdownValidations(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    columns: ExcelColumn[],
  ): void {
    const columnsWithList = columns
      .map((col, idx) => ({ col, colIndex: idx + 1 }))
      .filter((c) => c.col.validationList && c.col.validationList.length > 0);

    if (columnsWithList.length === 0) return;

    const listSheet = workbook.addWorksheet('Lists');
    listSheet.state = 'hidden';

    columnsWithList.forEach(({ col, colIndex }, listColIdx) => {
      const values = col.validationList!;
      const listColLetter = listSheet.getColumn(listColIdx + 1).letter;
      values.forEach((v, i) => {
        listSheet.getCell(i + 1, listColIdx + 1).value = v;
      });

      const dataColLetter = sheet.getColumn(colIndex).letter;
      const formula = `Lists!$${listColLetter}$1:$${listColLetter}$${values.length}`;
      for (let r = 2; r <= this.VALIDATION_ROW_COUNT; r++) {
        sheet.getCell(`${dataColLetter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Giá trị không hợp lệ',
          error: `Vui lòng chọn 1 giá trị trong danh sách cho cột "${col.header}".`,
        };
      }
    });
  }
}
