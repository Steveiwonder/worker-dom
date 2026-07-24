import { ELEMENT_NODE, HTML_NS, SVG_NS } from "./constants.js";
import { VNode } from "./node.js";
import {
  StaticNamedNodeMap,
  validateAndExtract,
  validateName,
  type AttrRecord,
  type NamedNodeMapLike,
} from "./attributes.js";
import {
  createNodeList,
  type HTMLCollectionLike,
} from "./collections.js";
import { DOMTokenList } from "./class-list.js";
import { createDataset, type DOMStringMap } from "./dataset.js";
import { syntaxError } from "./errors.js";
import { serializeNode, serializeChildren } from "./serializer/index.js";
import { parseFragment } from "./parser/index.js";
import {
  matches as matchesSelector,
  querySelector as qs,
  querySelectorAll as qsa,
  closest as closestSelector,
} from "./selectors/index.js";
import { VCSSStyleDeclaration } from "./style.js";
import {
  VSVGAnimatedLength,
  VSVGAnimatedRect,
  VSVGAnimatedString,
  VSVGAnimatedTransformList,
  VSVGMatrix,
  VSVGTransform,
  type SVGRectLike,
} from "./svg.js";

export type InsertPosition =
  | "beforebegin"
  | "afterbegin"
  | "beforeend"
  | "afterend";

export class VElement extends VNode {
  readonly nodeType = ELEMENT_NODE;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly localName: string;

  /** @internal Ordered attribute records. */
  _attributes: AttrRecord[] = [];

  private _classList?: DOMTokenList;
  private _dataset?: DOMStringMap;
  private _style?: VCSSStyleDeclaration;
  private readonly _animatedProperties = new Map<string, unknown>();

  constructor(
    namespaceURI: string | null,
    prefix: string | null,
    localName: string,
  ) {
    super();
    this.namespaceURI = namespaceURI;
    this.prefix = prefix;
    this.localName = localName;
  }

  // --- Names ---------------------------------------------------------------

  private get _qualifiedName(): string {
    return this.prefix ? `${this.prefix}:${this.localName}` : this.localName;
  }

  /** True when this element behaves as an HTML element (case-insensitive). */
  private _isHtml(): boolean {
    return (
      this.namespaceURI === HTML_NS && !!this._ownerDocument?._html
    );
  }

  get tagName(): string {
    return this._isHtml()
      ? this._qualifiedName.toUpperCase()
      : this._qualifiedName;
  }

  get nodeName(): string {
    return this.tagName;
  }

  /** @internal Lowercase attribute names for HTML elements. */
  private _adjustAttrName(name: string): string {
    return this._isHtml() ? name.toLowerCase() : name;
  }

  // --- Attributes ----------------------------------------------------------

  get attributes(): NamedNodeMapLike {
    return new StaticNamedNodeMap(this._attributes);
  }

  getAttributeNames(): string[] {
    return this._attributes.map((a) => a.name);
  }

  hasAttributes(): boolean {
    return this._attributes.length > 0;
  }

  getAttribute(name: string): string | null {
    const adjusted = this._adjustAttrName(name);
    const rec = this._attributes.find((a) => a.name === adjusted);
    return rec ? rec.value : null;
  }

  getAttributeNS(namespace: string | null, localName: string): string | null {
    const ns = namespace === "" ? null : namespace;
    const rec = this._attributes.find(
      (a) => a.namespaceURI === ns && a.localName === localName,
    );
    return rec ? rec.value : null;
  }

  setAttribute(name: string, value: unknown): void {
    validateName(name);
    const adjusted = this._adjustAttrName(name);
    const str = String(value);
    const rec = this._attributes.find((a) => a.name === adjusted);
    if (rec) {
      rec.value = str;
      return;
    }
    this._attributes.push({
      namespaceURI: null,
      prefix: null,
      localName: adjusted,
      name: adjusted,
      value: str,
    });
  }

