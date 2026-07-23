import {
  DOCUMENT_NODE,
  ELEMENT_NODE,
  HTML_NS,
  TEXT_NODE,
} from "../constants.js";
import { createNodeList, type NodeListLike } from "../collections.js";
import type { VElement } from "../element.js";
import type { VNode } from "../node.js";
import {
  parseSelector,
  type Compound,
  type ComplexSelector,
  type Condition,
  type NthArg,
  type SelectorList,
} from "./parser.js";

function isElement(n: VNode): n is VElement {
  return n.nodeType === ELEMENT_NODE;
}

function elementChildren(node: VNode): VElement[] {
  const out: VElement[] = [];
  for (const c of node._childNodes) if (isElement(c)) out.push(c);
  return out;
}

function matchType(el: VElement, name: string): boolean {
  // Type selectors are case-insensitive for HTML elements; a selector with no
  // namespace matches by local name across any namespace (Selectors API).
  if (el.namespaceURI === HTML_NS) {
    return el.localName.toLowerCase() === name.toLowerCase();
  }
  return el.localName === name;
}

function matchAttr(el: VElement, cond: Extract<Condition, { kind: "attr" }>): boolean {
  // Tolerate a namespace prefix in the selector (`ns|attr`, `*|attr`): match
  // against the local part. Full namespace resolution is out of scope.
  const bar = cond.name.indexOf("|");
  const lookup = bar === -1 ? cond.name : cond.name.slice(bar + 1);
  const actual = el.getAttribute(lookup);
  if (actual === null) return false;
  if (cond.op === undefined) return true;
  let a = actual;
  let v = cond.value ?? "";
  if (cond.caseInsensitive) {
    a = a.toLowerCase();
    v = v.toLowerCase();
  }
  switch (cond.op) {
    case "=":
      return a === v;
    case "~=":
      return v !== "" && a.split(/\s+/).includes(v);
    case "|=":
      return a === v || a.startsWith(v + "-");
    case "^=":
      return v !== "" && a.startsWith(v);
    case "$=":
      return v !== "" && a.endsWith(v);
    case "*=":
      return v !== "" && a.includes(v);
    default:
      return false;
  }
}

function nthMatches(index1: number, { a, b }: NthArg): boolean {
  // index1 is 1-based. Solve index1 = a*n + b for some integer n >= 0.
  if (a === 0) return index1 === b;
  const n = (index1 - b) / a;
  return Number.isInteger(n) && n >= 0;
}

/**
 * Query-scoped cache. Positional pseudo-classes (`:nth-child`, `:first-child`,
 * …) and sibling combinators (`+`, `~`) need an element's position among its
 * siblings. Computing that per element is O(siblings), which makes
 * `querySelectorAll` O(n²) on a large flat sibling list. Caching each parent's
 * element children (and an index map) once per query makes those lookups O(1).
 */
interface SiblingInfo {
  elems: VElement[];
  index: Map<VElement, number>;
}
interface MatchContext {
  siblings: WeakMap<VNode, SiblingInfo>;
}

function createContext(): MatchContext {
  return { siblings: new WeakMap() };
}

function siblingInfo(parent: VNode, ctx: MatchContext): SiblingInfo {
  let info = ctx.siblings.get(parent);
  if (!info) {
    const elems = elementChildren(parent);
    const index = new Map<VElement, number>();
    for (let i = 0; i < elems.length; i++) index.set(elems[i], i);
    info = { elems, index };
    ctx.siblings.set(parent, info);
  }
  return info;
}

function matchPseudo(
  el: VElement,
  cond: Extract<Condition, { kind: "pseudo" }>,
  ctx: MatchContext,
): boolean {
  switch (cond.name) {
    case "first-child": {
      const p = el.parentNode;
      return p ? siblingInfo(p, ctx).index.get(el) === 0 : false;
    }
    case "last-child": {
      const p = el.parentNode;
      if (!p) return false;
      const info = siblingInfo(p, ctx);
      return info.index.get(el) === info.elems.length - 1;
    }
    case "only-child": {
      const p = el.parentNode;
      return p ? siblingInfo(p, ctx).elems.length === 1 : false;
    }
    case "first-of-type":
      return ofType(el, true, ctx);
    case "last-of-type":
      return ofType(el, false, ctx);
    case "empty":
      return isEmpty(el);
    case "root":
      return el.parentNode !== null && el.parentNode.nodeType === DOCUMENT_NODE;
    case "not":
      return !(cond.selectors ?? []).some((c) =>
        matchComplexAgainst(el, c, ctx),
      );
    case "is":
    case "where":
      return (cond.selectors ?? []).some((c) =>
        matchComplexAgainst(el, c, ctx),
      );
    case "nth-child":
    case "nth-last-child": {
      const parent = el.parentNode;
      if (!cond.nth || !parent) return false;
      const info = siblingInfo(parent, ctx);
      const idx = info.index.get(el);
      if (idx === undefined) return false;
      const index1 =
        cond.name === "nth-child" ? idx + 1 : info.elems.length - idx;
      return nthMatches(index1, cond.nth);
    }
    default:
      // Unsupported pseudo-classes never match.
      return false;
  }
}

