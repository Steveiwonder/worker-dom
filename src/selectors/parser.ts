import { syntaxError } from "../errors.js";

export type Combinator = " " | ">" | "+" | "~";

export interface NthArg {
  a: number;
  b: number;
}

export type Condition =
  | { kind: "universal" }
  | { kind: "type"; name: string }
  | { kind: "id"; id: string }
  | { kind: "class"; name: string }
  | {
      kind: "attr";
      name: string;
      op?: "=" | "~=" | "|=" | "^=" | "$=" | "*=";
      value?: string;
      caseInsensitive?: boolean;
    }
  | { kind: "pseudo"; name: string; selectors?: SelectorList; nth?: NthArg };

export interface Compound {
  conditions: Condition[];
}

export interface ComplexPart {
  /** Combinator joining this compound to the previous one (null for first). */
  combinator: Combinator | null;
  compound: Compound;
}

export type ComplexSelector = ComplexPart[];
export type SelectorList = ComplexSelector[];

const IDENT = /[-\w\u00A0-\uFFFF]/;

/** A small recursive-descent parser for the supported selector grammar. */
class SelectorParser {
  private i = 0;
  constructor(private readonly src: string) {}

  parse(): SelectorList {
    const list = this.parseSelectorList();
    this.ws();
    if (this.i < this.src.length) {
      throw syntaxError(`Unexpected token in selector: '${this.src}'`);
    }
    return list;
  }

  private ws(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  private peek(): string {
    return this.src[this.i];
  }

  private parseSelectorList(): SelectorList {
    const list: SelectorList = [this.parseComplex()];
    this.ws();
    while (this.peek() === ",") {
      this.i++;
      this.ws();
      list.push(this.parseComplex());
      this.ws();
    }
    return list;
  }

  private parseComplex(): ComplexSelector {
    const parts: ComplexPart[] = [];
    this.ws();
    parts.push({ combinator: null, compound: this.parseCompound() });
    for (;;) {
      const combinator = this.parseCombinator();
      if (combinator === null) break;
      parts.push({ combinator, compound: this.parseCompound() });
    }
    return parts;
  }

  private parseCombinator(): Combinator | null {
    const before = this.i;
    let sawSpace = false;
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) {
      this.i++;
      sawSpace = true;
    }
    const c = this.peek();
    if (c === ">" || c === "+" || c === "~") {
      this.i++;
      this.ws();
      return c;
    }
    if (sawSpace && this.i < this.src.length && c !== "," && c !== ")") {
      return " ";
    }
    this.i = before;
    return null;
  }

  private parseCompound(): Compound {
    const conditions: Condition[] = [];
    for (;;) {
      const c = this.peek();
      if (c === undefined) break;
      if (c === "*") {
        this.i++;
        conditions.push({ kind: "universal" });
      } else if (c === "#") {
        this.i++;
        conditions.push({ kind: "id", id: this.readIdent() });
      } else if (c === ".") {
        this.i++;
        conditions.push({ kind: "class", name: this.readIdent() });
      } else if (c === "[") {
        conditions.push(this.parseAttribute());
      } else if (c === ":") {
        conditions.push(this.parsePseudo());
      } else if (IDENT.test(c) || c === "|") {
        conditions.push({ kind: "type", name: this.readTypeName() });
      } else {
        break;
      }
    }
    if (conditions.length === 0) {
      throw syntaxError(`Empty compound selector in '${this.src}'`);
    }
    return { conditions };
  }

  private readIdent(): string {
    const start = this.i;
    while (this.i < this.src.length && IDENT.test(this.src[this.i])) this.i++;
    if (this.i === start) {
      throw syntaxError(`Expected identifier in '${this.src}'`);
    }
    return this.src.slice(start, this.i);
  }

  private readTypeName(): string {
    // Supports optional namespace prefix: ns|tag, *|tag, |tag.
    const start = this.i;
    while (
      this.i < this.src.length &&
      (IDENT.test(this.src[this.i]) ||
        this.src[this.i] === "|" ||
        this.src[this.i] === "*")
    ) {
      this.i++;
    }
    const raw = this.src.slice(start, this.i);
    const bar = raw.indexOf("|");
    return bar === -1 ? raw : raw.slice(bar + 1);
  }