  setAttributeNS(
    namespace: string | null,
    qualifiedName: string,
    value: unknown,
  ): void {
    const { namespace: ns, prefix, localName } = validateAndExtract(
      namespace,
      qualifiedName,
    );
    const str = String(value);
    const rec = this._attributes.find(
      (a) => a.namespaceURI === ns && a.localName === localName,
    );
    if (rec) {
      rec.value = str;
      return;
    }
    this._attributes.push({
      namespaceURI: ns,
      prefix,
      localName,
      name: qualifiedName,
      value: str,
    });
  }

  removeAttribute(name: string): void {
    const adjusted = this._adjustAttrName(name);
    const i = this._attributes.findIndex((a) => a.name === adjusted);
    if (i !== -1) this._attributes.splice(i, 1);
  }

  removeAttributeNS(namespace: string | null, localName: string): void {
    const ns = namespace === "" ? null : namespace;
    const i = this._attributes.findIndex(
      (a) => a.namespaceURI === ns && a.localName === localName,
    );
    if (i !== -1) this._attributes.splice(i, 1);
  }

  hasAttribute(name: string): boolean {
    const adjusted = this._adjustAttrName(name);
    return this._attributes.some((a) => a.name === adjusted);
  }

  hasAttributeNS(namespace: string | null, localName: string): boolean {
    const ns = namespace === "" ? null : namespace;
    return this._attributes.some(
      (a) => a.namespaceURI === ns && a.localName === localName,
    );
  }

  toggleAttribute(name: string, force?: boolean): boolean {
    validateName(name);
    const adjusted = this._adjustAttrName(name);
    const exists = this._attributes.some((a) => a.name === adjusted);
    if (!exists) {
      if (force === false) return false;
      this._attributes.push({
        namespaceURI: null,
        prefix: null,
        localName: adjusted,
        name: adjusted,
        value: "",
      });
      return true;
    }
    if (force === true) return true;
    this.removeAttribute(adjusted);
    return false;
  }

  // --- Reflected properties ------------------------------------------------

  get id(): string {
    return this.getAttribute("id") ?? "";
  }
  set id(value: string) {
    this.setAttribute("id", value);
  }

  get className(): string | VSVGAnimatedString {
    return this.namespaceURI === SVG_NS
      ? this._animatedString("class")
      : (this.getAttribute("class") ?? "");
  }
  set className(value: string | VSVGAnimatedString) {
    this.setAttribute(
      "class",
      typeof value === "string" ? value : value.baseVal,
    );
  }

  get classList(): DOMTokenList {
    if (!this._classList) this._classList = new DOMTokenList(this);
    return this._classList;
  }

  get dataset(): DOMStringMap {
    if (!this._dataset) this._dataset = createDataset(this);
    return this._dataset;
  }

  get style(): VCSSStyleDeclaration {
    if (!this._style) {
      this._style = new VCSSStyleDeclaration(this).asProxy();
    }
    return this._style;
  }

  // --- SVG reflected properties -------------------------------------------

  get href(): VSVGAnimatedString {
    return this._animatedString("href", "xlink:href");
  }

  get x(): VSVGAnimatedLength {
    return this._animatedLength("x");
  }

  get y(): VSVGAnimatedLength {
    return this._animatedLength("y");
  }

  get width(): any {
    return this._animatedLength("width");
  }
  set width(value: any) {
    this.setAttribute(
      "width",
      value instanceof VSVGAnimatedLength ? value.baseVal.value : value,
    );
  }

  get height(): any {
    return this._animatedLength("height");
  }
  set height(value: any) {
    this.setAttribute(
      "height",
      value instanceof VSVGAnimatedLength ? value.baseVal.value : value,
    );
  }

  get cx(): VSVGAnimatedLength {
    return this._animatedLength("cx");
  }

  get cy(): VSVGAnimatedLength {
    return this._animatedLength("cy");
  }

  get r(): VSVGAnimatedLength {
    return this._animatedLength("r");
  }

  get rx(): VSVGAnimatedLength {
    return this._animatedLength("rx");
  }

  get ry(): VSVGAnimatedLength {
    return this._animatedLength("ry");
  }

  get x1(): VSVGAnimatedLength {
    return this._animatedLength("x1");
  }

