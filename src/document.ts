import {
  DOCUMENT_NODE,
  DOCUMENT_TYPE_NODE,
  ELEMENT_NODE,
  HTML_NS,
} from "./constants.js";
import { VNode } from "./node.js";
import { VElement } from "./element.js";
import { VText } from "./text.js";
import { VComment } from "./comment.js";
import { VDocumentFragment } from "./document-fragment.js";
import { VDocumentType } from "./document-type.js";
import { validateAndExtract, validateName } from "./attributes.js";
import { notSupportedError } from "./errors.js";
import {
  querySelector as qs,
  querySelectorAll as qsa,
} from "./selectors/index.js";
import { createNodeList } from "./collections.js";

export type DocumentMode = "html" | "xml";

export interface CreateDocumentOptions {
  /**
   * `"html"` (default) creates a document pre-populated with
   * `<html><head></head><body></body></html>` and a `<!DOCTYPE html>`, and
   * treats element/attribute names case-insensitively.
   *
   * `"xml"` creates an empty document with no auto-generated elements and
   * preserves case.
   */
  mode?: DocumentMode;
}

export class VDocument extends VNode {
  readonly nodeType = DOCUMENT_NODE;
  readonly mode: DocumentMode;
  /** @internal True in HTML mode: names are case-insensitive. */
  readonly _html: boolean;
  defaultView: Record<string, unknown> | null = null;
  readonly implementation = {
    hasFeature: (_feature?: string, _version?: string): boolean => true,
  };

  constructor(mode: DocumentMode = "html") {
    super();
    this.mode = mode;
    this._html = mode === "html";
    this._ownerDocument = null;
  }

  get nodeName(): string {
    return "#document";
  }

  // --- Factories -----------------------------------------------------------

  createElement(tagName: string): VElement {
    validateName(tagName);
    if (this._html) {
      const el = new VElement(HTML_NS, null, tagName.toLowerCase());
      el._ownerDocument = this;
      return el;
    }
    const el = new VElement(null, null, tagName);
    el._ownerDocument = this;
    return el;
  }

  createElementNS(
    namespaceURI: string | null,
    qualifiedName: string,
  ): VElement {
    const { namespace, prefix, localName } = validateAndExtract(
      namespaceURI,
      qualifiedName,
    );
    const el = new VElement(namespace, prefix, localName);
    el._ownerDocument = this;
    return el;
  }

  createTextNode(data: string): VText {
    const t = new VText(String(data));
    t._ownerDocument = this;
    return t;
  }

  createComment(data: string): VComment {
    const c = new VComment(String(data));
    c._ownerDocument = this;
    return c;
  }

  createDocumentFragment(): VDocumentFragment {
    const f = new VDocumentFragment();
    f._ownerDocument = this;
    return f;
  }

  createDocumentType(
    name: string,
    publicId = "",
    systemId = "",
  ): VDocumentType {
    const dt = new VDocumentType(name, publicId, systemId);
    dt._ownerDocument = this;
    return dt;
  }

  // --- Import / adopt ------------------------------------------------------

  importNode<T extends VNode>(node: T, deep = false): T {
    if (node.nodeType === DOCUMENT_NODE) {
      throw notSupportedError("Cannot import a Document node.");
    }
    const clone = node.cloneNode(deep) as T;
    // Re-own the freshly cloned subtree by this document.
    const stack: VNode[] = [clone];
    while (stack.length) {
      const n = stack.pop() as VNode;
      n._ownerDocument = this;
      for (const c of n._childNodes) stack.push(c);
    }
    return clone;
  }

  adoptNode<T extends VNode>(node: T): T {
    if (node.nodeType === DOCUMENT_NODE) {
      throw notSupportedError("Cannot adopt a Document node.");
    }
    if (node._parentNode) node._parentNode._removeChildInternal(node);
    const stack: VNode[] = [node];
    while (stack.length) {
      const n = stack.pop() as VNode;
      n._ownerDocument = this;
      for (const c of n._childNodes) stack.push(c);
    }
    return node;
  }

