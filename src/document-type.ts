import { DOCUMENT_TYPE_NODE } from "./constants.js";
import { VNode } from "./node.js";

export class VDocumentType extends VNode {
  readonly nodeType = DOCUMENT_TYPE_NODE;
  readonly name: string;
  readonly publicId: string;
  readonly systemId: string;

  constructor(name: string, publicId = "", systemId = "") {
    super();
    this.name = name;
    this.publicId = publicId;
    this.systemId = systemId;
  }

  get nodeName(): string {
    return this.name;
  }

  _shallowClone(): VNode {
    const clone = new VDocumentType(this.name, this.publicId, this.systemId);
    clone._ownerDocument = this._ownerDocument;
    return clone;
  }
}
