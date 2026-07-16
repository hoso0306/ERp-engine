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
}
