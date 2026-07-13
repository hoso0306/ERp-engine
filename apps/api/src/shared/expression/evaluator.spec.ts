/**
 * ĐẶC TẢ GRAMMAR của Expression Language dùng chung toàn ERP.
 *
 * Mỗi test case ở đây là một điều khoản của hợp đồng ngôn ngữ. Sau khi có
 * expression lưu trong DB, grammar chỉ được MỞ RỘNG (thêm test mới),
 * không được sửa/đổi ngữ nghĩa các case đã có.
 */
import { evaluate, evaluateNumber, evaluateBoolean, validate, ExpressionError } from './evaluator';

describe('ExpressionEvaluator — số học', () => {
  it.each<[string, Record<string, number>, number]>([
    ['1 + 2', {}, 3],
    ['10 - 4 - 3', {}, 3], // trái sang phải
    ['2 + 3 * 4', {}, 14], // nhân trước cộng
    ['(2 + 3) * 4', {}, 20],
    ['10 / 4', {}, 2.5],
    ['10 % 3', {}, 1],
    ['-5 + 10', {}, 5], // trừ đơn
    ['--5', {}, 5],
    ['2 * -3', {}, -6],
    ['0.5 * 4', {}, 2],
    ['.5 * 4', {}, 2],
    ['chieurong * 2', { chieurong: 250 }, 500],
    ['(chieucao/100)*(chieurong/100)*328000', { chieucao: 200, chieurong: 100 }, 656000],
    ['socanh*(chieucao*chieurong)*100000/10000', { socanh: 2, chieucao: 100, chieurong: 100 }, 200000],
  ])('%s = %p', (expr, ctx, expected) => {
    expect(evaluateNumber(expr, ctx)).toBeCloseTo(expected, 10);
  });
});

describe('ExpressionEvaluator — hàm', () => {
  it.each<[string, Record<string, number>, number]>([
    ['if(width > 200, 6, 4)', { width: 250 }, 6],
    ['if(width > 200, 6, 4)', { width: 150 }, 4],
    ['if(area < 0.7, 0.7, if(area < 1, 1, area))', { area: 0.5 }, 0.7], // if lồng — rule bậc thang
    ['if(area < 0.7, 0.7, if(area < 1, 1, area))', { area: 0.85 }, 1],
    ['if(area < 0.7, 0.7, if(area < 1, 1, area))', { area: 2.5 }, 2.5],
    ['ceil(1.2)', {}, 2],
    ['floor(1.8)', {}, 1],
    ['round(1.5)', {}, 2],
    ['ceil(1.01, 0.5)', {}, 1.5], // làm tròn theo bước
    ['floor(1.99, 0.5)', {}, 1.5],
    ['round(123456, 1000)', {}, 123000],
    ['min(3, 7)', {}, 3],
    ['max(3, 7, 5)', {}, 7],
    ['abs(-4)', {}, 4],
    ['min(width, 100) * 2', { width: 60 }, 120],
  ])('%s = %p', (expr, ctx, expected) => {
    expect(evaluateNumber(expr, ctx)).toBeCloseTo(expected, 10);
  });

  it('if() trả về nhánh đúng ngay cả khi nhánh kia lỗi (lazy)', () => {
    // Nhánh không được chọn không được evaluate — chuẩn cho chia 0 có điều kiện
    expect(evaluateNumber('if(x > 0, 10 / x, 0)', { x: 0 })).toBe(0);
  });
});

describe('ExpressionEvaluator — so sánh & logic (condition)', () => {
  it.each<[string, Record<string, number | string | boolean>, boolean]>([
    ['door == 2', { door: 2 }, true],
    ['door == 2', { door: 1 }, false],
    ['door != 2', { door: 1 }, true],
    ['width >= 70', { width: 70 }, true],
    ['width < 70', { width: 70 }, false],
    ['color == "cafe"', { color: 'cafe' }, true],
    ["color == 'cafe'", { color: 'van_go' }, false],
    ['door == 2 && color == "cafe"', { door: 2, color: 'cafe' }, true],
    ['door == 2 && color == "cafe"', { door: 2, color: 'trang' }, false],
    ['door == 1 || door == 2', { door: 2 }, true],
    ['!(door == 2)', { door: 1 }, true],
    ['height > 2 * width', { height: 300, width: 100 }, true], // rule hệ xích
    ['true', {}, true],
    ['false || true', {}, true],
  ])('%s → %p', (expr, ctx, expected) => {
    expect(evaluateBoolean(expr, ctx)).toBe(expected);
  });

  it('&& short-circuit: vế phải không evaluate khi vế trái false', () => {
    expect(evaluateBoolean('false && khongtontai == 1', {})).toBe(false);
  });

  it('|| short-circuit: vế phải không evaluate khi vế trái true', () => {
    expect(evaluateBoolean('true || khongtontai == 1', {})).toBe(true);
  });
});

