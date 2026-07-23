/**
 * DOM-compatible numeric node type values.
 *
 * These mirror the values used by the real browser DOM so that code written
 * against `Node.ELEMENT_NODE` etc. behaves identically.
 */
export const ELEMENT_NODE = 1;
export const ATTRIBUTE_NODE = 2;
export const TEXT_NODE = 3;
export const CDATA_SECTION_NODE = 4;
export const PROCESSING_INSTRUCTION_NODE = 7;
export const COMMENT_NODE = 8;
export const DOCUMENT_NODE = 9;
export const DOCUMENT_TYPE_NODE = 10;
export const DOCUMENT_FRAGMENT_NODE = 11;

/** Well-known namespace URIs. */
export const HTML_NS = "http://www.w3.org/1999/xhtml";
export const SVG_NS = "http://www.w3.org/2000/svg";
export const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
export const XML_NS = "http://www.w3.org/XML/1998/namespace";
export const XMLNS_NS = "http://www.w3.org/2000/xmlns/";
export const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * HTML void elements. These never have children and serialize without a
 * closing tag in HTML mode.
 */
export const VOID_ELEMENTS = new Set<string>([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * HTML "raw text" elements whose content is not parsed as markup. Their text
 * is serialized verbatim (no entity escaping) and parsed until the matching
 * close tag is seen.
 */
export const RAW_TEXT_ELEMENTS = new Set<string>(["script", "style"]);

/**
 * HTML "escapable raw text" elements. Content is treated as text (no nested
 * elements) but entities are decoded.
 */
export const ESCAPABLE_RAW_TEXT_ELEMENTS = new Set<string>([
  "textarea",
  "title",
]);
