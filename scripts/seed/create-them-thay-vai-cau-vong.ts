/**
 * Tạo sản phẩm "Thêm/Thay vải cầu vồng" (SP000138) — mục ⑨ phiếu tay khách
 * hàng: tính giá khi khách đã có bộ Rèm cầu vồng (RCV) rồi, chỉ muốn thay
 * vải, không thay khung/máng. Xem workbench/sessions/2707.md mục 12 để biết
 * đầy đủ bối cảnh + lý do thiết kế (đặc biệt: matrix lưu giá GỐC 100%, hệ số
 * 70% nằm trong expression — bản v2 sau khi người dùng phản hồi bản v1 khó
 * sửa; matrix KHÔNG tự đồng bộ nếu RCV gốc SP000056-095 đổi giá sau này).
 *
 * Dữ liệu (159 dòng ma trận giá, 40 dòng BOM) lấy ĐÚNG NGUYÊN VĂN từ Product
 * đã tạo + verify trên Local (previewPrice/previewMaterial đã chạy qua) —
 * không suy diễn lại từ 40 sản phẩm RCV gốc, tránh lệch với bản đã duyệt.
 *
 * Idempotent theo tên sản phẩm — an toàn chạy lại nhiều lần. Yêu cầu môi
 * trường đích (VPS) đã có ProductType "Rèm cầu vồng", Unit "m²", Xưởng Cầu
 * Vồng (XW004), và toàn bộ vật tư vải NL000021... (dùng chung với RCV gốc).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-them-thay-vai-cau-vong.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = "Rèm cầu vồng";
const UNIT_NAME = "m²";
const PRODUCTION_CENTER_CODE = "XW004";
const PRODUCT_NAME = "Thêm/Thay vải cầu vồng";

const MATRIX_ROWS: { dimensions: Record<string, string>; unitPrice: number; displayOrder: number }[] = [
    { dimensions: {"marem":"OG01"}, unitPrice: 1300000, displayOrder: 0 },
    { dimensions: {"marem":"OG02"}, unitPrice: 1300000, displayOrder: 1 },
    { dimensions: {"marem":"OG03"}, unitPrice: 1300000, displayOrder: 2 },
    { dimensions: {"marem":"CT01"}, unitPrice: 1250000, displayOrder: 3 },
    { dimensions: {"marem":"CT02"}, unitPrice: 1250000, displayOrder: 4 },
    { dimensions: {"marem":"CT03"}, unitPrice: 1250000, displayOrder: 5 },
    { dimensions: {"marem":"VE01"}, unitPrice: 1200000, displayOrder: 6 },
    { dimensions: {"marem":"VE02"}, unitPrice: 1200000, displayOrder: 7 },
    { dimensions: {"marem":"VE03"}, unitPrice: 1200000, displayOrder: 8 },
    { dimensions: {"marem":"VE04"}, unitPrice: 1200000, displayOrder: 9 },
    { dimensions: {"marem":"HK01"}, unitPrice: 1100000, displayOrder: 10 },
    { dimensions: {"marem":"HK02"}, unitPrice: 1100000, displayOrder: 11 },
    { dimensions: {"marem":"HK03"}, unitPrice: 1100000, displayOrder: 12 },
    { dimensions: {"marem":"HK04"}, unitPrice: 1100000, displayOrder: 13 },
    { dimensions: {"marem":"VA201"}, unitPrice: 1000000, displayOrder: 14 },
    { dimensions: {"marem":"VA202"}, unitPrice: 1000000, displayOrder: 15 },
    { dimensions: {"marem":"VA203"}, unitPrice: 1000000, displayOrder: 16 },
    { dimensions: {"marem":"DL01"}, unitPrice: 1000000, displayOrder: 17 },
    { dimensions: {"marem":"DL02"}, unitPrice: 1000000, displayOrder: 18 },
    { dimensions: {"marem":"DL03"}, unitPrice: 1000000, displayOrder: 19 },
    { dimensions: {"marem":"LX01"}, unitPrice: 990000, displayOrder: 20 },
    { dimensions: {"marem":"LX02"}, unitPrice: 990000, displayOrder: 21 },
    { dimensions: {"marem":"LX03"}, unitPrice: 990000, displayOrder: 22 },
    { dimensions: {"marem":"LX04"}, unitPrice: 990000, displayOrder: 23 },
    { dimensions: {"marem":"SS01"}, unitPrice: 980000, displayOrder: 24 },
    { dimensions: {"marem":"SS02"}, unitPrice: 980000, displayOrder: 25 },
    { dimensions: {"marem":"SS03"}, unitPrice: 980000, displayOrder: 26 },
    { dimensions: {"marem":"SS04"}, unitPrice: 980000, displayOrder: 27 },
    { dimensions: {"marem":"RA01"}, unitPrice: 960000, displayOrder: 28 },
    { dimensions: {"marem":"RA02"}, unitPrice: 960000, displayOrder: 29 },
    { dimensions: {"marem":"RA03"}, unitPrice: 960000, displayOrder: 30 },
    { dimensions: {"marem":"VT401"}, unitPrice: 890000, displayOrder: 31 },
    { dimensions: {"marem":"VT402"}, unitPrice: 890000, displayOrder: 32 },
    { dimensions: {"marem":"VT403"}, unitPrice: 890000, displayOrder: 33 },
    { dimensions: {"marem":"VT404"}, unitPrice: 890000, displayOrder: 34 },
    { dimensions: {"marem":"VT405"}, unitPrice: 890000, displayOrder: 35 },
    { dimensions: {"marem":"SD86-2"}, unitPrice: 880000, displayOrder: 36 },
    { dimensions: {"marem":"SD86-3"}, unitPrice: 880000, displayOrder: 37 },
    { dimensions: {"marem":"SD86-4"}, unitPrice: 880000, displayOrder: 38 },
    { dimensions: {"marem":"SD86-5"}, unitPrice: 880000, displayOrder: 39 },
    { dimensions: {"marem":"RO1"}, unitPrice: 870000, displayOrder: 40 },
    { dimensions: {"marem":"RO2"}, unitPrice: 870000, displayOrder: 41 },
    { dimensions: {"marem":"RO3"}, unitPrice: 870000, displayOrder: 42 },
    { dimensions: {"marem":"RO4"}, unitPrice: 870000, displayOrder: 43 },
    { dimensions: {"marem":"FL501"}, unitPrice: 860000, displayOrder: 44 },
    { dimensions: {"marem":"FL502"}, unitPrice: 860000, displayOrder: 45 },
    { dimensions: {"marem":"FL503"}, unitPrice: 860000, displayOrder: 46 },
    { dimensions: {"marem":"FL504"}, unitPrice: 860000, displayOrder: 47 },
    { dimensions: {"marem":"GA21"}, unitPrice: 850000, displayOrder: 48 },
    { dimensions: {"marem":"GA22"}, unitPrice: 850000, displayOrder: 49 },
    { dimensions: {"marem":"GA23"}, unitPrice: 850000, displayOrder: 50 },
    { dimensions: {"marem":"GA24"}, unitPrice: 850000, displayOrder: 51 },
    { dimensions: {"marem":"RT56"}, unitPrice: 830000, displayOrder: 52 },
    { dimensions: {"marem":"RT57"}, unitPrice: 830000, displayOrder: 53 },
    { dimensions: {"marem":"RT58"}, unitPrice: 830000, displayOrder: 54 },
    { dimensions: {"marem":"RT59"}, unitPrice: 830000, displayOrder: 55 },
    { dimensions: {"marem":"MT31"}, unitPrice: 830000, displayOrder: 56 },
    { dimensions: {"marem":"MT32"}, unitPrice: 830000, displayOrder: 57 },
    { dimensions: {"marem":"MT33"}, unitPrice: 830000, displayOrder: 58 },
    { dimensions: {"marem":"OL01"}, unitPrice: 780000, displayOrder: 59 },
    { dimensions: {"marem":"OL02"}, unitPrice: 780000, displayOrder: 60 },
    { dimensions: {"marem":"OL03"}, unitPrice: 780000, displayOrder: 61 },
    { dimensions: {"marem":"OL04"}, unitPrice: 780000, displayOrder: 62 },
    { dimensions: {"marem":"TK101"}, unitPrice: 770000, displayOrder: 63 },
    { dimensions: {"marem":"TK102"}, unitPrice: 770000, displayOrder: 64 },
    { dimensions: {"marem":"TK103"}, unitPrice: 770000, displayOrder: 65 },
    { dimensions: {"marem":"TK104"}, unitPrice: 770000, displayOrder: 66 },
    { dimensions: {"marem":"CG21-1"}, unitPrice: 760000, displayOrder: 67 },
    { dimensions: {"marem":"CG21-2"}, unitPrice: 760000, displayOrder: 68 },
    { dimensions: {"marem":"CG21-3"}, unitPrice: 760000, displayOrder: 69 },
    { dimensions: {"marem":"CG21-4"}, unitPrice: 760000, displayOrder: 70 },
    { dimensions: {"marem":"AP901"}, unitPrice: 720000, displayOrder: 71 },
    { dimensions: {"marem":"AP902"}, unitPrice: 720000, displayOrder: 72 },
    { dimensions: {"marem":"AP903"}, unitPrice: 720000, displayOrder: 73 },
    { dimensions: {"marem":"AP904"}, unitPrice: 720000, displayOrder: 74 },
    { dimensions: {"marem":"AP905"}, unitPrice: 720000, displayOrder: 75 },
    { dimensions: {"marem":"IT01"}, unitPrice: 710000, displayOrder: 76 },
    { dimensions: {"marem":"IT02"}, unitPrice: 710000, displayOrder: 77 },
    { dimensions: {"marem":"IT03"}, unitPrice: 710000, displayOrder: 78 },
    { dimensions: {"marem":"FS21"}, unitPrice: 700000, displayOrder: 79 },
    { dimensions: {"marem":"FS22"}, unitPrice: 700000, displayOrder: 80 },
    { dimensions: {"marem":"FS23"}, unitPrice: 700000, displayOrder: 81 },
    { dimensions: {"marem":"FS24"}, unitPrice: 700000, displayOrder: 82 },
    { dimensions: {"marem":"AC24-1"}, unitPrice: 700000, displayOrder: 83 },
    { dimensions: {"marem":"AC24-2"}, unitPrice: 700000, displayOrder: 84 },
    { dimensions: {"marem":"AC24-3"}, unitPrice: 700000, displayOrder: 85 },
    { dimensions: {"marem":"AC24-4"}, unitPrice: 700000, displayOrder: 86 },
    { dimensions: {"marem":"TL501"}, unitPrice: 690000, displayOrder: 87 },
    { dimensions: {"marem":"TL502"}, unitPrice: 690000, displayOrder: 88 },
    { dimensions: {"marem":"TL503"}, unitPrice: 690000, displayOrder: 89 },
    { dimensions: {"marem":"TL504"}, unitPrice: 690000, displayOrder: 90 },
    { dimensions: {"marem":"VC96-1"}, unitPrice: 690000, displayOrder: 91 },
    { dimensions: {"marem":"VC96-2"}, unitPrice: 690000, displayOrder: 92 },
    { dimensions: {"marem":"VC96-3"}, unitPrice: 690000, displayOrder: 93 },
    { dimensions: {"marem":"VC96-4"}, unitPrice: 690000, displayOrder: 94 },
    { dimensions: {"marem":"VC96-5"}, unitPrice: 690000, displayOrder: 95 },
    { dimensions: {"marem":"LK39-1"}, unitPrice: 690000, displayOrder: 96 },
    { dimensions: {"marem":"LK39-2"}, unitPrice: 690000, displayOrder: 97 },
    { dimensions: {"marem":"LK39-3"}, unitPrice: 690000, displayOrder: 98 },
    { dimensions: {"marem":"LK39-4"}, unitPrice: 690000, displayOrder: 99 },
    { dimensions: {"marem":"LK39-5"}, unitPrice: 690000, displayOrder: 100 },
    { dimensions: {"marem":"FM91-1"}, unitPrice: 680000, displayOrder: 101 },
    { dimensions: {"marem":"FM91-2"}, unitPrice: 680000, displayOrder: 102 },
    { dimensions: {"marem":"FM91-3"}, unitPrice: 680000, displayOrder: 103 },
    { dimensions: {"marem":"FM91-4"}, unitPrice: 680000, displayOrder: 104 },
    { dimensions: {"marem":"FM91-5"}, unitPrice: 680000, displayOrder: 105 },
    { dimensions: {"marem":"AM33-1"}, unitPrice: 680000, displayOrder: 106 },
    { dimensions: {"marem":"AM33-2"}, unitPrice: 680000, displayOrder: 107 },
    { dimensions: {"marem":"AM33-3"}, unitPrice: 680000, displayOrder: 108 },
    { dimensions: {"marem":"AM33-4"}, unitPrice: 680000, displayOrder: 109 },
    { dimensions: {"marem":"BB50-1"}, unitPrice: 680000, displayOrder: 110 },
    { dimensions: {"marem":"BB50-2"}, unitPrice: 680000, displayOrder: 111 },
    { dimensions: {"marem":"BB50-3"}, unitPrice: 680000, displayOrder: 112 },
    { dimensions: {"marem":"WL01"}, unitPrice: 670000, displayOrder: 113 },
    { dimensions: {"marem":"WL02"}, unitPrice: 670000, displayOrder: 114 },
    { dimensions: {"marem":"WL03"}, unitPrice: 670000, displayOrder: 115 },
    { dimensions: {"marem":"WL04"}, unitPrice: 670000, displayOrder: 116 },
    { dimensions: {"marem":"PA901"}, unitPrice: 650000, displayOrder: 117 },
    { dimensions: {"marem":"PA902"}, unitPrice: 650000, displayOrder: 118 },
    { dimensions: {"marem":"PA903"}, unitPrice: 650000, displayOrder: 119 },
    { dimensions: {"marem":"PA904"}, unitPrice: 650000, displayOrder: 120 },
    { dimensions: {"marem":"GE18-1"}, unitPrice: 580000, displayOrder: 121 },
    { dimensions: {"marem":"GE18-2"}, unitPrice: 580000, displayOrder: 122 },
    { dimensions: {"marem":"GE18-3"}, unitPrice: 580000, displayOrder: 123 },
    { dimensions: {"marem":"CV601"}, unitPrice: 580000, displayOrder: 124 },
    { dimensions: {"marem":"CV602"}, unitPrice: 580000, displayOrder: 125 },
    { dimensions: {"marem":"CV603"}, unitPrice: 580000, displayOrder: 126 },
    { dimensions: {"marem":"CV604"}, unitPrice: 580000, displayOrder: 127 },
    { dimensions: {"marem":"CV605"}, unitPrice: 580000, displayOrder: 128 },
    { dimensions: {"marem":"LB15-1"}, unitPrice: 660000, displayOrder: 129 },
    { dimensions: {"marem":"LB15-2"}, unitPrice: 660000, displayOrder: 130 },
    { dimensions: {"marem":"LB15-3"}, unitPrice: 660000, displayOrder: 131 },
    { dimensions: {"marem":"LB15-4"}, unitPrice: 660000, displayOrder: 132 },
    { dimensions: {"marem":"KO01"}, unitPrice: 630000, displayOrder: 133 },
    { dimensions: {"marem":"KO02"}, unitPrice: 630000, displayOrder: 134 },
    { dimensions: {"marem":"KO03"}, unitPrice: 630000, displayOrder: 135 },
    { dimensions: {"marem":"MC16-1"}, unitPrice: 620000, displayOrder: 136 },
    { dimensions: {"marem":"MC16-2"}, unitPrice: 620000, displayOrder: 137 },
    { dimensions: {"marem":"MC16-3"}, unitPrice: 620000, displayOrder: 138 },
    { dimensions: {"marem":"MC16-4"}, unitPrice: 620000, displayOrder: 139 },
    { dimensions: {"marem":"MC16-5"}, unitPrice: 620000, displayOrder: 140 },
    { dimensions: {"marem":"CR01"}, unitPrice: 600000, displayOrder: 141 },
    { dimensions: {"marem":"CR02"}, unitPrice: 600000, displayOrder: 142 },
    { dimensions: {"marem":"CR03"}, unitPrice: 600000, displayOrder: 143 },
    { dimensions: {"marem":"CR04"}, unitPrice: 600000, displayOrder: 144 },
    { dimensions: {"marem":"LS38-1"}, unitPrice: 570000, displayOrder: 145 },
    { dimensions: {"marem":"LS38-2"}, unitPrice: 570000, displayOrder: 146 },
    { dimensions: {"marem":"LS38-3"}, unitPrice: 570000, displayOrder: 147 },
    { dimensions: {"marem":"LS38-4"}, unitPrice: 570000, displayOrder: 148 },
    { dimensions: {"marem":"LS38-5"}, unitPrice: 570000, displayOrder: 149 },
    { dimensions: {"marem":"BS1-1"}, unitPrice: 480000, displayOrder: 150 },
    { dimensions: {"marem":"BS1-2"}, unitPrice: 480000, displayOrder: 151 },
    { dimensions: {"marem":"BS1-3"}, unitPrice: 480000, displayOrder: 152 },
    { dimensions: {"marem":"BS1-4"}, unitPrice: 480000, displayOrder: 153 },
    { dimensions: {"marem":"BS1-5"}, unitPrice: 480000, displayOrder: 154 },
    { dimensions: {"marem":"BS19-1"}, unitPrice: 480000, displayOrder: 155 },
    { dimensions: {"marem":"BS19-2"}, unitPrice: 480000, displayOrder: 156 },
    { dimensions: {"marem":"BS19-3"}, unitPrice: 480000, displayOrder: 157 },
    { dimensions: {"marem":"BS19-4"}, unitPrice: 480000, displayOrder: 158 },
];

const BOM_ITEMS: { materialCode: string; expression: string; wastePercent: number; condition: string | undefined; note: string | undefined; displayOrder: number }[] = [
    { materialCode: "NL000021", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"OG01\" || marem == \"OG02\" || marem == \"OG03\"", note: undefined, displayOrder: 1 },
    { materialCode: "NL000100", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"CT01\" || marem == \"CT02\" || marem == \"CT03\"", note: undefined, displayOrder: 2 },
    { materialCode: "NL000101", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"VE01\" || marem == \"VE02\" || marem == \"VE03\" || marem == \"VE04\"", note: undefined, displayOrder: 3 },
    { materialCode: "NL000102", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"HK01\" || marem == \"HK02\" || marem == \"HK03\" || marem == \"HK04\"", note: undefined, displayOrder: 4 },
    { materialCode: "NL000103", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"VA201\" || marem == \"VA202\" || marem == \"VA203\"", note: undefined, displayOrder: 5 },
    { materialCode: "NL000104", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"DL01\" || marem == \"DL02\" || marem == \"DL03\"", note: undefined, displayOrder: 6 },
    { materialCode: "NL000105", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"LX01\" || marem == \"LX02\" || marem == \"LX03\" || marem == \"LX04\"", note: undefined, displayOrder: 7 },
    { materialCode: "NL000106", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"SS01\" || marem == \"SS02\" || marem == \"SS03\" || marem == \"SS04\"", note: undefined, displayOrder: 8 },
    { materialCode: "NL000107", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"RA01\" || marem == \"RA02\" || marem == \"RA03\"", note: undefined, displayOrder: 9 },
    { materialCode: "NL000108", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"VT401\" || marem == \"VT402\" || marem == \"VT403\" || marem == \"VT404\" || marem == \"VT405\"", note: undefined, displayOrder: 10 },
    { materialCode: "NL000109", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"SD86-2\" || marem == \"SD86-3\" || marem == \"SD86-4\" || marem == \"SD86-5\"", note: undefined, displayOrder: 11 },
    { materialCode: "NL000110", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"RO1\" || marem == \"RO2\" || marem == \"RO3\" || marem == \"RO4\"", note: undefined, displayOrder: 12 },
    { materialCode: "NL000111", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"FL501\" || marem == \"FL502\" || marem == \"FL503\" || marem == \"FL504\"", note: undefined, displayOrder: 13 },
    { materialCode: "NL000112", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"GA21\" || marem == \"GA22\" || marem == \"GA23\" || marem == \"GA24\"", note: undefined, displayOrder: 14 },
    { materialCode: "NL000113", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"RT56\" || marem == \"RT57\" || marem == \"RT58\" || marem == \"RT59\"", note: undefined, displayOrder: 15 },
    { materialCode: "NL000114", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"MT31\" || marem == \"MT32\" || marem == \"MT33\"", note: undefined, displayOrder: 16 },
    { materialCode: "NL000115", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"OL01\" || marem == \"OL02\" || marem == \"OL03\" || marem == \"OL04\"", note: undefined, displayOrder: 17 },
    { materialCode: "NL000116", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"TK101\" || marem == \"TK102\" || marem == \"TK103\" || marem == \"TK104\"", note: undefined, displayOrder: 18 },
    { materialCode: "NL000117", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"CG21-1\" || marem == \"CG21-2\" || marem == \"CG21-3\" || marem == \"CG21-4\"", note: undefined, displayOrder: 19 },
    { materialCode: "NL000118", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"AP901\" || marem == \"AP902\" || marem == \"AP903\" || marem == \"AP904\" || marem == \"AP905\"", note: undefined, displayOrder: 20 },
    { materialCode: "NL000119", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"IT01\" || marem == \"IT02\" || marem == \"IT03\"", note: undefined, displayOrder: 21 },
    { materialCode: "NL000120", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"FS21\" || marem == \"FS22\" || marem == \"FS23\" || marem == \"FS24\"", note: undefined, displayOrder: 22 },
    { materialCode: "NL000121", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"AC24-1\" || marem == \"AC24-2\" || marem == \"AC24-3\" || marem == \"AC24-4\"", note: undefined, displayOrder: 23 },
    { materialCode: "NL000122", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"TL501\" || marem == \"TL502\" || marem == \"TL503\" || marem == \"TL504\"", note: undefined, displayOrder: 24 },
    { materialCode: "NL000123", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"VC96-1\" || marem == \"VC96-2\" || marem == \"VC96-3\" || marem == \"VC96-4\" || marem == \"VC96-5\"", note: undefined, displayOrder: 25 },
    { materialCode: "NL000124", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"LK39-1\" || marem == \"LK39-2\" || marem == \"LK39-3\" || marem == \"LK39-4\" || marem == \"LK39-5\"", note: undefined, displayOrder: 26 },
    { materialCode: "NL000125", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"FM91-1\" || marem == \"FM91-2\" || marem == \"FM91-3\" || marem == \"FM91-4\" || marem == \"FM91-5\"", note: undefined, displayOrder: 27 },
    { materialCode: "NL000126", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"AM33-1\" || marem == \"AM33-2\" || marem == \"AM33-3\" || marem == \"AM33-4\"", note: undefined, displayOrder: 28 },
    { materialCode: "NL000127", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"BB50-1\" || marem == \"BB50-2\" || marem == \"BB50-3\"", note: undefined, displayOrder: 29 },
    { materialCode: "NL000128", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"WL01\" || marem == \"WL02\" || marem == \"WL03\" || marem == \"WL04\"", note: undefined, displayOrder: 30 },
    { materialCode: "NL000129", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"PA901\" || marem == \"PA902\" || marem == \"PA903\" || marem == \"PA904\"", note: undefined, displayOrder: 31 },
    { materialCode: "NL000130", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"GE18-1\" || marem == \"GE18-2\" || marem == \"GE18-3\"", note: undefined, displayOrder: 32 },
    { materialCode: "NL000131", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"CV601\" || marem == \"CV602\" || marem == \"CV603\" || marem == \"CV604\" || marem == \"CV605\"", note: undefined, displayOrder: 33 },
    { materialCode: "NL000132", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"LB15-1\" || marem == \"LB15-2\" || marem == \"LB15-3\" || marem == \"LB15-4\"", note: undefined, displayOrder: 34 },
    { materialCode: "NL000133", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"KO01\" || marem == \"KO02\" || marem == \"KO03\"", note: undefined, displayOrder: 35 },
    { materialCode: "NL000134", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"MC16-1\" || marem == \"MC16-2\" || marem == \"MC16-3\" || marem == \"MC16-4\" || marem == \"MC16-5\"", note: undefined, displayOrder: 36 },
    { materialCode: "NL000135", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"CR01\" || marem == \"CR02\" || marem == \"CR03\" || marem == \"CR04\"", note: undefined, displayOrder: 37 },
    { materialCode: "NL000136", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"LS38-1\" || marem == \"LS38-2\" || marem == \"LS38-3\" || marem == \"LS38-4\" || marem == \"LS38-5\"", note: undefined, displayOrder: 38 },
    { materialCode: "NL000137", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"BS1-1\" || marem == \"BS1-2\" || marem == \"BS1-3\" || marem == \"BS1-4\" || marem == \"BS1-5\"", note: undefined, displayOrder: 39 },
    { materialCode: "NL000138", expression: "area/3.1*2", wastePercent: 30, condition: "marem == \"BS19-1\" || marem == \"BS19-2\" || marem == \"BS19-3\" || marem == \"BS19-4\"", note: undefined, displayOrder: 40 },
];

let prisma: PrismaService;

async function resolveByName(model: 'productType' | 'unit', name: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" trên môi trường này — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function resolveByCode(model: 'productionCenter', code: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { code } });
  if (!row) throw new Error(`Không tìm thấy ${model} với code="${code}" trên môi trường này — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function resolveMaterialIds(codes: string[]): Promise<Record<string, string>> {
  const rows = await prisma.material.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const map: Record<string, string> = {};
  for (const c of codes) {
    const m = rows.find((r) => r.code === c);
    if (!m) throw new Error(`Material ${c} không tồn tại trên môi trường này.`);
    map[c] = m.id;
  }
  return map;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Tra cứu Master Data tham chiếu...');
    const productTypeId = await resolveByName('productType', PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);

    const existing = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (existing) {
      console.log(`\n[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existing.code}).`);
      return;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);

  const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

  await svc.createProductParameter(product.id, { name: "chieurong", label: "Chiều rộng", type: "NUMBER", unit: "m", isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: "chieucao", label: "Chiều cao", type: "NUMBER", unit: "m", isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: "marem", label: "Mã rèm", type: "ENUM", isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: [
      { value: "OG01", label: "OG01 — OMEGA", displayOrder: 0 },
      { value: "OG02", label: "OG02 — OMEGA", displayOrder: 1 },
      { value: "OG03", label: "OG03 — OMEGA", displayOrder: 2 },
      { value: "CT01", label: "CT01 — CARTIER", displayOrder: 3 },
      { value: "CT02", label: "CT02 — CARTIER", displayOrder: 4 },
      { value: "CT03", label: "CT03 — CARTIER", displayOrder: 5 },
      { value: "VE01", label: "VE01 — VALENTINO", displayOrder: 6 },
      { value: "VE02", label: "VE02 — VALENTINO", displayOrder: 7 },
      { value: "VE03", label: "VE03 — VALENTINO", displayOrder: 8 },
      { value: "VE04", label: "VE04 — VALENTINO", displayOrder: 9 },
      { value: "HK01", label: "HK01 — HENIKEN", displayOrder: 10 },
      { value: "HK02", label: "HK02 — HENIKEN", displayOrder: 11 },
      { value: "HK03", label: "HK03 — HENIKEN", displayOrder: 12 },
      { value: "HK04", label: "HK04 — HENIKEN", displayOrder: 13 },
      { value: "VA201", label: "VA201 — VATICAN", displayOrder: 14 },
      { value: "VA202", label: "VA202 — VATICAN", displayOrder: 15 },
      { value: "VA203", label: "VA203 — VATICAN", displayOrder: 16 },
      { value: "DL01", label: "DL01 — DYLAN", displayOrder: 17 },
      { value: "DL02", label: "DL02 — DYLAN", displayOrder: 18 },
      { value: "DL03", label: "DL03 — DYLAN", displayOrder: 19 },
      { value: "LX01", label: "LX01 — LUXURA", displayOrder: 20 },
      { value: "LX02", label: "LX02 — LUXURA", displayOrder: 21 },
      { value: "LX03", label: "LX03 — LUXURA", displayOrder: 22 },
      { value: "LX04", label: "LX04 — LUXURA", displayOrder: 23 },
      { value: "SS01", label: "SS01 — SAMSON", displayOrder: 24 },
      { value: "SS02", label: "SS02 — SAMSON", displayOrder: 25 },
      { value: "SS03", label: "SS03 — SAMSON", displayOrder: 26 },
      { value: "SS04", label: "SS04 — SAMSON", displayOrder: 27 },
      { value: "RA01", label: "RA01 — RHANA", displayOrder: 28 },
      { value: "RA02", label: "RA02 — RHANA", displayOrder: 29 },
      { value: "RA03", label: "RA03 — RHANA", displayOrder: 30 },
      { value: "VT401", label: "VT401 — VICTORY", displayOrder: 31 },
      { value: "VT402", label: "VT402 — VICTORY", displayOrder: 32 },
      { value: "VT403", label: "VT403 — VICTORY", displayOrder: 33 },
      { value: "VT404", label: "VT404 — VICTORY", displayOrder: 34 },
      { value: "VT405", label: "VT405 — VICTORY", displayOrder: 35 },
      { value: "SD86-2", label: "SD86-2 — SUNDIVA", displayOrder: 36 },
      { value: "SD86-3", label: "SD86-3 — SUNDIVA", displayOrder: 37 },
      { value: "SD86-4", label: "SD86-4 — SUNDIVA", displayOrder: 38 },
      { value: "SD86-5", label: "SD86-5 — SUNDIVA", displayOrder: 39 },
      { value: "RO1", label: "RO1 — ROYOL", displayOrder: 40 },
      { value: "RO2", label: "RO2 — ROYOL", displayOrder: 41 },
      { value: "RO3", label: "RO3 — ROYOL", displayOrder: 42 },
      { value: "RO4", label: "RO4 — ROYOL", displayOrder: 43 },
      { value: "FL501", label: "FL501 — FAMILY", displayOrder: 44 },
      { value: "FL502", label: "FL502 — FAMILY", displayOrder: 45 },
      { value: "FL503", label: "FL503 — FAMILY", displayOrder: 46 },
      { value: "FL504", label: "FL504 — FAMILY", displayOrder: 47 },
      { value: "GA21", label: "GA21 — GALAXY", displayOrder: 48 },
      { value: "GA22", label: "GA22 — GALAXY", displayOrder: 49 },
      { value: "GA23", label: "GA23 — GALAXY", displayOrder: 50 },
      { value: "GA24", label: "GA24 — GALAXY", displayOrder: 51 },
      { value: "RT56", label: "RT56 — ROMANTIC", displayOrder: 52 },
      { value: "RT57", label: "RT57 — ROMANTIC", displayOrder: 53 },
      { value: "RT58", label: "RT58 — ROMANTIC", displayOrder: 54 },
      { value: "RT59", label: "RT59 — ROMANTIC", displayOrder: 55 },
      { value: "MT31", label: "MT31 — MOUTAIN", displayOrder: 56 },
      { value: "MT32", label: "MT32 — MOUTAIN", displayOrder: 57 },
      { value: "MT33", label: "MT33 — MOUTAIN", displayOrder: 58 },
      { value: "OL01", label: "OL01 — OLIVER", displayOrder: 59 },
      { value: "OL02", label: "OL02 — OLIVER", displayOrder: 60 },
      { value: "OL03", label: "OL03 — OLIVER", displayOrder: 61 },
      { value: "OL04", label: "OL04 — OLIVER", displayOrder: 62 },
      { value: "TK101", label: "TK101 — TOKYO", displayOrder: 63 },
      { value: "TK102", label: "TK102 — TOKYO", displayOrder: 64 },
      { value: "TK103", label: "TK103 — TOKYO", displayOrder: 65 },
      { value: "TK104", label: "TK104 — TOKYO", displayOrder: 66 },
      { value: "CG21-1", label: "CG21-1 — CHARMING", displayOrder: 67 },
      { value: "CG21-2", label: "CG21-2 — CHARMING", displayOrder: 68 },
      { value: "CG21-3", label: "CG21-3 — CHARMING", displayOrder: 69 },
      { value: "CG21-4", label: "CG21-4 — CHARMING", displayOrder: 70 },
      { value: "AP901", label: "AP901 — APOLO", displayOrder: 71 },
      { value: "AP902", label: "AP902 — APOLO", displayOrder: 72 },
      { value: "AP903", label: "AP903 — APOLO", displayOrder: 73 },
      { value: "AP904", label: "AP904 — APOLO", displayOrder: 74 },
      { value: "AP905", label: "AP905 — APOLO", displayOrder: 75 },
      { value: "IT01", label: "IT01 — INTERONE", displayOrder: 76 },
      { value: "IT02", label: "IT02 — INTERONE", displayOrder: 77 },
      { value: "IT03", label: "IT03 — INTERONE", displayOrder: 78 },
      { value: "FS21", label: "FS21 — FANTACY", displayOrder: 79 },
      { value: "FS22", label: "FS22 — FANTACY", displayOrder: 80 },
      { value: "FS23", label: "FS23 — FANTACY", displayOrder: 81 },
      { value: "FS24", label: "FS24 — FANTACY", displayOrder: 82 },
      { value: "AC24-1", label: "AC24-1 — ATLANTIC", displayOrder: 83 },
      { value: "AC24-2", label: "AC24-2 — ATLANTIC", displayOrder: 84 },
      { value: "AC24-3", label: "AC24-3 — ATLANTIC", displayOrder: 85 },
      { value: "AC24-4", label: "AC24-4 — ATLANTIC", displayOrder: 86 },
      { value: "TL501", label: "TL501 — TULIPS", displayOrder: 87 },
      { value: "TL502", label: "TL502 — TULIPS", displayOrder: 88 },
      { value: "TL503", label: "TL503 — TULIPS", displayOrder: 89 },
      { value: "TL504", label: "TL504 — TULIPS", displayOrder: 90 },
      { value: "VC96-1", label: "VC96-1 — VENICE", displayOrder: 91 },
      { value: "VC96-2", label: "VC96-2 — VENICE", displayOrder: 92 },
      { value: "VC96-3", label: "VC96-3 — VENICE", displayOrder: 93 },
      { value: "VC96-4", label: "VC96-4 — VENICE", displayOrder: 94 },
      { value: "VC96-5", label: "VC96-5 — VENICE", displayOrder: 95 },
      { value: "LK39-1", label: "LK39-1 — LUCKY", displayOrder: 96 },
      { value: "LK39-2", label: "LK39-2 — LUCKY", displayOrder: 97 },
      { value: "LK39-3", label: "LK39-3 — LUCKY", displayOrder: 98 },
      { value: "LK39-4", label: "LK39-4 — LUCKY", displayOrder: 99 },
      { value: "LK39-5", label: "LK39-5 — LUCKY", displayOrder: 100 },
      { value: "FM91-1", label: "FM91-1 — FLAMINGO", displayOrder: 101 },
      { value: "FM91-2", label: "FM91-2 — FLAMINGO", displayOrder: 102 },
      { value: "FM91-3", label: "FM91-3 — FLAMINGO", displayOrder: 103 },
      { value: "FM91-4", label: "FM91-4 — FLAMINGO", displayOrder: 104 },
      { value: "FM91-5", label: "FM91-5 — FLAMINGO", displayOrder: 105 },
      { value: "AM33-1", label: "AM33-1 — ARMANI", displayOrder: 106 },
      { value: "AM33-2", label: "AM33-2 — ARMANI", displayOrder: 107 },
      { value: "AM33-3", label: "AM33-3 — ARMANI", displayOrder: 108 },
      { value: "AM33-4", label: "AM33-4 — ARMANI", displayOrder: 109 },
      { value: "BB50-1", label: "BB50-1 — BURBERY", displayOrder: 110 },
      { value: "BB50-2", label: "BB50-2 — BURBERY", displayOrder: 111 },
      { value: "BB50-3", label: "BB50-3 — BURBERY", displayOrder: 112 },
      { value: "WL01", label: "WL01 — WOODLOOK", displayOrder: 113 },
      { value: "WL02", label: "WL02 — WOODLOOK", displayOrder: 114 },
      { value: "WL03", label: "WL03 — WOODLOOK", displayOrder: 115 },
      { value: "WL04", label: "WL04 — WOODLOOK", displayOrder: 116 },
      { value: "PA901", label: "PA901 — PALACE", displayOrder: 117 },
      { value: "PA902", label: "PA902 — PALACE", displayOrder: 118 },
      { value: "PA903", label: "PA903 — PALACE", displayOrder: 119 },
      { value: "PA904", label: "PA904 — PALACE", displayOrder: 120 },
      { value: "GE18-1", label: "GE18-1 — GREENBAY", displayOrder: 121 },
      { value: "GE18-2", label: "GE18-2 — GREENBAY", displayOrder: 122 },
      { value: "GE18-3", label: "GE18-3 — GREENBAY", displayOrder: 123 },
      { value: "CV601", label: "CV601 — CAVANI", displayOrder: 124 },
      { value: "CV602", label: "CV602 — CAVANI", displayOrder: 125 },
      { value: "CV603", label: "CV603 — CAVANI", displayOrder: 126 },
      { value: "CV604", label: "CV604 — CAVANI", displayOrder: 127 },
      { value: "CV605", label: "CV605 — CAVANI", displayOrder: 128 },
      { value: "LB15-1", label: "LB15-1 — LIBERTY", displayOrder: 129 },
      { value: "LB15-2", label: "LB15-2 — LIBERTY", displayOrder: 130 },
      { value: "LB15-3", label: "LB15-3 — LIBERTY", displayOrder: 131 },
      { value: "LB15-4", label: "LB15-4 — LIBERTY", displayOrder: 132 },
      { value: "KO01", label: "KO01 — KOSY", displayOrder: 133 },
      { value: "KO02", label: "KO02 — KOSY", displayOrder: 134 },
      { value: "KO03", label: "KO03 — KOSY", displayOrder: 135 },
      { value: "MC16-1", label: "MC16-1 — MARCELO", displayOrder: 136 },
      { value: "MC16-2", label: "MC16-2 — MARCELO", displayOrder: 137 },
      { value: "MC16-3", label: "MC16-3 — MARCELO", displayOrder: 138 },
      { value: "MC16-4", label: "MC16-4 — MARCELO", displayOrder: 139 },
      { value: "MC16-5", label: "MC16-5 — MARCELO", displayOrder: 140 },
      { value: "CR01", label: "CR01 — CARA", displayOrder: 141 },
      { value: "CR02", label: "CR02 — CARA", displayOrder: 142 },
      { value: "CR03", label: "CR03 — CARA", displayOrder: 143 },
      { value: "CR04", label: "CR04 — CARA", displayOrder: 144 },
      { value: "LS38-1", label: "LS38-1 — LOTUS", displayOrder: 145 },
      { value: "LS38-2", label: "LS38-2 — LOTUS", displayOrder: 146 },
      { value: "LS38-3", label: "LS38-3 — LOTUS", displayOrder: 147 },
      { value: "LS38-4", label: "LS38-4 — LOTUS", displayOrder: 148 },
      { value: "LS38-5", label: "LS38-5 — LOTUS", displayOrder: 149 },
      { value: "BS1-1", label: "BS1-1 — BASIC EDITION 1", displayOrder: 150 },
      { value: "BS1-2", label: "BS1-2 — BASIC EDITION 1", displayOrder: 151 },
      { value: "BS1-3", label: "BS1-3 — BASIC EDITION 1", displayOrder: 152 },
      { value: "BS1-4", label: "BS1-4 — BASIC EDITION 1", displayOrder: 153 },
      { value: "BS1-5", label: "BS1-5 — BASIC EDITION 1", displayOrder: 154 },
      { value: "BS19-1", label: "BS19-1 — BASIC EDITION 2", displayOrder: 155 },
      { value: "BS19-2", label: "BS19-2 — BASIC EDITION 2", displayOrder: 156 },
      { value: "BS19-3", label: "BS19-3 — BASIC EDITION 2", displayOrder: 157 },
      { value: "BS19-4", label: "BS19-4 — BASIC EDITION 2", displayOrder: 158 },
    ] } as any);

  await svc.createDerivedParameter(product.id, { name: "area", expression: "chieurong * chieucao", unit: "m2", displayOrder: 1 } as any);

  await svc.createValidationRule(product.id, { expression: "area < 1", severity: "WARN", message: "Diện tích < 1m² sẽ tính bằng 1m²", displayOrder: 2 } as any);
  await svc.createValidationRule(product.id, { expression: "chieucao < 1", severity: "WARN", message: "Chiều cao < 1m sẽ tính bằng 1m", displayOrder: 1 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: "v2", expression: "unitPrice * area * 0.7", priceRoundType: "CEIL", priceRoundValue: 100, vatRate: 8, note: "unitPrice trong matrix là giá GỐC 100% (y hệt sản phẩm Rèm cầu vồng gốc tương ứng — SP000056-095), hệ số 70% nằm trong expression. Nếu RCV gốc đổi giá 1 dòng vải, PHẢI cập nhật lại đúng dòng marem tương ứng ở matrix này (không có cơ chế tự đồng bộ giữa 2 sản phẩm)." } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: "MIN_AREA", targetParameter: undefined, value: 1, condition: undefined, displayOrder: 1, description: "Bộ vải có diện tích nhỏ hơn 1m² tính bằng 1m²." } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: "MIN_DIMENSION", targetParameter: "chieucao", value: 1, condition: undefined, displayOrder: 2, description: "Chiều cao thấp hơn 1m tính bằng 1m." } as any);
  await svc.updatePriceMatrix(prv.id, MATRIX_ROWS);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: "v1" } as any);
  const M = await resolveMaterialIds(BOM_ITEMS.map((it) => it.materialCode));
  for (const it of BOM_ITEMS) {
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M[it.materialCode], expression: it.expression, wastePercent: it.wastePercent, condition: it.condition, note: it.note, displayOrder: it.displayOrder } as any);
  }
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}. (${BOM_ITEMS.length} dòng BOM, ${MATRIX_ROWS.length} dòng giá)`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
