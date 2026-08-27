import { Injectable } from '@nestjs/common';
import { Response } from 'express';

// pdfmake 0.3.x — API mới dạng singleton (không phải class PdfPrinter của
// 0.2.x nên không dùng được @types/pdfmake). Khai báo tối thiểu phần API
// được dùng ở đây.
interface PdfMakeStatic {
  virtualfs: { writeFileSync(filename: string, content: Buffer): void };
  addFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(docDefinition: Record<string, unknown>): {
    getBuffer(): Promise<Buffer>;
  };
}

/* eslint-disable @typescript-eslint/no-require-imports */
const pdfmake = require('pdfmake') as PdfMakeStatic;
const vfsFonts = require('pdfmake/build/vfs_fonts.js') as Record<
  string,
  string
>;
/* eslint-enable @typescript-eslint/no-require-imports */

// Đăng ký font Roboto (bundle sẵn trong pdfmake, hỗ trợ đầy đủ dấu tiếng
// Việt) vào virtual file system — chỉ chạy một lần khi load module.
for (const [name, base64] of Object.entries(vfsFonts)) {
  pdfmake.virtualfs.writeFileSync(name, Buffer.from(base64, 'base64'));
}
pdfmake.addFonts({
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
});
// PDF báo cáo chỉ dựng từ dữ liệu API — không tải tài nguyên ngoài, không đọc
// file hệ thống.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

export interface PdfColumn {
  header: string;
  key: string;
  // 'auto' | '*' | số pt — mặc định '*' (chia đều).
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfExportOptions {
  // Tiêu đề báo cáo, in đầu trang.
  title: string;
  // Dòng phụ (kỳ báo cáo + thời điểm xuất — bắt buộc theo report.md Export).
  subtitle?: string;
  landscape?: boolean;
}

// Cột cho exportGrouped() — không có `key` như PdfColumn (flat, map theo
// key/row) vì caller tự dựng từng ô, không map từ 1 object phẳng.
export interface PdfGroupedColumn {
  header: string;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

// 1 ô trong bảng gộp (exportGrouped) — dùng cho bảng có cột bị gộp theo
// nhóm (VD: PDF Công nợ theo khách hàng, mỗi khách 1 nhóm, xổ ra nhiều đơn).
export interface PdfCell {
  text: string;
  // Số hàng ô này chiếm (gộp dọc) — chỉ đặt ở hàng ĐẦU của nhóm.
  rowSpan?: number;
  align?: 'left' | 'right' | 'center';
  // true nếu ô này nằm trong vùng bị 1 rowSpan phía trên che — pdfmake yêu
  // cầu 1 placeholder rỗng tại đây, không được bỏ hẳn phần tử khỏi hàng.
  covered?: boolean;
}

// Wrapper mỏng quanh pdfmake — API tối thiểu tương đương ExcelService.export()
// (nhận cột + rows, trả file qua Response). Report không gọi thư viện PDF
// trực tiếp (report.md mục "Excel & PDF Export").
@Injectable()
export class PdfService {
  async export(
    res: Response,
    filename: string,
    columns: PdfColumn[],
    rows: Record<string, unknown>[],
    options: PdfExportOptions,
  ): Promise<void> {
    const headerRow = columns.map((col) => ({
      text: col.header,
      style: 'tableHeader',
      alignment: col.align ?? 'left',
    }));

    const bodyRows = rows.map((row) =>
      columns.map((col) => ({
        text: this.formatCell(row[col.key]),
        alignment: col.align ?? 'left',
      })),
    );

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: options.landscape ? 'landscape' : 'portrait',
      pageMargins: [32, 32, 32, 40],
      content: [
        { text: options.title, style: 'title' },
        ...(options.subtitle
          ? [{ text: options.subtitle, style: 'subtitle' }]
          : []),
        {
          table: {
            headerRows: 1,
            widths: columns.map((col) => col.width ?? '*'),
            body: [headerRow, ...bodyRows],
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? '#f0f0f0' : null,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
          },
        },
      ],
      styles: {
        title: { fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
        subtitle: {
          fontSize: 9,
          color: '#555555',
          margin: [0, 0, 0, 10] as number[],
        },
        tableHeader: { bold: true, fontSize: 9 },
      },
      defaultStyle: { fontSize: 9 },
    };

    const buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.pdf"`,
    );
    res.end(buffer);
  }

  // Bảng gộp ô theo nhóm (VD: PDF Công nợ theo khách hàng) — khác export()
  // ở chỗ caller tự dựng từng ô (kèm rowSpan/covered) thay vì map theo
  // key/row phẳng, vì shape dữ liệu nhóm không quy về "1 dòng = 1 record".
  async exportGrouped(
    res: Response,
    filename: string,
    columns: PdfGroupedColumn[],
    body: PdfCell[][],
    options: PdfExportOptions,
  ): Promise<void> {
    const headerRow = columns.map((col) => ({
      text: col.header,
      style: 'tableHeader',
      alignment: col.align ?? 'left',
    }));

    const bodyRows = body.map((row) =>
      row.map((cell) =>
        cell.covered
          ? {}
          : {
              text: cell.text,
              rowSpan: cell.rowSpan,
              alignment: cell.align ?? 'left',
            },
      ),
    );

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: options.landscape ? 'landscape' : 'portrait',
      pageMargins: [32, 32, 32, 40],
      content: [
        { text: options.title, style: 'title' },
        ...(options.subtitle
          ? [{ text: options.subtitle, style: 'subtitle' }]
          : []),
        {
          table: {
            headerRows: 1,
            widths: columns.map((col) => col.width ?? '*'),
            body: [headerRow, ...bodyRows],
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? '#f0f0f0' : null,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
          },
        },
      ],
      styles: {
        title: { fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
        subtitle: {
          fontSize: 9,
          color: '#555555',
          margin: [0, 0, 0, 10] as number[],
        },
        tableHeader: { bold: true, fontSize: 9 },
      },
      defaultStyle: { fontSize: 9 },
    };

    const buffer = await pdfmake.createPdf(docDefinition).getBuffer();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.pdf"`,
    );
    res.end(buffer);
  }

  private formatCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return new Intl.NumberFormat('vi-VN').format(value);
    }
    if (value instanceof Date) {
      return value.toLocaleDateString('vi-VN');
    }
    return String(value);
  }
}
