/**
 * ExpressionEvaluator — ngôn ngữ expression dùng chung toàn ERP.
 *
 * Dùng cho: công thức giá, công thức định mức vật tư, condition trên rule/dòng BOM,
 * validation rule, derived parameter. Grammar này là hợp đồng cố định: sau khi có
 * expression lưu trong DB, chỉ được MỞ RỘNG (thêm hàm), không được đổi ngữ nghĩa.
 * Bộ test evaluator.spec.ts là đặc tả chính thức của grammar.
 *
 * - Kiểu: number, string ('...' hoặc "..."), boolean (true/false).
 * - Toán tử (ưu tiên thấp → cao): || , && , == != , > < >= <= , + - , * / % , ! -(đơn).
 * - Hàm: if(cond, a, b), ceil(x[,step]), floor(x[,step]), round(x[,step]),
 *   min(...), max(...), abs(x).
 * - Không truthiness: && || ! chỉ nhận boolean; so sánh <> chỉ nhận number;
 *   == != yêu cầu hai vế cùng kiểu.
 * - Biến không có trong context → lỗi (không trả 0 âm thầm).
 */

export type ExpressionValue = number | string | boolean;
export type ExpressionContext = Record<string, ExpressionValue>;

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
  }
}

// ──────────────────────────────────────
// Tokenizer
// ──────────────────────────────────────

type TokenType =
  'number' | 'string' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const TWO_CHAR_OPS = ['||', '&&', '==', '!=', '>=', '<='];
const ONE_CHAR_OPS = ['>', '<', '+', '-', '*', '/', '%', '!'];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Số: 123, 1.5, .5
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const raw = input.slice(i, j);
      if ((raw.match(/\./g) ?? []).length > 1) {
        throw new ExpressionError(
          `Số không hợp lệ "${raw}" tại vị trí ${i + 1}.`,
        );
      }
      tokens.push({ type: 'number', value: raw, pos: i });
      i = j;
      continue;
    }

    // Chuỗi: '...' hoặc "..."
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < input.length && input[j] !== quote) j++;
      if (j >= input.length) {
        throw new ExpressionError(
          `Chuỗi không được đóng (thiếu ${quote}) tại vị trí ${i + 1}.`,
        );
      }
      tokens.push({ type: 'string', value: input.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }

    // Tên biến / hàm / true / false
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j++;
      tokens.push({ type: 'ident', value: input.slice(i, j), pos: i });
      i = j;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')', pos: i });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',', pos: i });
      i++;
      continue;
    }

    const two = input.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === '=') {
      throw new ExpressionError(`Dùng "==" để so sánh bằng (vị trí ${i + 1}).`);
    }

    throw new ExpressionError(
      `Ký tự không hợp lệ "${ch}" tại vị trí ${i + 1}.`,
    );
  }

  tokens.push({ type: 'eof', value: '', pos: input.length });
  return tokens;
}

// ──────────────────────────────────────
// Parser (recursive descent) → AST
// ──────────────────────────────────────

type AstNode =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: '-' | '!'; operand: AstNode }
  | { kind: 'binary'; op: string; left: AstNode; right: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] };

