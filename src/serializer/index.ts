import {
  COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
  DOCUMENT_NODE,
  DOCUMENT_TYPE_NODE,
  ELEMENT_NODE,
  HTML_NS,
  RAW_TEXT_ELEMENTS,
  TEXT_NODE,
  VOID_ELEMENTS,
} from "../constants.js";
import type { VNode } from "../node.js";
import type { VElement } from "../element.js";
import type { VDocumentType } from "../document-type.js";

export interface SerializeOptions {
  /** Serialize using XML rules (self-closing empty tags, stricter escaping). */
  xml?: boolean;
}

// --- Escaping --------------------------------------------------------------

function escapeText(value: string, xml: boolean): string {
  let out = value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  out = out.replace(/>/g, "&gt;");
  if (!xml) out = out.replace(/\u00A0/g, "&nbsp;");
  return out;
}

function escapeAttr(value: string, xml: boolean): string {
  let out = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  if (xml) {
    out = out.replace(/</g, "&lt;");
  } else {
    out = out.replace(/\u00A0/g, "&nbsp;");
  }
  return out;
}

function elementQName(el: VElement): string {
  return el.prefix ? `${el.prefix}:${el.localName}` : el.localName;
}

function serializeAttributes(el: VElement, xml: boolean): string {
  let out = "";
  for (const a of el._attributes) {
    out += ` ${a.name}="${escapeAttr(a.value, xml)}"`;
  }
  return out;
}

function serializeDoctype(dt: VDocumentType): string {
  let out = `<!DOCTYPE ${dt.name}`;
  if (dt.publicId) {
    out += ` PUBLIC "${dt.publicId}"`;
    if (dt.systemId) out += ` "${dt.systemId}"`;
  } else if (dt.systemId) {
    out += ` SYSTEM "${dt.systemId}"`;
  }
  return out + ">";
}

function isVoidElement(el: VElement, xml: boolean): boolean {
  if (xml) return false;
  return (
    (el.namespaceURI === HTML_NS || el.namespaceURI === null) &&
    VOID_ELEMENTS.has(el.localName)
  );
}

function isRawText(el: VElement, xml: boolean): boolean {
  return (
    !xml &&
    (el.namespaceURI === HTML_NS || el.namespaceURI === null) &&
    RAW_TEXT_ELEMENTS.has(el.localName)
  );
}

// --- Core iterative serializer --------------------------------------------

type WorkItem = VNode | string;

function serializeInto(parts: string[], roots: readonly VNode[], xml: boolean): void {
  // Stack of nodes to open, or literal strings (close tags) to append.
  const stack: WorkItem[] = [];
  for (let i = roots.length - 1; i >= 0; i--) stack.push(roots[i]);

  while (stack.length) {
    const item = stack.pop() as WorkItem;
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    const node = item;
    switch (node.nodeType) {
      case ELEMENT_NODE: {
        const el = node as unknown as VElement;
        const qname = elementQName(el);
        const attrs = serializeAttributes(el, xml);
        const kids = el._childNodes;

        if (isVoidElement(el, xml)) {
          parts.push(`<${qname}${attrs}>`);
          break;
        }
        if (xml && kids.length === 0) {
          parts.push(`<${qname}${attrs}/>`);
          break;
        }

        parts.push(`<${qname}${attrs}>`);
        stack.push(`</${qname}>`);

        if (isRawText(el, xml)) {
          // Raw text: emit child text verbatim, no escaping, no nesting.
          let raw = "";
          for (const c of kids) {
            if (c.nodeType === TEXT_NODE) {
              raw += (c as unknown as { data: string }).data;
            }
          }
          parts.push(raw);
        } else {
          for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
        }
        break;
      }
      case TEXT_NODE: {
        parts.push(escapeText((node as unknown as { data: string }).data, xml));
        break;
      }
      case COMMENT_NODE: {
        parts.push(`<!--${(node as unknown as { data: string }).data}-->`);
        break;
      }
      case DOCUMENT_TYPE_NODE: {
        parts.push(serializeDoctype(node as unknown as VDocumentType));
        break;
      }
      case DOCUMENT_NODE:
      case DOCUMENT_FRAGMENT_NODE: {
        const kids = node._childNodes;
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
        break;
      }
      default:
        break;
    }
  }
}

/** Serialize a node (including itself), like `outerHTML`. */
export function serializeNode(node: VNode, options: SerializeOptions = {}): string {
  const parts: string[] = [];
  serializeInto(parts, [node], !!options.xml);
  return parts.join("");
}

/** Serialize a node's children, like `innerHTML`. */
export function serializeChildren(
  node: VNode,
  options: SerializeOptions = {},
): string {
  const parts: string[] = [];
  serializeInto(parts, node._childNodes, !!options.xml);
  return parts.join("");
}

// --- Public API ------------------------------------------------------------

/** Serialize a node. Defaults to HTML rules; pass `{ xml: true }` for XML. */
export function serialize(node: VNode, options: SerializeOptions = {}): string {
  return serializeNode(node, options);
}

export function serializeHTML(node: VNode): string {
  return serializeNode(node, { xml: false });
}

export function serializeXML(node: VNode): string {
  return serializeNode(node, { xml: true });
}
