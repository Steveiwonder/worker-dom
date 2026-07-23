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

function matchPseudo(
  el: VElement,
  cond: Extract<Condition, { kind: "pseudo" }>,
): boolean {
  switch (cond.name) {
    case "first-child":
      return el.previousElementSibling === null;
    case "last-child":
      return el.nextElementSibling === null;
    case "only-child":
      return (
        el.previousElementSibling === null && el.nextElementSibling === null
      );
    case "first-of-type":
      return firstOfType(el, true);
    case "last-of-type":
      return firstOfType(el, false);
    case "empty":
      return isEmpty(el);
    case "root":
      return el.parentNode !== null && el.parentNode.nodeType === DOCUMENT_NODE;
    case "not":
      return !(cond.selectors ?? []).some((c) => matchComplexAgainst(el, c));
    case "is":
    case "where":
      return (cond.selectors ?? []).some((c) => matchComplexAgainst(el, c));
    case "nth-child":
    case "nth-last-child": {
      if (!cond.nth || !el.parentNode) return false;
      const sibs = elementChildren(el.parentNode);
      const idx = sibs.indexOf(el);
      if (idx === -1) return false;
      const index1 =
        cond.name === "nth-child" ? idx + 1 : sibs.length - idx;
      return nthMatches(index1, cond.nth);
    }
    default:
      // Unsupported pseudo-classes never match.
      return false;
  }
}

function firstOfType(el: VElement, first: boolean): boolean {
  const p = el.parentNode;
  if (!p) return true;
  const sibs = elementChildren(p).filter(
    (s) => s.localName === el.localName && s.namespaceURI === el.namespaceURI,
  );
  return first ? sibs[0] === el : sibs[sibs.length - 1] === el;
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

function matchCompound(el: VElement, compound: Compound): boolean {
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
        if (!matchPseudo(el, cond)) return false;
        break;
    }
  }
  return true;
}

function matchComplexParts(
  el: VElement,
  parts: ComplexSelector,
  index: number,
): boolean {
  if (!matchCompound(el, parts[index].compound)) return false;
  if (index === 0) return true;

  const combinator = parts[index].combinator;
  switch (combinator) {
    case " ": {
      let a = el.parentElement;
      while (a) {
        if (matchComplexParts(a, parts, index - 1)) return true;
        a = a.parentElement;
      }
      return false;
    }
    case ">": {
      const p = el.parentElement;
      return p ? matchComplexParts(p, parts, index - 1) : false;
    }
    case "+": {
      const prev = el.previousElementSibling;
      return prev ? matchComplexParts(prev, parts, index - 1) : false;
    }
    case "~": {
      let s = el.previousElementSibling;
      while (s) {
        if (matchComplexParts(s, parts, index - 1)) return true;
        s = s.previousElementSibling;
      }
      return false;
    }
    default:
      return false;
  }
}

function matchComplexAgainst(el: VElement, complex: ComplexSelector): boolean {
  return matchComplexParts(el, complex, complex.length - 1);
}

function matchesList(el: VElement, list: SelectorList): boolean {
  return list.some((complex) => matchComplexAgainst(el, complex));
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
  return matchesList(el, parseSelector(selector));
}

export function closest(el: VElement, selector: string): VElement | null {
  const list = parseSelector(selector);
  let current: VElement | null = el;
  while (current) {
    if (matchesList(current, list)) return current;
    current = current.parentElement;
  }
  return null;
}

export function querySelector(root: VNode, selector: string): VElement | null {
  const list = parseSelector(selector);
  for (const el of descendantElements(root)) {
    if (matchesList(el, list)) return el;
  }
  return null;
}

export function querySelectorAll(
  root: VNode,
  selector: string,
): NodeListLike<VElement> {
  const list = parseSelector(selector);
  const out: VElement[] = [];
  for (const el of descendantElements(root)) {
    if (matchesList(el, list)) out.push(el);
  }
  return createNodeList(out);
}
