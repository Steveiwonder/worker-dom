/**
 * A small, dependency-free stand-in for the browser `DOMException`.
 *
 * The real `DOMException` is not guaranteed to exist inside every Web Worker
 * environment (and constructing one with a stable `name` differs across
 * engines), so the library throws this class instead. It carries the same
 * `name`/`message`/`code` shape that DOM consumers expect.
 */
export type DOMExceptionName =
  | "HierarchyRequestError"
  | "NotFoundError"
  | "InvalidCharacterError"
  | "NamespaceError"
  | "SyntaxError"
  | "WrongDocumentError"
  | "InvalidStateError"
  | "NotSupportedError";

/** Legacy numeric codes matching the DOM spec, keyed by exception name. */
const LEGACY_CODES: Record<string, number> = {
  HierarchyRequestError: 3,
  WrongDocumentError: 4,
  InvalidCharacterError: 5,
  NotFoundError: 8,
  NotSupportedError: 9,
  InvalidStateError: 11,
  SyntaxError: 12,
  NamespaceError: 14,
};

export class DOMException extends Error {
  /** Legacy numeric code, or 0 when the name has no legacy code. */
  readonly code: number;

  constructor(message: string, name: DOMExceptionName = "InvalidStateError") {
    super(message);
    this.name = name;
    this.code = LEGACY_CODES[name] ?? 0;
    // Restore prototype chain when compiled down to ES5-ish targets.
    Object.setPrototypeOf(this, DOMException.prototype);
  }
}

export function hierarchyRequestError(message: string): DOMException {
  return new DOMException(message, "HierarchyRequestError");
}

export function notFoundError(message: string): DOMException {
  return new DOMException(message, "NotFoundError");
}

export function invalidCharacterError(message: string): DOMException {
  return new DOMException(message, "InvalidCharacterError");
}

export function namespaceError(message: string): DOMException {
  return new DOMException(message, "NamespaceError");
}

export function syntaxError(message: string): DOMException {
  return new DOMException(message, "SyntaxError");
}

export function notSupportedError(message: string): DOMException {
  return new DOMException(message, "NotSupportedError");
}
