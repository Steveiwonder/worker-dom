/**
 * worker-dom — a lightweight, dependency-free virtual DOM for Web Workers.
 *
 * The public entry point. Prefer {@link createDocument} for everyday use; the
 * `V*` classes are exported for `instanceof` checks and typing.
 */

export {
  createDocument,
  VDocument,
  type CreateDocumentOptions,
  type DocumentMode,
} from "./document.js";

export { VNode } from "./node.js";
export { VElement, type InsertPosition } from "./element.js";
export { VCharacterData } from "./character-data.js";
export { VText } from "./text.js";
export { VComment } from "./comment.js";
export { VDocumentFragment } from "./document-fragment.js";
export { VDocumentType } from "./document-type.js";

export { DOMTokenList } from "./class-list.js";
export type { DOMStringMap } from "./dataset.js";

export {
  DOMException,
  type DOMExceptionName,
} from "./errors.js";

export {
  serialize,
  serializeHTML,
  serializeXML,
  type SerializeOptions,
} from "./serializer/index.js";

export { parseFragment } from "./parser/index.js";

export {
  type NodeListLike,
  type HTMLCollectionLike,
} from "./collections.js";

export {
  type NamedNodeMapLike,
  type VAttr,
} from "./attributes.js";

export {
  ELEMENT_NODE,
  ATTRIBUTE_NODE,
  TEXT_NODE,
  CDATA_SECTION_NODE,
  PROCESSING_INSTRUCTION_NODE,
  COMMENT_NODE,
  DOCUMENT_NODE,
  DOCUMENT_TYPE_NODE,
  DOCUMENT_FRAGMENT_NODE,
  HTML_NS,
  SVG_NS,
  MATHML_NS,
  XML_NS,
  XMLNS_NS,
  XLINK_NS,
} from "./constants.js";