describe('ExpressionEvaluator — lỗi rõ ràng, không âm thầm', () => {
  it('biến không tồn tại → throw (không trả 0)', () => {
    expect(() => evaluateNumber('width * 2', {})).toThrow(ExpressionError);
    expect(() => evaluateNumber('width * 2', {})).toThrow(/width/);
  });

  it('chia 0 → throw (không trả Infinity)', () => {
    expect(() => evaluateNumber('10 / 0', {})).toThrow(/số hợp lệ/);
  });

  it('cú pháp sai → throw', () => {
    expect(() => evaluateNumber('width *', { width: 1 })).toThrow(ExpressionError);
    expect(() => evaluateNumber('2 +* 3', {})).toThrow(ExpressionError);
    expect(() => evaluateNumber('(2 + 3', {})).toThrow(/ngoặc/);
  });

  it('không có truthiness: && với số → throw', () => {
    expect(() => evaluate('1 && true', {})).toThrow(/boolean/);
  });

  it('so sánh khác kiểu → throw', () => {
    expect(() => evaluate('door == "2"', { door: 2 })).toThrow(/cùng kiểu/);
  });

  it('so sánh lớn/nhỏ trên chuỗi → throw', () => {
    expect(() => evaluate('color > 5', { color: 'cafe' })).toThrow(/số/);
  });

  it('hàm không tồn tại → throw kèm danh sách hàm hỗ trợ', () => {
    expect(() => evaluateNumber('sqrt(4)', {})).toThrow(/không tồn tại/);
  });

  it('sai số lượng tham số → throw', () => {
    expect(() => evaluateNumber('if(true, 1)', {})).toThrow(/tham số/);
    expect(() => evaluateNumber('abs(1, 2)', {})).toThrow(/tham số/);
  });

  it('điều kiện if() không phải boolean → throw', () => {
    expect(() => evaluateNumber('if(width, 1, 2)', { width: 5 })).toThrow(/boolean/);
  });

  it('dùng "=" thay vì "==" → thông báo hướng dẫn', () => {
    expect(() => evaluate('door = 2', { door: 2 })).toThrow(/==/);
  });

  it('evaluateNumber trên condition (boolean) → throw', () => {
    expect(() => evaluateNumber('door == 2', { door: 2 })).toThrow(/số hợp lệ/);
  });

  it('evaluateBoolean trên công thức số → throw', () => {
    expect(() => evaluateBoolean('width * 2', { width: 1 })).toThrow(/boolean/);
  });

  it('biểu thức rỗng → throw', () => {
    expect(() => evaluateNumber('', {})).toThrow(/rỗng/);
    expect(() => evaluateNumber('   ', {})).toThrow(/rỗng/);
  });

  it('KHÔNG thực thi code JS tùy ý (an toàn hơn new Function)', () => {
    expect(() => evaluate('process.exit(1)', {})).toThrow(ExpressionError);
    expect(() => evaluate('constructor.constructor("return 1")()', {})).toThrow(ExpressionError);
    expect(() => evaluate('width > 2000 ? 6 : 4', { width: 1 })).toThrow(ExpressionError); // ternary JS không hỗ trợ — dùng if()
  });
});

describe('validate() — kiểm tra cú pháp cho UI', () => {
  it('expression hợp lệ → valid + danh sách biến', () => {
    const result = validate('if(socanh == 2, chieurong * 2, chieurong)');
    expect(result.valid).toBe(true);
    expect(result.variables.sort()).toEqual(['chieurong', 'socanh']);
  });

  it('expression sai → valid=false + thông báo lỗi', () => {
    const result = validate('chieurong *');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('không tính tên hàm là biến', () => {
    const result = validate('ceil(x, 0.5) + min(y, 3)');
    expect(result.valid).toBe(true);
    expect(result.variables.sort()).toEqual(['x', 'y']);
  });
});
