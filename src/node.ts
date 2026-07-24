import {
  DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE,
  DOCUMENT_TYPE_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
} from "./constants.js";
import { hierarchyRequestError, notFoundError } from "./errors.js";
import { createNodeList, type NodeListLike } from "./collections.js";

// Forward type-only references to avoid runtime circular imports.
import type { VDocument } from "./document.js";
import type { VElement } from "./element.js";

export interface VEventLike {
  readonly type: string;
  target?: unknown;
  currentTarget?: unknown;
  defaultPrevented?: boolean;
  cancelBubble?: boolean;
  preventDefault?(): void;
  stopPropagation?(): void;
}

export type VEventListener =
  | ((event: VEventLike) => void)
  | { handleEvent(event: VEventLike): void };

/**
 * Base class for every node in the tree. Concrete node types
 * ({@link VElement}, {@link VText}, …) extend this class.
 *
 * Sibling relationships are derived from the parent's child array rather than
 * stored as redundant pointers, matching the performance guidance in the spec.
 */
export abstract class VNode {
  static readonly ELEMENT_NODE = 1;
  static readonly ATTRIBUTE_NODE = 2;
  static readonly TEXT_NODE = 3;
  static readonly CDATA_SECTION_NODE = 4;
  static readonly ENTITY_REFERENCE_NODE = 5;
  static readonly ENTITY_NODE = 6;
  static readonly PROCESSING_INSTRUCTION_NODE = 7;
  static readonly COMMENT_NODE = 8;
  static readonly DOCUMENT_NODE = 9;
  static readonly DOCUMENT_TYPE_NODE = 10;
  static readonly DOCUMENT_FRAGMENT_NODE = 11;
  static readonly NOTATION_NODE = 12;

  /** DOM-compatible numeric node type. */
  abstract readonly nodeType: number;

  /** DOM node name (e.g. `"#text"`, `"DIV"`). */
  abstract get nodeName(): string;

  /** @internal Raw child array. Prefer {@link childNodes} externally. */
  _childNodes: VNode[] = [];
  /** @internal */
  _parentNode: VNode | null = null;
  /** @internal */
  _ownerDocument: VDocument | null = null;
  private _eventListeners?: Map<string, Set<VEventListener>>;

  // --- Ownership -----------------------------------------------------------

  get ownerDocument(): VDocument | null {
    return this._ownerDocument;
  }

  /** @internal The document to use when creating helper nodes. */
  _nodeDocument(): VDocument {
    if (this.nodeType === DOCUMENT_NODE) return this as unknown as VDocument;
    if (this._ownerDocument) return this._ownerDocument;
    throw new Error("Node has no owner document");
  }

  // --- Tree accessors ------------------------------------------------------

  get parentNode(): VNode | null {
    return this._parentNode;
  }

  get parentElement(): VElement | null {
    const p = this._parentNode;
    return p && p.nodeType === ELEMENT_NODE ? (p as unknown as VElement) : null;
  }

  get childNodes(): NodeListLike<VNode> {
    return createNodeList(this._childNodes);
  }

  get firstChild(): VNode | null {
    return this._childNodes[0] ?? null;
  }

  get lastChild(): VNode | null {
    return this._childNodes[this._childNodes.length - 1] ?? null;
  }

  get previousSibling(): VNode | null {
    const p = this._parentNode;
    if (!p) return null;
    const i = p._childNodes.indexOf(this);
    return i > 0 ? p._childNodes[i - 1] : null;
  }

  get nextSibling(): VNode | null {
    const p = this._parentNode;
    if (!p) return null;
    const i = p._childNodes.indexOf(this);
    return i >= 0 && i < p._childNodes.length - 1 ? p._childNodes[i + 1] : null;
  }

  get isConnected(): boolean {
    let n: VNode = this;
    while (n._parentNode) n = n._parentNode;
    return n.nodeType === DOCUMENT_NODE;
  }

  hasChildNodes(): boolean {
    return this._childNodes.length > 0;
  }

  // --- Events --------------------------------------------------------------

  addEventListener(
    type: string,
    listener: VEventListener | null,
    _options?: unknown,
  ): void {
    if (!listener) return;
    const listeners =
      this._eventListeners ?? (this._eventListeners = new Map());
    const bucket = listeners.get(type) ?? new Set<VEventListener>();
    bucket.add(listener);
    listeners.set(type, bucket);
  }

  removeEventListener(
    type: string,
    listener: VEventListener | null,
    _options?: unknown,
  ): void {
    if (!listener) return;
    this._eventListeners?.get(type)?.delete(listener);
  }

  dispatchEvent(event: VEventLike): boolean {
    if (!event || typeof event.type !== "string") {
      throw new TypeError("Failed to execute 'dispatchEvent': invalid event.");
    }
    try {
      event.target ??= this;
      event.currentTarget = this;
    } catch {
      // Some third-party event objects expose read-only target properties.
    }
    for (const listener of [...(this._eventListeners?.get(event.type) ?? [])]) {
      if (typeof listener === "function") listener.call(this, event);
      else listener.handleEvent(event);
    }
    return !event.defaultPrevented;
  }

