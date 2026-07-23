import { invalidCharacterError, syntaxError } from "./errors.js";

/** Minimal element surface the token list needs. */
export interface ClassListOwner {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

const ASCII_WS = /[ \t\n\f\r]+/;

function validateToken(token: string): void {
  if (token === "") {
    throw syntaxError("The token provided must not be empty.");
  }
  if (/[ \t\n\f\r]/.test(token)) {
    throw invalidCharacterError(
      "The token provided contains HTML space characters.",
    );
  }
}

/**
 * `DOMTokenList` implementation backing `element.classList`. It never caches
 * state: every read parses the `class` attribute and every write serializes
 * back, so it stays perfectly synchronized with the attribute.
 */
export class DOMTokenList implements Iterable<string> {
  constructor(
    private readonly owner: ClassListOwner,
    private readonly attrName: string = "class",
  ) {}

  private tokens(): string[] {
    const raw = this.owner.getAttribute(this.attrName);
    if (!raw) return [];
    const set: string[] = [];
    for (const t of raw.split(ASCII_WS)) {
      if (t !== "" && !set.includes(t)) set.push(t);
    }
    return set;
  }

  private write(tokens: string[]): void {
    this.owner.setAttribute(this.attrName, tokens.join(" "));
  }

  get length(): number {
    return this.tokens().length;
  }

  get value(): string {
    return this.owner.getAttribute(this.attrName) ?? "";
  }
  set value(v: string) {
    this.owner.setAttribute(this.attrName, v);
  }

  item(index: number): string | null {
    return this.tokens()[index] ?? null;
  }

  contains(token: string): boolean {
    return this.tokens().includes(token);
  }

  add(...tokens: string[]): void {
    tokens.forEach(validateToken);
    const set = this.tokens();
    for (const t of tokens) if (!set.includes(t)) set.push(t);
    this.write(set);
  }

  remove(...tokens: string[]): void {
    tokens.forEach(validateToken);
    const set = this.tokens().filter((t) => !tokens.includes(t));
    this.write(set);
  }

  toggle(token: string, force?: boolean): boolean {
    validateToken(token);
    const set = this.tokens();
    const has = set.includes(token);
    if (has) {
      if (force === true) return true;
      this.write(set.filter((t) => t !== token));
      return false;
    }
    if (force === false) return false;
    set.push(token);
    this.write(set);
    return true;
  }

  replace(oldToken: string, newToken: string): boolean {
    validateToken(oldToken);
    validateToken(newToken);
    const set = this.tokens();
    const idx = set.indexOf(oldToken);
    if (idx === -1) return false;
    if (!set.includes(newToken)) {
      set[idx] = newToken;
    } else {
      set.splice(idx, 1);
    }
    this.write(set);
    return true;
  }

  toString(): string {
    return this.value;
  }

  *[Symbol.iterator](): IterableIterator<string> {
    yield* this.tokens();
  }
}