  get y1(): VSVGAnimatedLength {
    return this._animatedLength("y1");
  }

  get x2(): VSVGAnimatedLength {
    return this._animatedLength("x2");
  }

  get y2(): VSVGAnimatedLength {
    return this._animatedLength("y2");
  }

  get viewBox(): VSVGAnimatedRect {
    return this._cachedAnimated(
      "viewBox",
      () => new VSVGAnimatedRect(this, "viewBox"),
    );
  }

  get transform(): VSVGAnimatedTransformList {
    return this._cachedAnimated(
      "transform",
      () => new VSVGAnimatedTransformList(this),
    );
  }

  createSVGMatrix(): VSVGMatrix {
    return new VSVGMatrix();
  }

  createSVGTransform(): VSVGTransform {
    return new VSVGTransform();
  }

  createSVGTransformFromMatrix(matrix: VSVGMatrix): VSVGTransform {
    const transform = new VSVGTransform();
    transform.setMatrix(matrix);
    return transform;
  }

  createSVGPoint(): { x: number; y: number; matrixTransform: (matrix: VSVGMatrix) => { x: number; y: number } } {
    const point = {
      x: 0,
      y: 0,
      matrixTransform(matrix: VSVGMatrix) {
        return {
          x: matrix.a * point.x + matrix.c * point.y + matrix.e,
          y: matrix.b * point.x + matrix.d * point.y + matrix.f,
        };
      },
    };
    return point;
  }

  getBBox(): SVGRectLike {
    return this._geometryRect();
  }

  getBoundingClientRect(): SVGRectLike & {
    top: number;
    right: number;
    bottom: number;
    left: number;
    toJSON(): SVGRectLike;
  } {
    const rect = this._geometryRect();
    return {
      ...rect,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      left: rect.x,
      toJSON: () => ({ ...rect }),
    };
  }

  get clientWidth(): number {
    return this._geometryRect().width;
  }

  get clientHeight(): number {
    return this._geometryRect().height;
  }

  get offsetWidth(): number {
    return this.clientWidth;
  }

  get offsetHeight(): number {
    return this.clientHeight;
  }

  getCTM(): VSVGMatrix {
    return new VSVGMatrix();
  }

  getScreenCTM(): VSVGMatrix {
    return this.getCTM();
  }

  private _geometryRect(): SVGRectLike {
    if (this.localName === "svg" && this.hasAttribute("viewBox")) {
      return this.viewBox.baseVal;
    }
    return {
      x: Number.parseFloat(this.getAttribute("x") ?? "0") || 0,
      y: Number.parseFloat(this.getAttribute("y") ?? "0") || 0,
      width: Number.parseFloat(this.getAttribute("width") ?? "0") || 0,
      height: Number.parseFloat(this.getAttribute("height") ?? "0") || 0,
    };
  }

  private _animatedLength(attribute: string): VSVGAnimatedLength {
    return this._cachedAnimated(
      `length:${attribute}`,
      () => new VSVGAnimatedLength(this, attribute),
    );
  }

  private _animatedString(
    attribute: string,
    fallbackAttribute?: string,
  ): VSVGAnimatedString {
    return this._cachedAnimated(
      `string:${attribute}`,
      () => new VSVGAnimatedString(this, attribute, fallbackAttribute),
    );
  }

  private _cachedAnimated<T>(key: string, factory: () => T): T {
    if (!this._animatedProperties.has(key)) {
      this._animatedProperties.set(key, factory());
    }
    return this._animatedProperties.get(key) as T;
  }

  // --- Element traversal ---------------------------------------------------

  get children(): HTMLCollectionLike<VElement> {
    return createNodeList(
      this._childNodes.filter(
        (n): n is VElement => n.nodeType === ELEMENT_NODE,
      ),
    );
  }

  get childElementCount(): number {
    let count = 0;
    for (const c of this._childNodes) if (c.nodeType === ELEMENT_NODE) count++;
    return count;
  }

  get firstElementChild(): VElement | null {
    for (const c of this._childNodes) {
      if (c.nodeType === ELEMENT_NODE) return c as VElement;
    }
    return null;
  }

