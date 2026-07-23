import { describe, it, expect } from "vitest";
import { createDocument, parseFragment, SVG_NS, XLINK_NS } from "../src/index.js";

describe("parser: HTML subset", () => {
  it("parses nested elements and text", () => {
    const doc = createDocument();
    const frag = parseFragment("<div><p>hi <b>there</b></p></div>", doc);
    const div = frag.firstChild as ReturnType<typeof doc.createElement>;
    expect(div.tagName).toBe("DIV");
    expect(div.querySelector("b")?.textContent).toBe("there");
  });

  it("parses comments", () => {
    const doc = createDocument();
    const frag = parseFragment("<!--hi--><p>x</p>", doc);
    expect(frag.firstChild?.nodeType).toBe(8);
    expect(frag.firstChild?.nodeValue).toBe("hi");
  });

  it("parses quoted, unquoted and boolean attributes", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = '<input type="text" value=hello disabled required>';
    const input = el.querySelector("input")!;
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("value")).toBe("hello");
    expect(input.getAttribute("disabled")).toBe("");
    expect(input.hasAttribute("required")).toBe(true);
  });

  it("handles void elements", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = "a<br>b<img src=x>c";
    expect(el.querySelectorAll("br").length).toBe(1);
    expect(el.querySelectorAll("img").length).toBe(1);
    expect(el.textContent).toBe("abc");
  });

  it("handles self-closing XML syntax", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = "<span/><span/>";
    expect(el.querySelectorAll("span").length).toBe(2);
  });

  it("decodes common named and numeric entities", () => {
    const doc = createDocument();
    const el = doc.createElement("p");
    el.innerHTML = "a &amp; b &lt; c &gt; d &#65; &#x41; &copy;";
    expect(el.textContent).toBe("a & b < c > d A A ©");
  });

  it("treats script/style as raw text and does not execute", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = "<script>var x = 1 < 2 && 3 > 2;</script>";
    const script = el.querySelector("script")!;
    expect(script.textContent).toBe("var x = 1 < 2 && 3 > 2;");
    // raw text is not treated as child elements
    expect(script.children.length).toBe(0);
  });

  it("auto-namespaces svg content during HTML parsing", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = '<svg viewBox="0 0 1 1"><circle r="1"/></svg>';
    const svg = el.querySelector("svg")!;
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.querySelector("circle")?.namespaceURI).toBe(SVG_NS);
    expect(svg.getAttribute("viewBox")).toBe("0 0 1 1");
  });

  it("parses namespaced xlink attributes", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.innerHTML = '<svg><use xlink:href="#a"/></svg>';
    const use = el.querySelector("use")!;
    expect(use.getAttributeNS(XLINK_NS, "href")).toBe("#a");
  });

  it("recovers from unclosed tags without throwing", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    expect(() => (el.innerHTML = "<p>unclosed <b>bold")).not.toThrow();
    expect(el.querySelector("b")?.textContent).toBe("bold");
  });
});
