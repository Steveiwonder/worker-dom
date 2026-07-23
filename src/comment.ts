import { COMMENT_NODE } from "./constants.js";
import { VCharacterData } from "./character-data.js";
import type { VNode } from "./node.js";

export class VComment extends VCharacterData {
  readonly nodeType = COMMENT_NODE;

  get nodeName(): string {
    return "#comment";
  }

  _shallowClone(): VNode {
    const clone = new VComment(this.data);
    clone._ownerDocument = this._ownerDocument;
    return clone;
  }
}