  get lastElementChild(): VElement | null {
    for (let i = this._childNodes.length - 1; i >= 0; i--) {
      if (this._childNodes[i].nodeType === ELEMENT_NODE) {
        return this._childNodes[i] as VElement;
      }
    }
    return null;
  }

  get previousElementSibling(): VElement | null {
    const p = this._parentNode;
    if (!p) return null;
    const i = p._childNodes.indexOf(this);
    for (let j = i - 1; j >= 0; j--) {
      if (p._childNodes[j].nodeType === ELEMENT_NODE) {
        return p._childNodes[j] as VElement;
      }
    }
    return null;
  }

  get nextElementSibling(): VElement | null {
    const p = this._parentNode;
    if (!p) return null;
    const i = p._childNodes.indexOf(this);
    for (let j = i + 1; j < p._childNodes.length; j++) {
      if (p._childNodes[j].nodeType === ELEMENT_NODE) {
        return p._childNodes[j] as VElement;
      }
    }
    return null;
  }

  // --- Serialization / parsing --------------------------------------------

  get innerHTML(): string {
    return serializeChildren(this, { xml: !this._ownerDocument?._html });
  }
  set innerHTML(html: string) {
    this._removeAllChildren();
    const frag = parseFragment(html, this._nodeDocument(), this);
    this.appendChild(frag);
  }

  get outerHTML(): string {
    return serializeNode(this, { xml: !this._ownerDocument?._html });
  }
  set outerHTML(html: string) {
    const parent = this._parentNode;
    if (!parent) {
      throw syntaxError(
        "Failed to set 'outerHTML': This element has no parent node.",
      );
    }
    const frag = parseFragment(html, this._nodeDocument(), parent as VElement);
    parent.replaceChild(frag, this);
  }

  insertAdjacentHTML(position: InsertPosition, html: string): void {
    const context =
      position === "beforebegin" || position === "afterend"
        ? (this._parentNode as VElement | null)
        : this;
    if (!context) return;
    const frag = parseFragment(html, this._nodeDocument(), context);
    this._insertAdjacent(position, frag);
  }

  insertAdjacentElement(
    position: InsertPosition,
    element: VElement,
  ): VElement | null {
    this._insertAdjacent(position, element);
    return element;
  }

  insertAdjacentText(position: InsertPosition, text: string): void {
    this._insertAdjacent(position, this._nodeDocument().createTextNode(text));
  }

  private _insertAdjacent(position: InsertPosition, node: VNode): void {
    switch (position) {
      case "beforebegin":
        this._parentNode?.insertBefore(node, this);
        break;
      case "afterbegin":
        this.insertBefore(node, this.firstChild);
        break;
      case "beforeend":
        this.appendChild(node);
        break;
      case "afterend":
        this._parentNode?.insertBefore(node, this.nextSibling);
        break;
    }
  }

  // --- Selectors -----------------------------------------------------------

  matches(selector: string): boolean {
    return matchesSelector(this, selector);
  }

  closest(selector: string): VElement | null {
    return closestSelector(this, selector);
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
    const matches: VElement[] = [];
    const stack = [...this._childNodes].reverse();
    while (stack.length) {
      const node = stack.pop() as VNode;
      if (node.nodeType === ELEMENT_NODE) {
        const element = node as VElement;
        if (
          (namespace === "*" || element.namespaceURI === namespace) &&
          (localName === "*" || element.localName === localName)
        ) {
          matches.push(element);
        }
      }
      for (let index = node._childNodes.length - 1; index >= 0; index--) {
        stack.push(node._childNodes[index]);
      }
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
    return selector ? qsa(this, selector) : createNodeList([]);
  }

  // --- Cloning -------------------------------------------------------------

  _shallowClone(): VNode {
    const clone = new VElement(this.namespaceURI, this.prefix, this.localName);
    clone._ownerDocument = this._ownerDocument;
    clone._attributes = this._attributes.map((a) => ({ ...a }));
    return clone;
  }
}