  // --- Values --------------------------------------------------------------

  get nodeValue(): string | null {
    return null;
  }
  set nodeValue(_value: string | null) {
    /* no-op for nodes without a value; overridden by CharacterData */
  }

  get textContent(): string | null {
    // Element / DocumentFragment: concatenate descendant Text data.
    if (
      this.nodeType === ELEMENT_NODE ||
      this.nodeType === DOCUMENT_FRAGMENT_NODE
    ) {
      let out = "";
      const stack: VNode[] = [];
      // Push children in reverse so traversal is left-to-right.
      for (let i = this._childNodes.length - 1; i >= 0; i--) {
        stack.push(this._childNodes[i]);
      }
      while (stack.length) {
        const n = stack.pop() as VNode;
        if (n.nodeType === TEXT_NODE) {
          out += (n as unknown as { data: string }).data;
        } else if (
          n.nodeType === ELEMENT_NODE ||
          n.nodeType === DOCUMENT_FRAGMENT_NODE
        ) {
          for (let i = n._childNodes.length - 1; i >= 0; i--) {
            stack.push(n._childNodes[i]);
          }
        }
      }
      return out;
    }
    return null;
  }

  set textContent(value: string | null) {
    if (
      this.nodeType === ELEMENT_NODE ||
      this.nodeType === DOCUMENT_FRAGMENT_NODE
    ) {
      this._removeAllChildren();
      const str = value ?? "";
      if (str !== "") {
        const text = this._nodeDocument().createTextNode(str);
        this.appendChild(text);
      }
    }
  }

  // --- Mutation ------------------------------------------------------------

  appendChild<T extends VNode>(child: T): T {
    return this.insertBefore(child, null);
  }

  insertBefore<T extends VNode>(node: T, reference: VNode | null): T {
    this._ensurePreInsertionValidity(node, reference);

    if (node.nodeType === DOCUMENT_FRAGMENT_NODE) {
      // Move the fragment's children, not the fragment itself.
      const kids = node._childNodes.slice();
      // Detach children from fragment first.
      node._childNodes.length = 0;
      for (const k of kids) k._parentNode = null;
      const refIndex =
        reference === null
          ? this._childNodes.length
          : this._childNodes.indexOf(reference);
      let insertAt = refIndex;
      for (const k of kids) {
        this._adopt(k);
        k._parentNode = this;
        this._childNodes.splice(insertAt++, 0, k);
      }
      return node;
    }

    // Detach from previous parent, if any.
    if (node._parentNode) {
      node._parentNode._removeChildInternal(node);
    }
    this._adopt(node);
    node._parentNode = this;
    if (reference === null) {
      this._childNodes.push(node);
    } else {
      const idx = this._childNodes.indexOf(reference);
      this._childNodes.splice(idx, 0, node);
    }
    return node;
  }

  removeChild<T extends VNode>(child: T): T {
    if (child._parentNode !== this) {
      throw notFoundError(
        "Failed to execute 'removeChild': The node to be removed is not a child of this node.",
      );
    }
    this._removeChildInternal(child);
    return child;
  }

  replaceChild<T extends VNode>(newChild: VNode, oldChild: T): T {
    if (oldChild._parentNode !== this) {
      throw notFoundError(
        "Failed to execute 'replaceChild': The node to be replaced is not a child of this node.",
      );
    }
    // Validate the incoming node the same way an insertion would.
    this._ensurePreInsertionValidity(newChild, oldChild);
    const refSibling = oldChild.nextSibling === newChild ? null : oldChild.nextSibling;
    this._removeChildInternal(oldChild);
    this.insertBefore(newChild, refSibling);
    return oldChild;
  }

  remove(): void {
    if (this._parentNode) this._parentNode._removeChildInternal(this);
  }

  contains(other: VNode | null): boolean {
    let n = other;
    while (n) {
      if (n === this) return true;
      n = n._parentNode;
    }
    return false;
  }

  // --- Cloning -------------------------------------------------------------

  /** @internal Copy this node without its children. */
  abstract _shallowClone(): VNode;

  cloneNode(deep = false): VNode {
    const clone = this._shallowClone();
    if (!deep) return clone;

    const docForClone: VDocument | null =
      clone.nodeType === DOCUMENT_NODE
        ? (clone as unknown as VDocument)
        : clone._ownerDocument;

    const stack: Array<[VNode, VNode]> = [[this, clone]];
    while (stack.length) {
      const [src, dst] = stack.pop() as [VNode, VNode];
      const kids = src._childNodes;
      for (let i = 0; i < kids.length; i++) {
        const childClone = kids[i]._shallowClone();
        childClone._parentNode = dst;
        childClone._ownerDocument = docForClone;
        dst._childNodes.push(childClone);
        stack.push([kids[i], childClone]);
      }
    }
    return clone;
  }