  private parseAttribute(): Condition {
    this.i++; // [
    this.ws();
    const name = this.readAttrName();
    this.ws();
    const c = this.peek();
    if (c === "]") {
      this.i++;
      return { kind: "attr", name };
    }
    let op: string | undefined;
    if (c === "=") {
      op = "=";
      this.i++;
    } else if ("~|^$*".includes(c) && this.src[this.i + 1] === "=") {
      op = c + "=";
      this.i += 2;
    } else {
      throw syntaxError(`Invalid attribute operator in '${this.src}'`);
    }
    this.ws();
    const value = this.readAttrValue();
    this.ws();
    let caseInsensitive = false;
    const flag = this.peek();
    if (flag === "i" || flag === "I") {
      caseInsensitive = true;
      this.i++;
      this.ws();
    } else if (flag === "s" || flag === "S") {
      this.i++;
      this.ws();
    }
    if (this.peek() !== "]") {
      throw syntaxError(`Unterminated attribute selector in '${this.src}'`);
    }
    this.i++;
    return {
      kind: "attr",
      name,
      op: op as "=" | "~=" | "|=" | "^=" | "$=" | "*=",
      value,
      caseInsensitive,
    };
  }

  private readAttrName(): string {
    const start = this.i;
    while (this.i < this.src.length) {
      const ch = this.src[this.i];
      // A `|` that is followed by `=` is the `|=` operator, not a namespace
      // separator, so stop before consuming it.
      if (ch === "|" && this.src[this.i + 1] === "=") break;
      if (IDENT.test(ch) || ch === "|" || ch === ":") {
        this.i++;
        continue;
      }
      break;
    }
    const raw = this.src.slice(start, this.i);
    if (raw === "") throw syntaxError(`Expected attribute name in '${this.src}'`);
    return raw;
  }

  private readAttrValue(): string {
    const q = this.peek();
    if (q === '"' || q === "'") {
      this.i++;
      const start = this.i;
      while (this.i < this.src.length && this.src[this.i] !== q) this.i++;
      const v = this.src.slice(start, this.i);
      this.i++; // closing quote
      return v;
    }
    const start = this.i;
    while (
      this.i < this.src.length &&
      !/\s/.test(this.src[this.i]) &&
      this.src[this.i] !== "]"
    ) {
      this.i++;
    }
    return this.src.slice(start, this.i);
  }

  private parsePseudo(): Condition {
    this.i++; // :
    if (this.peek() === ":") this.i++; // treat ::x like :x (no pseudo-elements)
    const name = this.readIdent().toLowerCase();
    if (this.peek() === "(") {
      this.i++;
      this.ws();
      if (name === "nth-child" || name === "nth-last-child") {
        const nth = this.parseNth();
        this.ws();
        if (this.peek() !== ")") {
          throw syntaxError(`Unterminated :${name}() in '${this.src}'`);
        }
        this.i++;
        return { kind: "pseudo", name, nth };
      }
      // :not / :is / :where take a selector list.
      const inner = this.parseSelectorList();
      this.ws();
      if (this.peek() !== ")") {
        throw syntaxError(`Unterminated :${name}() in '${this.src}'`);
      }
      this.i++;
      return { kind: "pseudo", name, selectors: inner };
    }
    return { kind: "pseudo", name };
  }

  private parseNth(): NthArg {
    const start = this.i;
    while (this.i < this.src.length && this.src[this.i] !== ")") this.i++;
    const raw = this.src.slice(start, this.i).trim().toLowerCase();
    return parseNthExpression(raw);
  }
}

export function parseNthExpression(raw: string): NthArg {
  if (raw === "odd") return { a: 2, b: 1 };
  if (raw === "even") return { a: 2, b: 0 };
  const m = raw.replace(/\s+/g, "").match(/^([+-]?\d*)n([+-]\d+)?$/);
  if (m) {
    let a = m[1];
    if (a === "" || a === "+") a = "1";
    else if (a === "-") a = "-1";
    return { a: parseInt(a, 10), b: m[2] ? parseInt(m[2], 10) : 0 };
  }
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n)) return { a: 0, b: n };
  throw syntaxError(`Invalid nth expression: '${raw}'`);
}

const cache = new Map<string, SelectorList>();

export function parseSelector(selector: string): SelectorList {
  const cached = cache.get(selector);
  if (cached) return cached;
  const parsed = new SelectorParser(selector).parse();
  cache.set(selector, parsed);
  return parsed;
}
