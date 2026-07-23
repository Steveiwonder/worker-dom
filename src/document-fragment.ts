import { DOCUMENT_FRAGMENT_NODE } from "./constants.js";
import { VNode } from "./node.js";

export class VDocumentFragment extends VNode {
  readonly nodeType = DOCUMENT_FRAGMENT_NODE;

  get nodeName(): string {
    return "#document-fragment";
  }

  _shallowClone(): VNode {
    const clone = new VDocumentFragment();
    clone._ownerDocument = this._ownerDocument;
    return clone;
  }
}
