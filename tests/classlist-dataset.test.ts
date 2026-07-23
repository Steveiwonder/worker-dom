import { describe, it, expect } from "vitest";
import { createDocument } from "../src/index.js";

describe("classList synchronization", () => {
  it("add/remove/contains/toggle sync with class attribute", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.classList.add("a", "b");
    expect(el.getAttribute("class")).toBe("a b");
    expect(el.classList.contains("a")).toBe(true);
    expect(el.classList.length).toBe(2);
    el.classList.remove("a");
    expect(el.getAttribute("class")).toBe("b");
    expect(el.classList.toggle("c")).toBe(true);
    expect(el.classList.contains("c")).toBe(true);
    expect(el.classList.toggle("c")).toBe(false);
    expect(el.classList.contains("c")).toBe(false);
  });

  it("toggle with force", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    expect(el.classList.toggle("x", true)).toBe(true);
    expect(el.classList.toggle("x", true)).toBe(true);
    expect(el.classList.toggle("x", false)).toBe(false);
    expect(el.classList.contains("x")).toBe(false);
  });

  it("replace and value and item", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.className = "a b c";
    expect(el.classList.replace("b", "z")).toBe(true);
    expect(el.classList.value).toBe("a z c");
    expect(el.classList.item(1)).toBe("z");
    expect(el.classList.replace("nope", "q")).toBe(false);
  });

  it("reading classList reflects external class attribute change", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("class", "one two");
    expect([...el.classList]).toEqual(["one", "two"]);
    expect(el.classList.length).toBe(2);
  });

  it("dedupes tokens", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("class", "a a b");
    expect(el.classList.length).toBe(2);
    el.classList.add("a");
    expect(el.classList.value).toBe("a b");
  });
});

describe("dataset synchronization", () => {
  it("maps camelCase to data-* attributes", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.dataset.userId = "42";
    expect(el.getAttribute("data-user-id")).toBe("42");
    el.setAttribute("data-user-name", "sam");
    expect(el.dataset.userName).toBe("sam");
  });

  it("delete removes the attribute", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.dataset.fooBar = "1";
    expect(el.hasAttribute("data-foo-bar")).toBe(true);
    delete el.dataset.fooBar;
    expect(el.hasAttribute("data-foo-bar")).toBe(false);
  });

  it("enumerates data attributes as camelCase keys", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.setAttribute("data-a-b", "1");
    el.setAttribute("data-c", "2");
    el.setAttribute("class", "not-data");
    expect(Object.keys(el.dataset).sort()).toEqual(["aB", "c"]);
  });

  it("in operator works", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    el.dataset.x = "1";
    expect("x" in el.dataset).toBe(true);
    expect("y" in el.dataset).toBe(false);
  });

  it("values are stringified", () => {
    const doc = createDocument();
    const el = doc.createElement("div");
    (el.dataset as Record<string, unknown>).n = 5;
    expect(el.getAttribute("data-n")).toBe("5");
  });
});
