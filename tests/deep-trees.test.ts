import { describe, it, expect } from "vitest";
import { createDocument, serializeHTML } from "../src/index.js";

describe("large and deep trees", () => {
  it("builds a tree of 100,000 elements", () => {
    const doc = createDocument();
    const root = doc.createElement("div");
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < 100_000; i++) {
      const el = doc.createElement("span");
      el.setAttribute("data-i", String(i));
      frag.appendChild(el);
    }
    root.appendChild(frag);
    expect(root.childNodes.length).toBe(100_000);
    expect(root.childElementCount).toBe(100_000);
  });

  it("handles a deeply nested tree without stack overflow", () => {
    const doc = createDocument();
    const root = doc.createElement("div");
    let current = root;
    const DEPTH = 20_000;
    for (let i = 0; i < DEPTH; i++) {
      const child = doc.createElement("div");
      current.appendChild(child);
      current = child;
    }
    current.textContent = "deep";

    // contains walks up; should not overflow
    expect(root.contains(current)).toBe(true);
    // textContent traversal is iterative
    expect(root.textContent).toBe("deep");
    // serialization is iterative
    const html = serializeHTML(root);
    expect(html.startsWith("<div>".repeat(10))).toBe(true);
    expect(html.endsWith("</div>".repeat(10))).toBe(true);
    // deep clone is iterative
    const clone = root.cloneNode(true);
    expect(clone.textContent).toBe("deep");
  });

  it("serializes a large tree", () => {
    const doc = createDocument();
    const root = doc.createElement("ul");
    for (let i = 0; i < 20_000; i++) {
      const li = doc.createElement("li");
      li.textContent = "item " + i;
      root.appendChild(li);
    }
    const html = serializeHTML(root);
    expect(html.length).toBeGreaterThan(100_000);
    expect((html.match(/<li>/g) ?? []).length).toBe(20_000);
  });

  it("runs selectors over a large tree", () => {
    const doc = createDocument();
    const root = doc.createElement("div");
    doc.body.appendChild(root);
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < 10_000; i++) {
      const el = doc.createElement("p");
      if (i % 2 === 0) el.className = "even";
      frag.appendChild(el);
    }
    root.appendChild(frag);
    expect(root.querySelectorAll("p").length).toBe(10_000);
    expect(root.querySelectorAll("p.even").length).toBe(5_000);
    expect(root.querySelectorAll("div > p").length).toBe(10_000);
  });
});
