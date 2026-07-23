import { describe, it, expect } from "vitest";
import {
  createDocument,
  DOMException,
  SVG_NS,
  XLINK_NS,
  XML_NS,
  HTML_NS,
} from "../src/index.js";

describe("attributes: basics", () => {
  it("stringifies attribute values", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("data-count", 12 as unknown as string);
    expect(el.getAttribute("data-count")).toBe("12");
    el.setAttribute("data-flag", true as unknown as string);
    expect(el.getAttribute("data-flag")).toBe("true");
  });

  it("has/remove/getAttributeNames", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("a", "1");
    el.setAttribute("b", "2");
    expect(el.hasAttribute("a")).toBe(true);
    expect(el.getAttributeNames()).toEqual(["a", "b"]);
    el.removeAttribute("a");
    expect(el.hasAttribute("a")).toBe(false);
    expect(el.getAttributeNames()).toEqual(["b"]);
  });

  it("toggleAttribute", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    expect(el.toggleAttribute("hidden")).toBe(true);
    expect(el.hasAttribute("hidden")).toBe(true);
    expect(el.toggleAttribute("hidden")).toBe(false);
    expect(el.hasAttribute("hidden")).toBe(false);
    expect(el.toggleAttribute("x", true)).toBe(true);
    expect(el.toggleAttribute("x", true)).toBe(true);
    expect(el.toggleAttribute("x", false)).toBe(false);
  });

  it("attributes NamedNodeMap is a snapshot", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("a", "1");
    const attrs = el.attributes;
    expect(attrs.length).toBe(1);
    expect(attrs[0].name).toBe("a");
    expect(attrs.item(0)?.value).toBe("1");
    expect(attrs.getNamedItem("a")?.value).toBe("1");
    el.setAttribute("b", "2");
    // snapshot did not grow
    expect(attrs.length).toBe(1);
    expect([...el.attributes].map((a) => a.name)).toEqual(["a", "b"]);
  });

  it("id and className reflect attributes", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.id = "foo";
    el.className = "a b";
    expect(el.getAttribute("id")).toBe("foo");
    expect(el.getAttribute("class")).toBe("a b");
    el.setAttribute("id", "bar");
    expect(el.id).toBe("bar");
  });

  it("invalid attribute name throws InvalidCharacterError", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    try {
      el.setAttribute("bad name", "x");
      throw new Error("should throw");
    } catch (e) {
      expect((e as DOMException).name).toBe("InvalidCharacterError");
    }
  });
});

describe("attributes: HTML case-insensitivity", () => {
  it("HTML attribute names are lowercased", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("DATA-Foo", "1");
    expect(el.getAttribute("data-foo")).toBe("1");
    expect(el.getAttribute("DATA-FOO")).toBe("1");
    expect(el.getAttributeNames()).toEqual(["data-foo"]);
  });

  it("HTML tag names uppercase for tagName, lowercase localName", () => {
    const doc = createDocument();
    const el = doc.createElement("DIV");
    expect(el.tagName).toBe("DIV");
    expect(el.localName).toBe("div");
    expect(el.namespaceURI).toBe(HTML_NS);
  });
});

describe("attributes: namespaces", () => {
  it("setAttributeNS / getAttributeNS with xlink", () => {
    const doc = createDocument();
    const use = doc.createElementNS(SVG_NS, "use");
    use.setAttributeNS(XLINK_NS, "xlink:href", "#id");
    expect(use.getAttributeNS(XLINK_NS, "href")).toBe("#id");
    expect(use.getAttribute("xlink:href")).toBe("#id");
    const attr = use.attributes.getNamedItemNS(XLINK_NS, "href");
    expect(attr?.prefix).toBe("xlink");
    expect(attr?.localName).toBe("href");
    expect(attr?.name).toBe("xlink:href");
  });

  it("SVG attribute names preserve case", () => {
    const doc = createDocument();
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    expect(svg.getAttribute("viewBox")).toBe("0 0 10 10");
    expect(svg.getAttribute("viewbox")).toBeNull();
  });

  it("createElementNS captures prefix/localName/namespace", () => {
    const doc = createDocument();
    const el = doc.createElementNS(SVG_NS, "svg:rect");
    expect(el.prefix).toBe("svg");
    expect(el.localName).toBe("rect");
    expect(el.namespaceURI).toBe(SVG_NS);
    expect(el.tagName).toBe("svg:rect");
  });

  it("malformed qualified name throws", () => {
    const doc = createDocument();
    expect(() => doc.createElementNS(SVG_NS, "1bad")).toThrowError(DOMException);
    // prefix without namespace -> NamespaceError
    try {
      doc.createElementNS(null, "pre:fix");
      throw new Error("should throw");
    } catch (e) {
      expect((e as DOMException).name).toBe("NamespaceError");
    }
  });

  it("xml namespace attribute", () => {
    const doc = createDocument();
    const el = doc.createElementNS(SVG_NS, "text");
    el.setAttributeNS(XML_NS, "xml:lang", "en");
    expect(el.getAttributeNS(XML_NS, "lang")).toBe("en");
    expect(el.hasAttributeNS(XML_NS, "lang")).toBe(true);
    el.removeAttributeNS(XML_NS, "lang");
    expect(el.hasAttributeNS(XML_NS, "lang")).toBe(false);
  });
});
