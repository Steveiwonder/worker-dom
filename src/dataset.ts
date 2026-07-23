import { syntaxError } from "./errors.js";

/** Minimal element surface the dataset needs. */
export interface DatasetOwner {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttributeNames(): string[];
}

export type DOMStringMap = Record<string, string>;

/** `data-foo-bar` -> `fooBar`; returns null when it is not a data attribute. */
function attrToProp(attr: string): string | null {
  if (!attr.startsWith("data-")) return null;
  const rest = attr.slice(5);
  // A dash followed by an ASCII uppercase letter is not representable.
  if (/-[A-Z]/.test(rest)) return null;
  return rest.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/** `fooBar` -> `data-foo-bar`, validating per the DOM rules. */
function propToAttr(prop: string): string {
  if (/-[a-z]/.test(prop)) {
    throw syntaxError(
      `The property name '${prop}' is not a valid dataset name.`,
    );
  }
  const name =
    "data-" + prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  return name;
}

/**
 * Build an `element.dataset` proxy. Every access reads/writes the underlying
 * `data-*` attributes so the two stay synchronized.
 */
export function createDataset(owner: DatasetOwner): DOMStringMap {
  return new Proxy(Object.create(null) as DOMStringMap, {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      const v = owner.getAttribute(propToAttr(prop));
      return v === null ? undefined : v;
    },
    set(_t, prop, value) {
      if (typeof prop !== "string") return false;
      owner.setAttribute(propToAttr(prop), String(value));
      return true;
    },
    has(_t, prop) {
      if (typeof prop !== "string") return false;
      return owner.getAttribute(propToAttr(prop)) !== null;
    },
    deleteProperty(_t, prop) {
      if (typeof prop !== "string") return false;
      owner.removeAttribute(propToAttr(prop));
      return true;
    },
    ownKeys() {
      const keys: string[] = [];
      for (const name of owner.getAttributeNames()) {
        const prop = attrToProp(name);
        if (prop !== null) keys.push(prop);
      }
      return keys;
    },
    getOwnPropertyDescriptor(_t, prop) {
      if (typeof prop !== "string") return undefined;
      const v = owner.getAttribute(propToAttr(prop));
      if (v === null) return undefined;
      return {
        value: v,
        writable: true,
        enumerable: true,
        configurable: true,
      };
    },
  });
}
