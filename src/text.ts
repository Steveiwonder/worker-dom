import { TEXT_NODE } from "./constants.js";
import { VCharacterData } from "./character-data.js";
import type { VNode } from "./node.js";

export class VText extends VCharacterData {
  readonly nodeType = TEXT_NODE;

  get nodeName(): string {
    return "#text";
  }

  /** DOM alias for the text content. */
  get wholeText(): string {
    return this.data;
  }

  _shallowClone(): VNode {
    const clone = new VText(this.data);
    clone._ownerDocument = this._ownerDocument;
    return clone;
  }
}