  // --- Modern convenience methods -----------------------------------------

  before(...nodes: Array<VNode | string>): void {
    const parent = this._parentNode;
    if (!parent) return;
    const node = this._convertNodesIntoNode(nodes);
    parent.insertBefore(node, this);
  }

  after(...nodes: Array<VNode | string>): void {
    const parent = this._parentNode;
    if (!parent) return;
    const node = this._convertNodesIntoNode(nodes);
    parent.insertBefore(node, this.nextSibling);
  }

  replaceWith(...nodes: Array<VNode | string>): void {
    const parent = this._parentNode;
    if (!parent) return;
    const next = this.nextSibling;
    const node = this._convertNodesIntoNode(nodes);
    // Remove self first so a self-reference in `nodes` is a no-op edge case.
    parent._removeChildInternal(this);
    parent.insertBefore(node, next);
  }

  append(...nodes: Array<VNode | string>): void {
    this.appendChild(this._convertNodesIntoNode(nodes));
  }

  prepend(...nodes: Array<VNode | string>): void {
    this.insertBefore(this._convertNodesIntoNode(nodes), this.firstChild);
  }

  replaceChildren(...nodes: Array<VNode | string>): void {
    this._removeAllChildren();
    this.appendChild(this._convertNodesIntoNode(nodes));
  }

  // --- Internal helpers ----------------------------------------------------

  /** @internal */
  _removeChildInternal(child: VNode): void {
    const idx = this._childNodes.indexOf(child);
    if (idx === -1) return;
    this._childNodes.splice(idx, 1);
    child._parentNode = null;
  }

  /**
   * @internal Fast, unchecked append used by trusted callers (the parser).
   * Skips validation and adoption; the caller guarantees `child` was created
   * by the same document and has no parent.
   */
  _appendChildFast(child: VNode): void {
    child._parentNode = this;
    this._childNodes.push(child);
  }

  /** @internal */
  _removeAllChildren(): void {
    for (const c of this._childNodes) c._parentNode = null;
    this._childNodes.length = 0;
  }

  /**
   * @internal Adopt a node (and its subtree) into this node's document.
   * Matches the DOM behavior where insertion auto-adopts foreign nodes.
   */
  _adopt(node: VNode): void {
    const doc = this.nodeType === DOCUMENT_NODE
      ? (this as unknown as VDocument)
      : this._ownerDocument;
    if (!doc || node._ownerDocument === doc) return;
    const stack: VNode[] = [node];
    while (stack.length) {
      const n = stack.pop() as VNode;
      n._ownerDocument = doc;
      for (let i = 0; i < n._childNodes.length; i++) stack.push(n._childNodes[i]);
    }
  }

  /** @internal Turn a node/string list into a single node or fragment. */
  _convertNodesIntoNode(nodes: Array<VNode | string>): VNode {
    const doc = this._nodeDocument();
    if (nodes.length === 1) {
      const n = nodes[0];
      return typeof n === "string" ? doc.createTextNode(n) : n;
    }
    const frag = doc.createDocumentFragment();
    for (const n of nodes) {
      frag.appendChild(typeof n === "string" ? doc.createTextNode(n) : n);
    }
    return frag;
  }

  /** @internal Validate a pre-insertion, throwing DOM-style errors. */
  _ensurePreInsertionValidity(node: VNode, child: VNode | null): void {
    // Only Document, DocumentFragment and Element may be parents.
    if (
      this.nodeType !== ELEMENT_NODE &&
      this.nodeType !== DOCUMENT_NODE &&
      this.nodeType !== DOCUMENT_FRAGMENT_NODE
    ) {
      throw hierarchyRequestError(
        `Nodes of type '${this.nodeName}' may not have children.`,
      );
    }

    // A node cannot be its own (inclusive) descendant's ancestor: inserting
    // `node` where it is an inclusive ancestor of `this` would create a cycle.
    let p: VNode | null = this;
    while (p) {
      if (p === node) {
        throw hierarchyRequestError(
          "The new child element contains the parent.",
        );
      }
      p = p._parentNode;
    }

    // Reference child must actually be a child of this node.
    if (child !== null && child._parentNode !== this) {
      throw notFoundError(
        "The node before which the new node is to be inserted is not a child of this node.",
      );
    }

    // Document / DocumentType may not be inserted as children of arbitrary
    // nodes; Text may not be a child of a Document.
    if (node.nodeType === DOCUMENT_NODE) {
      throw hierarchyRequestError("A Document may not be inserted.");
    }
    if (this.nodeType === DOCUMENT_NODE) {
      if (node.nodeType === TEXT_NODE) {
        throw hierarchyRequestError(
          "Text nodes may not be children of a Document.",
        );
      }
    } else if (node.nodeType === DOCUMENT_TYPE_NODE) {
      throw hierarchyRequestError(
        "A DocumentType may only be a child of a Document.",
      );
    }
  }
}
