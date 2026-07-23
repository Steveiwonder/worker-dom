import { describe, it, expect } from "vitest";
import { createDocument, DOMException, SVG_NS } from "../src/index.js";

describe("cloning", () => {
  it("shallow clone copies node without children", () => {
    const doc = createDocument();
    const div = doc.createElement("div");
    div.setAttribute("id", "x");
    div.appendChild(doc.createElement("span"));
    const clone = div.cloneNode(false);
    expect(clone.childNodes.length).toBe(0);
    expect((clone as typeof div).getAttribute("id")).toBe("x");
    expect(clone).not.toBe(div);
  });

  it("deep clone copies the whole subtree", () => {
    const doc = createDocument();
    const div = doc.createElement("div");
    div.innerHTML = "<p><b>hi</b> there</p>";
    const clone = div.cloneNode(true) as typeof div;
    expect(clone.outerHTML).toBe(div.outerHTML);
    // independence: mutate original, clone unaffected
    div.querySelector("b")!.textContent = "bye";
    expect(clone.querySelector("b")!.textContent).toBe("hi");
  });

  it("clone preserves namespaces and attributes", () => {
    const doc = createDocument();
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 1 1");
    const clone = svg.cloneNode(true) as typeof svg;
    expect(clone.namespaceURI).toBe(SVG_NS);
    expect(clone.getAttribute("viewBox")).toBe("0 0 1 1");
  });

  it("cloned text nodes keep data", () => {
    const doc = createDocument();
    const t = doc.createTextNode("hello");
    const c = t.cloneNode() as typeof t;
    expect(c.nodeValue).toBe("hello");
  });
});

describe("document ownership, import & adopt", () => {
  it("created nodes are owned by the document", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    expect(el.ownerDocument).toBe(doc);
    expect(doc.ownerDocument).toBeNull();
  });

  it("importNode copies a node into this document", () => {
    const a = createDocument();
    const b = createDocument();
    const src = a.createElement("div");
    src.innerHTML = "<span>x</span>";
    const imported = b.importNode(src, true);
    expect(imported.ownerDocument).toBe(b);
    expect(imported.querySelector("span")?.ownerDocument).toBe(b);
    // original untouched
    expect(src.ownerDocument).toBe(a);
    expect(imported).not.toBe(src);
  });

  it("importNode shallow ignores children", () => {
    const a = createDocument();
    const b = createDocument();
    const src = a.createElement("div");
    src.appendChild(a.createElement("span"));
    const imported = b.importNode(src, false);
    expect(imported.childNodes.length).toBe(0);
  });

  it("adoptNode moves a node and re-owns its subtree", () => {
    const a = createDocument();
    const b = createDocument();
    const el = a.createElement("div");
    el.appendChild(a.createElement("span"));
    a.body.appendChild(el);
    const adopted = b.adoptNode(el);
    expect(adopted).toBe(el);
    expect(el.parentNode).toBeNull();
    expect(el.ownerDocument).toBe(b);
    expect(el.firstChild?.ownerDocument).toBe(b);
  });

  it("inserting a foreign node auto-adopts it", () => {
    const a = createDocument();
    const b = createDocument();
    const el = a.createElement("div");
    b.body.appendChild(el);
    expect(el.ownerDocument).toBe(b);
    expect(el.isConnected).toBe(true);
  });

  it("importNode/adoptNode reject documents", () => {
    const a = createDocument();
    const b = createDocument();
    expect(() => b.importNode(a as never, true)).toThrowError(DOMException);
    expect(() => b.adoptNode(a as never)).toThrowError(DOMException);
  });
});