const FUNCTIONS: Record<string, { minArgs: number; maxArgs: number }> = {
  if: { minArgs: 3, maxArgs: 3 },
  ceil: { minArgs: 1, maxArgs: 2 },
  floor: { minArgs: 1, maxArgs: 2 },
  round: { minArgs: 1, maxArgs: 2 },
  min: { minArgs: 2, maxArgs: Infinity },
  max: { minArgs: 2, maxArgs: Infinity },
  abs: { minArgs: 1, maxArgs: 1 },
};

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const node = this.parseOr();
    const tok = this.peek();
    if (tok.type !== 'eof') {
      throw new ExpressionError(
        `Cú pháp lỗi: không mong đợi "${tok.value}" tại vị trí ${tok.pos + 1}.`,
      );
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private matchOp(...ops: string[]): string | null {
    const tok = this.peek();
    if (tok.type === 'op' && ops.includes(tok.value)) {
      this.next();
      return tok.value;
    }
    return null;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    let op: string | null;
    while ((op = this.matchOp('||'))) {
      left = { kind: 'binary', op, left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseEquality();
    let op: string | null;
    while ((op = this.matchOp('&&'))) {
      left = { kind: 'binary', op, left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): AstNode {
    let left = this.parseRelational();
    let op: string | null;
    while ((op = this.matchOp('==', '!='))) {
      left = { kind: 'binary', op, left, right: this.parseRelational() };
    }
    return left;
  }

  private parseRelational(): AstNode {
    let left = this.parseAdditive();
    let op: string | null;
    while ((op = this.matchOp('>', '<', '>=', '<='))) {
      left = { kind: 'binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    let op: string | null;
    while ((op = this.matchOp('+', '-'))) {
      left = { kind: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary();
    let op: string | null;
    while ((op = this.matchOp('*', '/', '%'))) {
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): AstNode {
    const op = this.matchOp('-', '!');
    if (op) {
      return { kind: 'unary', op: op as '-' | '!', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const tok = this.next();

    if (tok.type === 'number') {
      return { kind: 'num', value: parseFloat(tok.value) };
    }
    if (tok.type === 'string') {
      return { kind: 'str', value: tok.value };
    }
    if (tok.type === 'lparen') {
      const inner = this.parseOr();
      if (this.next().type !== 'rparen') {
        throw new ExpressionError('Thiếu dấu ")" đóng ngoặc.');
      }
      return inner;
    }
    if (tok.type === 'ident') {
      if (tok.value === 'true') return { kind: 'bool', value: true };
      if (tok.value === 'false') return { kind: 'bool', value: false };

      // Gọi hàm
      if (this.peek().type === 'lparen') {
        this.next(); // (
        const fnName = tok.value;
        const spec = FUNCTIONS[fnName];
        if (!spec) {
          throw new ExpressionError(
            `Hàm "${fnName}" không tồn tại. Các hàm hỗ trợ: ${Object.keys(FUNCTIONS).join(', ')}.`,
          );
        }
        const args: AstNode[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseOr());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.parseOr());
          }
        }
        if (this.next().type !== 'rparen') {
          throw new ExpressionError(
            `Thiếu dấu ")" đóng lời gọi hàm ${fnName}().`,
          );
        }
        if (args.length < spec.minArgs || args.length > spec.maxArgs) {
          const expected =
            spec.maxArgs === Infinity
              ? `ít nhất ${spec.minArgs}`
              : spec.minArgs === spec.maxArgs
                ? `${spec.minArgs}`
                : `${spec.minArgs}–${spec.maxArgs}`;
          throw new ExpressionError(
            `Hàm ${fnName}() cần ${expected} tham số, nhận ${args.length}.`,
          );
        }
        return { kind: 'call', name: fnName, args };
      }

      return { kind: 'var', name: tok.value };
    }

    throw new ExpressionError(
      tok.type === 'eof'
        ? 'Biểu thức kết thúc đột ngột (thiếu toán hạng).'
        : `Cú pháp lỗi: không mong đợi "${tok.value}" tại vị trí ${tok.pos + 1}.`,
    );
  }
}

// ──────────────────────────────────────
// Evaluate
// ──────────────────────────────────────

function typeName(v: ExpressionValue): string {
  return typeof v === 'number'
    ? 'số'
    : typeof v === 'string'
      ? 'chuỗi'
      : 'boolean';
}

function asNumber(v: ExpressionValue, where: string): number {
  if (typeof v !== 'number') {
    throw new ExpressionError(`${where} cần giá trị số, nhận ${typeName(v)}.`);
  }
  return v;
}

function asBoolean(v: ExpressionValue, where: string): boolean {
  if (typeof v !== 'boolean') {
    throw new ExpressionError(
      `${where} cần giá trị boolean, nhận ${typeName(v)}.`,
    );
  }
  return v;
}

function stepRound(
  fn: (x: number) => number,
  x: number,
  step: number | undefined,
  name: string,
): number {
  if (step === undefined) return fn(x);
  if (step <= 0)
    throw new ExpressionError(`Bước làm tròn của ${name}() phải lớn hơn 0.`);
  return fn(x / step) * step;
}

function evalNode(node: AstNode, ctx: ExpressionContext): ExpressionValue {
  switch (node.kind) {
    case 'num':
    case 'str':
    case 'bool':
      return node.value;

    case 'var': {
      const v = ctx[node.name];
      if (v === undefined) {
        throw new ExpressionError(
          `Biến "${node.name}" không tồn tại trong ngữ cảnh.`,
        );
      }
      return v;
    }

    case 'unary': {
      const v = evalNode(node.operand, ctx);
      if (node.op === '-') return -asNumber(v, 'Dấu trừ (-)');
      return !asBoolean(v, 'Toán tử "!"');
    }

    case 'binary': {
      const { op } = node;

      if (op === '&&') {
        // Short-circuit
        if (!asBoolean(evalNode(node.left, ctx), 'Toán tử "&&"')) return false;
        return asBoolean(evalNode(node.right, ctx), 'Toán tử "&&"');
      }
      if (op === '||') {
        if (asBoolean(evalNode(node.left, ctx), 'Toán tử "||"')) return true;
        return asBoolean(evalNode(node.right, ctx), 'Toán tử "||"');
      }

      const left = evalNode(node.left, ctx);
      const right = evalNode(node.right, ctx);

      if (op === '==' || op === '!=') {
        if (typeof left !== typeof right) {
          throw new ExpressionError(
            `So sánh "${op}" cần hai vế cùng kiểu (${typeName(left)} với ${typeName(right)}).`,
          );
        }
        return op === '==' ? left === right : left !== right;
      }

      const l = asNumber(left, `Toán tử "${op}"`);
      const r = asNumber(right, `Toán tử "${op}"`);
      switch (op) {
        case '>':
          return l > r;
        case '<':
          return l < r;
        case '>=':
          return l >= r;
        case '<=':
          return l <= r;
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return l / r;
        case '%':
          return l % r;
        default:
          throw new ExpressionError(`Toán tử "${op}" không hỗ trợ.`);
      }
    }

    case 'call': {
      const { name, args } = node;
      if (name === 'if') {
        const cond = asBoolean(evalNode(args[0], ctx), 'Điều kiện của if()');
        return evalNode(cond ? args[1] : args[2], ctx);
      }
      const values = args.map((a, idx) =>
        asNumber(evalNode(a, ctx), `Tham số ${idx + 1} của ${name}()`),
      );
      switch (name) {
        case 'ceil':
          return stepRound(Math.ceil, values[0], values[1], 'ceil');
        case 'floor':
          return stepRound(Math.floor, values[0], values[1], 'floor');
        case 'round':
          return stepRound(Math.round, values[0], values[1], 'round');
        case 'min':
          return Math.min(...values);
        case 'max':
          return Math.max(...values);
        case 'abs':
          return Math.abs(values[0]);
        default:
          throw new ExpressionError(`Hàm "${name}" không tồn tại.`);
      }
    }
  }
}

// ──────────────────────────────────────
// Public API
// ──────────────────────────────────────

const astCache = new Map<string, AstNode>();

function parseCached(expression: string): AstNode {
  const cached = astCache.get(expression);
  if (cached) return cached;
  const ast = new Parser(tokenize(expression)).parse();
  // Chặn cache phình vô hạn khi expression sinh động (thực tế expression là
  // master data, số lượng nhỏ).
  if (astCache.size > 2000) astCache.clear();
  astCache.set(expression, ast);
  return ast;
}

/** Evaluate expression, trả về number | string | boolean. */
export function evaluate(
  expression: string,
  context: ExpressionContext,
): ExpressionValue {
  if (!expression?.trim()) throw new ExpressionError('Biểu thức rỗng.');
  return evalNode(parseCached(expression), context);
}

/** Evaluate expression tính lượng/giá — bắt buộc trả về số hữu hạn. */
export function evaluateNumber(
  expression: string,
  context: ExpressionContext,
): number {
  const result = evaluate(expression, context);
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new ExpressionError('Công thức không trả về số hợp lệ.');
  }
  return result;
}

/** Evaluate condition — bắt buộc trả về boolean. */
export function evaluateBoolean(
  expression: string,
  context: ExpressionContext,
): boolean {
  const result = evaluate(expression, context);
  if (typeof result !== 'boolean') {
    throw new ExpressionError('Điều kiện không trả về đúng/sai (boolean).');
  }
  return result;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Danh sách tên biến expression sử dụng (phục vụ UI kiểm tra khi admin nhập). */
  variables: string[];
}

/** Kiểm tra cú pháp không cần context. */
export function validate(expression: string): ValidationResult {
  try {
    if (!expression?.trim()) throw new ExpressionError('Biểu thức rỗng.');
    const ast = new Parser(tokenize(expression)).parse();
    const variables = new Set<string>();
    collectVariables(ast, variables);
    return { valid: true, variables: Array.from(variables) };
  } catch (e) {
    return { valid: false, error: (e as Error).message, variables: [] };
  }
}

function collectVariables(node: AstNode, out: Set<string>): void {
  switch (node.kind) {
    case 'var':
      out.add(node.name);
      break;
    case 'unary':
      collectVariables(node.operand, out);
      break;
    case 'binary':
      collectVariables(node.left, out);
      collectVariables(node.right, out);
      break;
    case 'call':
      for (const a of node.args) collectVariables(a, out);
      break;
    default:
      break;
  }
}
