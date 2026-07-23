import { describe, it, expect } from "vitest";
import { createDocument, DOMException } from "../src/index.js";

function setup() {
  const doc = createDocument();
  doc.body.innerHTML = `
    <section id="main" class="wrap">
      <h1>Title</h1>
      <ul class="list">
        <li class="item first" data-k="1">a</li>
        <li class="item" data-k="2">b</li>
        <li class="item last" data-k="3">c</li>
      </ul>
      <p>hello <span>world</span></p>
      <div class="empty"></div>
    </section>`;
  return doc;
}

describe("selectors: querySelector/All", () => {
  it("universal, tag, id, class", () => {
    const doc = setup();
    expect(doc.querySelectorAll("*").length).toBeGreaterThan(5);
    expect(doc.querySelector("h1")?.textContent).toBe("Title");
    expect(doc.querySelector("#main")?.tagName).toBe("SECTION");
    expect(doc.querySelectorAll(".item").length).toBe(3);
  });

  it("attribute existence and equality", () => {
    const doc = setup();
    expect(doc.querySelectorAll("[data-k]").length).toBe(3);
    expect(doc.querySelector('[data-k="2"]')?.textContent).toBe("b");
  });

  it("attribute operators ^= $= *= ~= |=", () => {
    const doc = createDocument();
    doc.body.innerHTML =
      '<a class="x y" href="https://a.com" lang="en-US"></a>';
    const a = doc.querySelector("a")!;
    expect(a.matches('[href^="https"]')).toBe(true);
    expect(a.matches('[href$=".com"]')).toBe(true);
    expect(a.matches('[href*="a.c"]')).toBe(true);
    expect(a.matches('[class~="y"]')).toBe(true);
    expect(a.matches('[lang|="en"]')).toBe(true);
  });

  it("descendant, child, adjacent, general sibling", () => {
    const doc = setup();
    expect(doc.querySelectorAll("ul li").length).toBe(3);
    expect(doc.querySelectorAll("ul > li").length).toBe(3);
    expect(doc.querySelectorAll("section > li").length).toBe(0);
    expect(doc.querySelectorAll("h1 + ul").length).toBe(1);
    expect(doc.querySelectorAll("h1 ~ p").length).toBe(1);
    expect(doc.querySelector("p > span")?.textContent).toBe("world");
  });

  it("selector groups", () => {
    const doc = setup();
    expect(doc.querySelectorAll("h1, p").length).toBe(2);
  });

  it(":first-child :last-child :only-child :empty :root", () => {
    const doc = setup();
    expect(doc.querySelector("li:first-child")?.textContent).toBe("a");
    expect(doc.querySelector("li:last-child")?.textContent).toBe("c");
    expect(doc.querySelectorAll("li:only-child").length).toBe(0);
    expect(doc.querySelector(".empty:empty")).toBeTruthy();
    expect(doc.querySelector(":root")?.tagName).toBe("HTML");
  });

  it(":nth-child", () => {
    const doc = setup();
    expect(doc.querySelector("li:nth-child(2)")?.textContent).toBe("b");
    expect(doc.querySelectorAll("li:nth-child(odd)").length).toBe(2);
    expect(doc.querySelectorAll("li:nth-child(even)").length).toBe(1);
    expect(doc.querySelectorAll("li:nth-child(2n+1)").length).toBe(2);
  });

  it(":not, :is, :where", () => {
    const doc = setup();
    expect(doc.querySelectorAll("li:not(.first)").length).toBe(2);
    expect(doc.querySelectorAll(":is(h1, .empty)").length).toBe(2);
    expect(doc.querySelectorAll(":where(li.first)").length).toBe(1);
  });

  it("matches and closest", () => {
    const doc = setup();
    const li = doc.querySelector("li.last")!;
    expect(li.matches("li.item")).toBe(true);
    expect(li.matches("h1")).toBe(false);
    expect(li.closest("ul")?.tagName).toBe("UL");
    expect(li.closest("#main")?.id).toBe("main");
    expect(li.closest(".nope")).toBeNull();
  });

  it("scoped element.querySelectorAll", () => {
    const doc = setup();
    const ul = doc.querySelector("ul")!;
    expect(ul.querySelectorAll("li").length).toBe(3);
    expect(ul.querySelector(".first")?.textContent).toBe("a");
  });

  it("querySelectorAll returns a static, indexable, iterable list", () => {
    const doc = setup();
    const list = doc.querySelectorAll("li");
    expect(list.length).toBe(3);
    expect(list[0]).toBe(list.item(0));
    expect([...list].length).toBe(3);
    const collected: string[] = [];
    list.forEach((el) => collected.push(el.textContent ?? ""));
    expect(collected).toEqual(["a", "b", "c"]);
  });

  it("handles :nth-child over a large flat sibling list efficiently", () => {
    // Regression: positional pseudo-classes must not be O(n^2) on wide trees.
    const doc = createDocument();
    const root = doc.createElement("section");
    const frag = doc.createDocumentFragment();
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const el = doc.createElement(i % 2 === 0 ? "li" : "span");
      frag.appendChild(el);
    }
    root.appendChild(frag);

    const start = Date.now();
    // li elements sit at even 0-based positions => odd 1-based indices, so
    // li:nth-child(2n) (even 1-based) matches none; li:nth-child(2n+1) matches all li.
    expect(root.querySelectorAll("li:nth-child(2n)").length).toBe(0);
    expect(root.querySelectorAll("li:nth-child(odd)").length).toBe(N / 2);
    expect(root.querySelectorAll("li:first-child").length).toBe(1);
    expect(root.querySelectorAll("span:last-child").length).toBe(1);
    // Should finish in well under a second; generous bound to avoid flakiness.
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it("invalid selector throws SyntaxError", () => {
    const doc = setup();
    try {
      doc.querySelector("###");
      throw new Error("should throw");
    } catch (e) {
      expect((e as DOMException).name).toBe("SyntaxError");
    }
  });
});
