import {
  ESCAPABLE_RAW_TEXT_ELEMENTS,
  HTML_NS,
  MATHML_NS,
  RAW_TEXT_ELEMENTS,
  SVG_NS,
  VOID_ELEMENTS,
  XLINK_NS,
  XMLNS_NS,
  XML_NS,
} from "../constants.js";
import type { VDocument } from "../document.js";
import type { VElement } from "../element.js";
import type { VNode } from "../node.js";
import type { VDocumentFragment } from "../document-fragment.js";
import { decodeEntities } from "./entities.js";

interface OpenElement {
  el: VElement;
  ns: string | null;
  localName: string;
  /** raw text element (no nested markup) */
  raw: boolean;
  /** decode entities inside raw content (escapable raw text) */
  decode: boolean;
}

const WS = /\s/;

/**
 * Parse an HTML/XML fragment into a {@link VDocumentFragment} owned by
 * `ownerDocument`. `context` supplies the default namespace (its own
 * namespace) so, e.g., parsing into an `<svg>` element yields SVG children.
 *
 * This is a deliberately practical subset of the WHATWG algorithm. It handles
 * nested elements, text, comments, quoted/boolean/unquoted attributes,
 * self-closing syntax, void elements, entities, and raw text — but does not
 * reproduce every parse-error recovery rule. See README for documented gaps.
 */
export function parseFragment(
  html: string,
  ownerDocument: VDocument,
  context?: VElement | null,
): VDocumentFragment {
  const frag = ownerDocument.createDocumentFragment();
  const baseNS: string | null = context
    ? context.namespaceURI
    : ownerDocument._html
      ? HTML_NS
      : null;

  const open: OpenElement[] = [];
  const currentParent = (): VNode =>
    open.length ? open[open.length - 1].el : frag;
  const currentNS = (): string | null =>
    open.length ? open[open.length - 1].ns : baseNS;

  const len = html.length;
  let i = 0;

  while (i < len) {
    const top = open[open.length - 1];

    // Raw text / escapable raw text content.
    if (top && top.raw) {
      const closeIdx = indexOfCloseTag(html, i, top.localName);
      const end = closeIdx === -1 ? len : closeIdx;
      let content = html.slice(i, end);
      if (content) {
        if (top.decode) content = decodeEntities(content);
        top.el._appendChildFast(ownerDocument.createTextNode(content));
      }
      i = end;
      if (closeIdx === -1) break;
      // Fall through: the loop will consume the matching end tag next.
    }

    const c = html[i];
    if (c === "<") {
      if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i + 4);
        const stop = end === -1 ? len : end;
        currentParent()._appendChildFast(
          ownerDocument.createComment(html.slice(i + 4, stop)),
        );
        i = end === -1 ? len : end + 3;
        continue;
      }
      if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
        // Doctype / processing instruction / bogus: skip to '>'.
        const end = html.indexOf(">", i);
        i = end === -1 ? len : end + 1;
        continue;
      }
      if (html.startsWith("</", i)) {
        const end = html.indexOf(">", i);
        const raw = html.slice(i + 2, end === -1 ? len : end).trim();
        const name = raw.split(/\s/)[0] ?? "";
        closeTag(open, name);
        i = end === -1 ? len : end + 1;
        continue;
      }
      // Start tag.
      const parsed = parseStartTag(html, i);
      if (!parsed) {
        // Not a real tag ('<' as text).
        currentParent()._appendChildFast(ownerDocument.createTextNode("<"));
        i += 1;
        continue;
      }
      const { tagName, attrs, selfClosing, next } = parsed;
      i = next;

      const ns = resolveNamespace(tagName, currentNS());
      const el = createElement(ownerDocument, ns, tagName);
      applyAttributes(el, attrs);
      currentParent()._appendChildFast(el);

      const lower = tagName.toLowerCase();
      const isVoid =
        (ns === HTML_NS || ns === null) && VOID_ELEMENTS.has(lower);
      if (selfClosing || isVoid) {
        // Element is complete; nothing to push.
        continue;
      }

      const raw = (ns === HTML_NS || ns === null) && RAW_TEXT_ELEMENTS.has(lower);
      const escapable =
        (ns === HTML_NS || ns === null) &&
        ESCAPABLE_RAW_TEXT_ELEMENTS.has(lower);
      open.push({
        el,
        ns,
        localName: el.localName,
        raw: raw || escapable,
        decode: escapable,
      });
      continue;
    }

    // Text run up to the next '<'.
    const next = html.indexOf("<", i);
    const end = next === -1 ? len : next;
    const text = html.slice(i, end);
    currentParent()._appendChildFast(
      ownerDocument.createTextNode(decodeEntities(text)),
    );
    i = end;
  }

  return frag;
}