  // --- Tree accessors ------------------------------------------------------

  /**
   * The root element (`<html>` in a default HTML document).
   *
   * Typed non-null to match the native DOM lib and keep everyday HTML-mode code
   * ergonomic (`document.documentElement.outerHTML`). In `xml` mode an empty
   * document has no root element and this returns `null` at runtime — guard
   * accordingly when using XML documents.
   */
  get documentElement(): VElement {
    for (const c of this._childNodes) {
      if (c.nodeType === ELEMENT_NODE) return c as VElement;
    }
    return null as unknown as VElement;
  }

  get doctype(): VDocumentType | null {
    for (const c of this._childNodes) {
      if (c.nodeType === DOCUMENT_TYPE_NODE) return c as VDocumentType;
    }
    return null;
  }

  /** The `<head>` element. Non-null in HTML mode; `null` at runtime in XML mode. */
  get head(): VElement {
    return this._firstHtmlChild(this.documentElement, "head") as VElement;
  }

  /** The `<body>` element. Non-null in HTML mode; `null` at runtime in XML mode. */
  get body(): VElement {
    const root = this.documentElement;
    return (this._firstHtmlChild(root, "body") ??
      this._firstHtmlChild(root, "frameset")) as VElement;
  }

  private _firstHtmlChild(
    parent: VElement | null,
    localName: string,
  ): VElement | null {
    if (!parent) return null;
    for (const c of parent._childNodes) {
      if (
        c.nodeType === ELEMENT_NODE &&
        (c as VElement).localName === localName
      ) {
        return c as VElement;
      }
    }
    return null;
  }

  getElementById(id: string): VElement | null {
    const stack: VNode[] = [...this._childNodes].reverse();
    while (stack.length) {
      const n = stack.pop() as VNode;
      if (n.nodeType === ELEMENT_NODE && (n as VElement).id === id) {
        return n as VElement;
      }
      for (let i = n._childNodes.length - 1; i >= 0; i--) {
        stack.push(n._childNodes[i]);
      }
    }
    return null;
  }

  querySelector(selector: string): VElement | null {
    return qs(this, selector);
  }

  querySelectorAll(selector: string) {
    return qsa(this, selector);
  }

  getElementsByTagName(qualifiedName: string) {
    return qsa(this, qualifiedName === "*" ? "*" : qualifiedName);
  }

  getElementsByTagNameNS(namespace: string | null, localName: string) {
    const root = this.documentElement;
    if (!root) return createNodeList<VElement>([]);
    const matches: VElement[] = [];
    if (
      (namespace === "*" || root.namespaceURI === namespace) &&
      (localName === "*" || root.localName === localName)
    ) {
      matches.push(root);
    }
    for (const element of root.getElementsByTagNameNS(namespace, localName)) {
      matches.push(element);
    }
    return createNodeList(matches);
  }

  getElementsByClassName(classNames: string) {
    const selector = classNames
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => `.${name}`)
      .join("");
    return selector ? qsa(this, selector) : createNodeList<VElement>([]);
  }

  // --- Cloning -------------------------------------------------------------

  _shallowClone(): VNode {
    const clone = new VDocument(this.mode);
    return clone;
  }
}

/**
 * Create a new, isolated document.
 *
 * @example
 * const document = createDocument();
 * const div = document.createElement("div");
 */
export function createDocument(options: CreateDocumentOptions = {}): VDocument {
  const mode = options.mode ?? "html";
  const doc = new VDocument(mode);

  if (mode === "html") {
    const doctype = doc.createDocumentType("html");
    doc.appendChild(doctype);
    const html = doc.createElement("html");
    const head = doc.createElement("head");
    const body = doc.createElement("body");
    html.appendChild(head);
    html.appendChild(body);
    doc.appendChild(html);
  }

  return doc;
}
