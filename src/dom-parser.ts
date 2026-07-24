import { createDocument, type VDocument } from "./document.js";
import type { VNode } from "./node.js";
import { parseFragment } from "./parser/index.js";
import { serializeXML } from "./serializer/index.js";

/**
 * Worker-safe subset of DOMParser used by SVG rendering libraries.
 */
export class VDOMParser {
  parseFromString(source: string, mimeType: string): VDocument {
    const html = mimeType.toLowerCase() === "text/html";
    const document = createDocument({ mode: html ? "html" : "xml" });
    const fragment = parseFragment(
      String(source).replace(/^\s*<\?xml[^>]*>\s*/i, ""),
      document,
      html ? document.body : null,
    );
    if (html) {
      document.body.replaceChildren(fragment);
    } else {
      document.appendChild(fragment);
    }
    return document;
  }
}

export class VXMLSerializer {
  serializeToString(node: VNode): string {
    return serializeXML(node);
  }
}