function indexOfCloseTag(html: string, from: number, localName: string): number {
  const needle = "</" + localName.toLowerCase();
  const lower = html.toLowerCase();
  return lower.indexOf(needle, from);
}

function closeTag(open: OpenElement[], name: string): void {
  const lower = name.toLowerCase();
  for (let j = open.length - 1; j >= 0; j--) {
    if (open[j].localName.toLowerCase() === lower) {
      open.length = j; // pop this element and everything opened after it
      return;
    }
  }
  // Stray end tag: ignore.
}

interface ParsedStartTag {
  tagName: string;
  attrs: Array<{ name: string; value: string }>;
  selfClosing: boolean;
  next: number;
}

function parseStartTag(html: string, start: number): ParsedStartTag | null {
  let i = start + 1;
  const len = html.length;
  // Tag name.
  const nameStart = i;
  while (i < len && !WS.test(html[i]) && html[i] !== ">" && html[i] !== "/") {
    i++;
  }
  const tagName = html.slice(nameStart, i);
  if (tagName === "") return null;

  const attrs: Array<{ name: string; value: string }> = [];
  let selfClosing = false;

  while (i < len) {
    while (i < len && WS.test(html[i])) i++;
    if (i >= len) break;
    if (html[i] === ">") {
      i++;
      break;
    }
    if (html[i] === "/") {
      i++;
      if (html[i] === ">") {
        selfClosing = true;
        i++;
        break;
      }
      continue;
    }
    // Attribute name.
    const attrNameStart = i;
    while (
      i < len &&
      !WS.test(html[i]) &&
      html[i] !== "=" &&
      html[i] !== ">" &&
      html[i] !== "/"
    ) {
      i++;
    }
    const attrName = html.slice(attrNameStart, i);
    while (i < len && WS.test(html[i])) i++;
    let value = "";
    if (html[i] === "=") {
      i++;
      while (i < len && WS.test(html[i])) i++;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        i++;
        const vStart = i;
        while (i < len && html[i] !== quote) i++;
        value = html.slice(vStart, i);
        i++; // closing quote
      } else {
        const vStart = i;
        while (i < len && !WS.test(html[i]) && html[i] !== ">") i++;
        value = html.slice(vStart, i);
      }
    }
    if (attrName) attrs.push({ name: attrName, value });
  }

  return { tagName, attrs, selfClosing, next: i };
}

function resolveNamespace(tagName: string, parentNS: string | null): string | null {
  const lower = tagName.toLowerCase();
  if (parentNS === HTML_NS || parentNS === null) {
    if (lower === "svg") return SVG_NS;
    if (lower === "math") return MATHML_NS;
  }
  return parentNS;
}

function createElement(
  doc: VDocument,
  ns: string | null,
  tagName: string,
): VElement {
  if (ns === null) return doc.createElement(tagName);
  const localName = ns === HTML_NS ? tagName.toLowerCase() : tagName;
  return doc.createElementNS(ns, localName);
}

function applyAttributes(
  el: VElement,
  attrs: Array<{ name: string; value: string }>,
): void {
  for (const { name, value } of attrs) {
    const decoded = decodeEntities(value);
    const colon = name.indexOf(":");
    if (colon > 0) {
      const prefix = name.slice(0, colon);
      const ns =
        prefix === "xlink"
          ? XLINK_NS
          : prefix === "xml"
            ? XML_NS
            : prefix === "xmlns"
              ? XMLNS_NS
              : null;
      if (ns) {
        el.setAttributeNS(ns, name, decoded);
        continue;
      }
    } else if (name === "xmlns") {
      el.setAttributeNS(XMLNS_NS, "xmlns", decoded);
      continue;
    }
    try {
      el.setAttribute(name, decoded);
    } catch {
      // Skip attributes with names that are invalid XML Names.
    }
  }
}
