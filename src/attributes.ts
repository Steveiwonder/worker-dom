import { XML_NS, XMLNS_NS } from "./constants.js";
import { invalidCharacterError, namespaceError } from "./errors.js";

// --- XML name validation ---------------------------------------------------
// A practical subset of the XML Name / QName productions. Broad enough for
// real-world markup without pulling in a full grammar.
const NAME_START =
  "A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D" +
  "\\u037F-\\u1FFF\\u200C\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF" +
  "\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
const NAME_CHAR = NAME_START + "0-9.\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040";

const NC_NAME = `[${NAME_START}][${NAME_CHAR}]*`;
const NAME_RE = new RegExp(`^[${NAME_START}:][${NAME_CHAR}:]*$`);
const QNAME_RE = new RegExp(`^(${NC_NAME}:)?${NC_NAME}$`);

/** Throw {@link DOMException} `InvalidCharacterError` if `name` is not a Name. */
export function validateName(name: string): void {
  if (name === "" || !NAME_RE.test(name)) {
    throw invalidCharacterError(`The name '${name}' is not a valid name.`);
  }
}

/** Throw if `qname` is not a valid QName. */
export function validateQName(qname: string): void {
  if (qname === "" || !QNAME_RE.test(qname)) {
    throw invalidCharacterError(
      `The qualified name '${qname}' is not a valid qualified name.`,
    );
  }
}

export interface QualifiedNameParts {
  namespace: string | null;
  prefix: string | null;
  localName: string;
}

/**
 * The DOM "validate and extract a namespace and qualified name" algorithm.
 * Splits the qualified name and enforces the namespace/prefix constraints.
 */
export function validateAndExtract(
  namespace: string | null,
  qualifiedName: string,
): QualifiedNameParts {
  const ns = namespace === "" ? null : namespace;
  validateQName(qualifiedName);

  let prefix: string | null = null;
  let localName = qualifiedName;
  const colon = qualifiedName.indexOf(":");
  if (colon !== -1) {
    prefix = qualifiedName.slice(0, colon);
    localName = qualifiedName.slice(colon + 1);
  }

  if (prefix !== null && ns === null) {
    throw namespaceError("A prefix was given but no namespace.");
  }
  if (prefix === "xml" && ns !== XML_NS) {
    throw namespaceError("The 'xml' prefix must use the XML namespace.");
  }
  if (
    (qualifiedName === "xmlns" || prefix === "xmlns") &&
    ns !== XMLNS_NS
  ) {
    throw namespaceError("The 'xmlns' name/prefix must use the xmlns namespace.");
  }
  if (
    ns === XMLNS_NS &&
    qualifiedName !== "xmlns" &&
    prefix !== "xmlns"
  ) {
    throw namespaceError(
      "The xmlns namespace requires the 'xmlns' name or prefix.",
    );
  }

  return { namespace: ns, prefix, localName };
}

// --- Attribute record ------------------------------------------------------

/** Internal storage record for a single attribute. */
export interface AttrRecord {
  namespaceURI: string | null;
  prefix: string | null;
  localName: string;
  /** Qualified name as it should serialize (e.g. `xlink:href`). */
  name: string;
  value: string;
}

/**
 * A DOM `Attr`-like view returned by {@link NamedNodeMapLike}. Read-only
 * snapshot of an attribute at query time.
 */
export interface VAttr {
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;
  readonly name: string;
  readonly value: string;
}

export interface NamedNodeMapLike extends Iterable<VAttr> {
  readonly length: number;
  item(index: number): VAttr | null;
  getNamedItem(name: string): VAttr | null;
  getNamedItemNS(namespace: string | null, localName: string): VAttr | null;
  readonly [index: number]: VAttr;
}

export class StaticNamedNodeMap implements NamedNodeMapLike {
  readonly length: number;
  [index: number]: VAttr;

  constructor(records: readonly AttrRecord[]) {
    this.length = records.length;
    for (let i = 0; i < records.length; i++) {
      this[i] = { ...records[i] };
    }
  }

  item(index: number): VAttr | null {
    return index >= 0 && index < this.length ? this[index] : null;
  }

  getNamedItem(name: string): VAttr | null {
    for (let i = 0; i < this.length; i++) {
      if (this[i].name === name) return this[i];
    }
    return null;
  }

  getNamedItemNS(namespace: string | null, localName: string): VAttr | null {
    const ns = namespace === "" ? null : namespace;
    for (let i = 0; i < this.length; i++) {
      if (this[i].namespaceURI === ns && this[i].localName === localName) {
        return this[i];
      }
    }
    return null;
  }

  *[Symbol.iterator](): IterableIterator<VAttr> {
    for (let i = 0; i < this.length; i++) yield this[i];
  }
}