function ofType(el: VElement, first: boolean, ctx: MatchContext): boolean {
  const p = el.parentNode;
  if (!p) return true;
  const sibs = siblingInfo(p, ctx).elems;
  for (
    let i = first ? 0 : sibs.length - 1;
    first ? i < sibs.length : i >= 0;
    i += first ? 1 : -1
  ) {
    const s = sibs[i];
    if (s.localName === el.localName && s.namespaceURI === el.namespaceURI) {
      return s === el;
    }
  }
  return false;
}

function isEmpty(el: VElement): boolean {
  for (const c of el._childNodes) {
    if (c.nodeType === ELEMENT_NODE) return false;
    if (c.nodeType === TEXT_NODE && (c as unknown as { data: string }).data !== "") {
      return false;
    }
  }
  return true;
}

function matchCompound(
  el: VElement,
  compound: Compound,
  ctx: MatchContext,
): boolean {
  for (const cond of compound.conditions) {
    switch (cond.kind) {
      case "universal":
        break;
      case "type":
        if (!matchType(el, cond.name)) return false;
        break;
      case "id":
        if (el.getAttribute("id") !== cond.id) return false;
        break;
      case "class":
        if (!el.classList.contains(cond.name)) return false;
        break;
      case "attr":
        if (!matchAttr(el, cond)) return false;
        break;
      case "pseudo":
        if (!matchPseudo(el, cond, ctx)) return false;
        break;
    }
  }
  return true;
}

function matchComplexParts(
  el: VElement,
  parts: ComplexSelector,
  index: number,
  ctx: MatchContext,
): boolean {
  if (!matchCompound(el, parts[index].compound, ctx)) return false;
  if (index === 0) return true;

  const combinator = parts[index].combinator;
  switch (combinator) {
    case " ": {
      let a = el.parentElement;
      while (a) {
        if (matchComplexParts(a, parts, index - 1, ctx)) return true;
        a = a.parentElement;
      }
      return false;
    }
    case ">": {
      const p = el.parentElement;
      return p ? matchComplexParts(p, parts, index - 1, ctx) : false;
    }
    case "+": {
      // Immediately preceding element sibling, via the cached sibling index.
      const parent = el.parentNode;
      if (!parent) return false;
      const info = siblingInfo(parent, ctx);
      const idx = info.index.get(el);
      if (idx === undefined || idx === 0) return false;
      return matchComplexParts(info.elems[idx - 1], parts, index - 1, ctx);
    }
    case "~": {
      const parent = el.parentNode;
      if (!parent) return false;
      const info = siblingInfo(parent, ctx);
      const idx = info.index.get(el);
      if (idx === undefined) return false;
      for (let j = idx - 1; j >= 0; j--) {
        if (matchComplexParts(info.elems[j], parts, index - 1, ctx)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function matchComplexAgainst(
  el: VElement,
  complex: ComplexSelector,
  ctx: MatchContext,
): boolean {
  return matchComplexParts(el, complex, complex.length - 1, ctx);
}

function matchesList(
  el: VElement,
  list: SelectorList,
  ctx: MatchContext,
): boolean {
  return list.some((complex) => matchComplexAgainst(el, complex, ctx));
}

/** Iterative pre-order walk of all descendant elements of `root`. */
function* descendantElements(root: VNode): Generator<VElement> {
  const stack: VNode[] = [];
  for (let i = root._childNodes.length - 1; i >= 0; i--) {
    stack.push(root._childNodes[i]);
  }
  while (stack.length) {
    const n = stack.pop() as VNode;
    if (isElement(n)) yield n;
    for (let i = n._childNodes.length - 1; i >= 0; i--) {
      stack.push(n._childNodes[i]);
    }
  }
}

// --- Public matching API ---------------------------------------------------

export function matches(el: VElement, selector: string): boolean {
  return matchesList(el, parseSelector(selector), createContext());
}

export function closest(el: VElement, selector: string): VElement | null {
  const list = parseSelector(selector);
  const ctx = createContext();
  let current: VElement | null = el;
  while (current) {
    if (matchesList(current, list, ctx)) return current;
    current = current.parentElement;
  }
  return null;
}

export function querySelector(root: VNode, selector: string): VElement | null {
  const list = parseSelector(selector);
  const ctx = createContext();
  for (const el of descendantElements(root)) {
    if (matchesList(el, list, ctx)) return el;
  }
  return null;
}

export function querySelectorAll(
  root: VNode,
  selector: string,
): NodeListLike<VElement> {
  const list = parseSelector(selector);
  const ctx = createContext();
  const out: VElement[] = [];
  for (const el of descendantElements(root)) {
    if (matchesList(el, list, ctx)) out.push(el);
  }
  return createNodeList(out);
}
