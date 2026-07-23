import { describe, it, expect } from "vitest";
import {
  createDocument,
  DOMException,
  ELEMENT_NODE,
  TEXT_NODE,
  COMMENT_NODE,
  DOCUMENT_FRAGMENT_NODE,
} from "../src/index.js";

describe("tree: insertion & removal", () => {
  it("appendChild links parent/child and siblings", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    const c = doc.createElement("c");
    doc.body.appendChild(a);
    doc.body.appendChild(b);
    doc.body.appendChild(c);
    expect(doc.body.childNodes.length).toBe(3);
    expect(doc.body.firstChild).toBe(a);
    expect(doc.body.lastChild).toBe(c);
    expect(b.previousSibling).toBe(a);
    expect(b.nextSibling).toBe(c);
    expect(a.previousSibling).toBeNull();
    expect(c.nextSibling).toBeNull();
    expect(a.parentNode).toBe(doc.body);
    expect(a.parentElement).toBe(doc.body);
  });

  it("insertBefore inserts at the right position", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    doc.body.appendChild(b);
    doc.body.insertBefore(a, b);
    expect(doc.body.firstChild).toBe(a);
    expect(a.nextSibling).toBe(b);
  });

  it("insertBefore with null reference appends", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    doc.body.insertBefore(a, null);
    expect(doc.body.lastChild).toBe(a);
  });

  it("removeChild detaches", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    doc.body.appendChild(a);
    const removed = doc.body.removeChild(a);
    expect(removed).toBe(a);
    expect(a.parentNode).toBeNull();
    expect(doc.body.contains(a)).toBe(false);
  });

  it("removeChild throws NotFoundError when not a child", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    expect(() => doc.body.removeChild(a)).toThrowError(DOMException);
    try {
      doc.body.removeChild(b);
    } catch (e) {
      expect((e as DOMException).name).toBe("NotFoundError");
    }
  });

  it("remove() removes self", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    doc.body.appendChild(a);
    a.remove();
    expect(a.parentNode).toBeNull();
  });

  it("replaceChild swaps nodes", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    doc.body.appendChild(a);
    const old = doc.body.replaceChild(b, a);
    expect(old).toBe(a);
    expect(a.parentNode).toBeNull();
    expect(doc.body.firstChild).toBe(b);
  });

  it("replaceChild throws NotFoundError for non-child", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    try {
      doc.body.replaceChild(b, a);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as DOMException).name).toBe("NotFoundError");
    }
  });

  it("hasChildNodes", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    expect(a.hasChildNodes()).toBe(false);
    a.appendChild(doc.createElement("b"));
    expect(a.hasChildNodes()).toBe(true);
  });
});

describe("tree: moving nodes", () => {
  it("inserting an existing node removes it from previous parent", () => {
    const doc = createDocument();
    const p1 = doc.createElement("p");
    const p2 = doc.createElement("p");
    const child = doc.createElement("span");
    p1.appendChild(child);
    doc.body.append(p1, p2);
    p2.appendChild(child);
    expect(p1.childNodes.length).toBe(0);
    expect(p2.firstChild).toBe(child);
    expect(child.parentNode).toBe(p2);
  });
});

describe("tree: cycle prevention", () => {
  it("cannot insert a node into itself", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    expect(() => a.appendChild(a)).toThrowError(DOMException);
    try {
      a.appendChild(a);
    } catch (e) {
      expect((e as DOMException).name).toBe("HierarchyRequestError");
    }
  });

  it("cannot insert a node into its descendant", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    const b = doc.createElement("b");
    a.appendChild(b);
    expect(() => b.appendChild(a)).toThrowError(/HierarchyRequestError|contains/);
  });

  it("cannot append a Document", () => {
    const doc = createDocument();
    const doc2 = createDocument();
    expect(() => doc.body.appendChild(doc2 as never)).toThrowError(DOMException);
  });

  it("Text may not be a child of a Document", () => {
    const doc = createDocument();
    const t = doc.createTextNode("x");
    expect(() => doc.appendChild(t)).toThrowError(DOMException);
  });
});

describe("tree: fragment insertion", () => {
  it("inserts fragment children, not the fragment", () => {
    const doc = createDocument();
    const frag = doc.createDocumentFragment();
    frag.appendChild(doc.createElement("a"));
    frag.appendChild(doc.createElement("b"));
    expect(frag.nodeType).toBe(DOCUMENT_FRAGMENT_NODE);
    doc.body.appendChild(frag);
    expect(doc.body.childNodes.length).toBe(2);
    expect(frag.childNodes.length).toBe(0);
    expect((doc.body.firstChild as { nodeName: string }).nodeName).toBe("A");
  });
});

describe("tree: convenience methods", () => {
  it("before/after insert relative to a node", () => {
    const doc = createDocument();
    const ref = doc.createElement("ref");
    doc.body.appendChild(ref);
    ref.before("start", doc.createElement("x"));
    ref.after(doc.createElement("y"), "end");
    const names = doc.body.childNodes;
    expect(names.item(0)?.nodeType).toBe(TEXT_NODE);
    expect(names.length).toBe(5);
  });

  it("replaceWith replaces the node", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    doc.body.appendChild(a);
    a.replaceWith("hello");
    expect(doc.body.firstChild?.nodeType).toBe(TEXT_NODE);
    expect(a.parentNode).toBeNull();
  });

  it("append/prepend add nodes and strings", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    p.append("world");
    p.prepend("hello ");
    expect(p.textContent).toBe("hello world");
  });

  it("replaceChildren clears and replaces", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    p.append(doc.createElement("a"), doc.createElement("b"));
    p.replaceChildren("only");
    expect(p.childNodes.length).toBe(1);
    expect(p.textContent).toBe("only");
  });
});

describe("tree: textContent & isConnected", () => {
  it("textContent concatenates descendant text", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    const span = doc.createElement("span");
    span.appendChild(doc.createTextNode("inner"));
    p.appendChild(doc.createTextNode("a"));
    p.appendChild(span);
    p.appendChild(doc.createComment("ignored"));
    expect(p.textContent).toBe("ainner");
  });

  it("setting textContent replaces children with one text node", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    p.append(doc.createElement("a"), doc.createElement("b"));
    p.textContent = "x";
    expect(p.childNodes.length).toBe(1);
    expect(p.firstChild?.nodeType).toBe(TEXT_NODE);
  });

  it("isConnected reflects attachment to the document", () => {
    const doc = createDocument();
    const a = doc.createElement("a");
    expect(a.isConnected).toBe(false);
    doc.body.appendChild(a);
    expect(a.isConnected).toBe(true);
    a.remove();
    expect(a.isConnected).toBe(false);
  });

  it("comment nodeType/value", () => {
    const doc = createDocument();
    const c = doc.createComment("hi");
    expect(c.nodeType).toBe(COMMENT_NODE);
    expect(c.nodeValue).toBe("hi");
    expect(c.nodeName).toBe("#comment");
  });

  it("element nodeType", () => {
    const doc = createDocument();
    expect(doc.createElement("div").nodeType).toBe(ELEMENT_NODE);
  });
});
