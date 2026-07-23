import { describe, it, expect } from "vitest";
import {
  createDocument,
  serialize,
  serializeHTML,
  serializeXML,
  SVG_NS,
  MATHML_NS,
  XLINK_NS,
} from "../src/index.js";

describe("serialization: HTML", () => {
  it("void elements have no closing tag", () => {
    const doc = createDocument();
    const br = doc.createElement("br");
    const img = doc.createElement("img");
    img.setAttribute("src", "x.png");
    expect(serializeHTML(br)).toBe("<br>");
    expect(serializeHTML(img)).toBe('<img src="x.png">');
  });

  it("non-void empty elements get a closing tag", () => {
    const doc = createDocument();
    const div = doc.createElement("div");
    expect(serializeHTML(div)).toBe("<div></div>");
  });

  it("escapes text content", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    p.textContent = "a < b & c > d";
    expect(serializeHTML(p)).toBe("<p>a &lt; b &amp; c &gt; d</p>");
  });

  it("preserves ordinary spaces but escapes U+00A0 as &nbsp;", () => {
    const doc = createDocument();
    const p = doc.createElement("p");
    p.textContent = "a b c";
    expect(serializeHTML(p)).toBe("<p>a b&nbsp;c</p>");
  });

  it("escapes attribute values", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("title", 'he said "hi" & <ok>');
    expect(serializeHTML(el)).toContain('title="he said &quot;hi&quot; &amp; <ok>"');
  });

  it("serializes comments", () => {
    const doc = createDocument();
    const c = doc.createComment("hello");
    expect(serializeHTML(c)).toBe("<!--hello-->");
  });

  it("raw text is not escaped in script/style", () => {
    const doc = createDocument();
    const s = doc.createElement("script");
    s.textContent = 'if (a < b && c > d) x("&");';
    expect(serializeHTML(s)).toBe('<script>if (a < b && c > d) x("&");</script>');
  });

  it("serializes a document fragment", () => {
    const doc = createDocument();
    const frag = doc.createDocumentFragment();
    frag.appendChild(doc.createElement("a"));
    frag.appendChild(doc.createTextNode("x"));
    expect(serializeHTML(frag)).toBe("<a></a>x");
  });

  it("serializes doctype and full document", () => {
    const doc = createDocument();
    const html = serializeHTML(doc);
    expect(html).toBe(
      "<!DOCTYPE html><html><head></head><body></body></html>",
    );
  });
});

describe("serialization: SVG / MathML in HTML", () => {
  it("SVG in HTML mode uses explicit close tags and preserves attr case", () => {
    const doc = createDocument();
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 10 10");
    const circle = doc.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", "4");
    svg.appendChild(circle);
    expect(serializeHTML(svg)).toBe(
      '<svg viewBox="0 0 10 10"><circle r="4"></circle></svg>',
    );
  });

  it("preserves namespaced attribute prefixes", () => {
    const doc = createDocument();
    const use = doc.createElementNS(SVG_NS, "use");
    use.setAttributeNS(XLINK_NS, "xlink:href", "#a");
    expect(serializeHTML(use)).toBe('<use xlink:href="#a"></use>');
  });

  it("serializes MathML element names", () => {
    const doc = createDocument();
    const math = doc.createElementNS(MATHML_NS, "math");
    const mi = doc.createElementNS(MATHML_NS, "mi");
    mi.textContent = "x";
    math.appendChild(mi);
    expect(serializeHTML(math)).toBe("<math><mi>x</mi></math>");
  });
});

describe("serialization: XML mode", () => {
  it("empty elements self-close in XML", () => {
    const doc = createDocument({ mode: "xml" });
    const root = doc.createElement("root");
    const child = doc.createElement("child");
    child.setAttribute("a", "1");
    root.appendChild(child);
    expect(serializeXML(root)).toBe('<root><child a="1"/></root>');
  });

  it("XML preserves element name case", () => {
    const doc = createDocument({ mode: "xml" });
    const el = doc.createElement("CamelCase");
    expect(el.tagName).toBe("CamelCase");
    expect(serializeXML(el)).toBe("<CamelCase/>");
  });

  it("serialize() defaults to HTML rules, {xml:true} switches", () => {
    const doc = createDocument();
    const div = doc.createElement("div");
    expect(serialize(div)).toBe("<div></div>");
    expect(serialize(div, { xml: true })).toBe("<div/>");
  });

  it("innerHTML/outerHTML round-trip through the parser", () => {
    const doc = createDocument();
    const container = doc.createElement("div");
    container.innerHTML = '<p class="a">hi <b>x</b></p><!--c-->';
    expect(container.innerHTML).toBe('<p class="a">hi <b>x</b></p><!--c-->');
    expect(container.outerHTML).toBe(
      '<div><p class="a">hi <b>x</b></p><!--c--></div>',
    );
  });
});
