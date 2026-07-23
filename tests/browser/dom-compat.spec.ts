import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Browser compatibility suite.
 *
 * These tests bundle the BUILT library (`dist/index.js`) into a single IIFE and
 * inject it into a real Chromium page as `window.WorkerVDOM`, then compare a
 * supported subset of behaviors against the browser's own native DOM. They
 * intentionally only assert on APIs the library claims to support — never on
 * out-of-scope features (events, layout, CSS, etc.).
 *
 * Run `npm run build` first so `dist/` exists.
 */
const here = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(here, "../../dist/index.js");

let bundle = "";

test.beforeAll(async () => {
  if (!existsSync(distEntry)) {
    throw new Error(
      `Missing ${distEntry}. Run "npm run build" before the browser tests.`,
    );
  }
  const result = await build({
    entryPoints: [distEntry],
    bundle: true,
    format: "iife",
    globalName: "WorkerVDOM",
    write: false,
  });
  // Playwright wraps init scripts in a function scope, so esbuild's top-level
  // `var WorkerVDOM` would not become a page global. Attach it explicitly.
  bundle = result.outputFiles[0].text + "\nglobalThis.WorkerVDOM = WorkerVDOM;";
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ content: bundle });
  await page.goto("about:blank");
});

test("built tree serialization matches the native DOM", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const ours = createDocument();
    const div = ours.createElement("div");
    div.setAttribute("id", "x");
    div.setAttribute("class", "a b");
    const span = ours.createElement("span");
    span.textContent = "hi";
    div.appendChild(span);

    const nativeDiv = document.createElement("div");
    nativeDiv.setAttribute("id", "x");
    nativeDiv.setAttribute("class", "a b");
    const nativeSpan = document.createElement("span");
    nativeSpan.textContent = "hi";
    nativeDiv.appendChild(nativeSpan);

    return { ours: div.outerHTML, native: nativeDiv.outerHTML };
  });
  expect(result.ours).toBe(result.native);
});

test("HTML tag/attribute case behavior matches native", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const ours = createDocument();
    const o = ours.createElement("DIV");
    o.setAttribute("DATA-Foo", "1");
    const n = document.createElement("DIV");
    n.setAttribute("DATA-Foo", "1");
    return {
      ourTag: o.tagName,
      nativeTag: n.tagName,
      ourLocal: o.localName,
      nativeLocal: n.localName,
      ourAttr: o.getAttribute("data-foo"),
      nativeAttr: n.getAttribute("data-foo"),
      ourNames: o.getAttributeNames(),
      nativeNames: n.getAttributeNames(),
    };
  });
  expect(result.ourTag).toBe(result.nativeTag);
  expect(result.ourLocal).toBe(result.nativeLocal);
  expect(result.ourAttr).toBe(result.nativeAttr);
  expect(result.ourNames).toEqual(result.nativeNames);
});

test("attribute values are stringified like native", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const o = createDocument().createElement("div");
    o.setAttribute("data-count", 12 as unknown as string);
    const n = document.createElement("div");
    n.setAttribute("data-count", 12 as unknown as string);
    return { ours: o.getAttribute("data-count"), native: n.getAttribute("data-count") };
  });
  expect(result.ours).toBe(result.native);
});

test("classList stays in sync like native", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const run = (el: any) => {
      el.classList.add("a", "b");
      el.classList.toggle("a");
      el.classList.add("c");
      el.classList.replace("b", "z");
      return el.getAttribute("class");
    };
    return {
      ours: run(createDocument().createElement("div")),
      native: run(document.createElement("div")),
    };
  });
  expect(result.ours).toBe(result.native);
});

test("dataset mapping matches native", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const run = (el: any) => {
      el.dataset.userId = "42";
      el.dataset.fooBar = "x";
      return {
        attr1: el.getAttribute("data-user-id"),
        attr2: el.getAttribute("data-foo-bar"),
        keys: Object.keys(el.dataset).sort(),
      };
    };
    return {
      ours: run(createDocument().createElement("div")),
      native: run(document.createElement("div")),
    };
  });
  expect(result.ours).toEqual(result.native);
});

test("querySelectorAll matches native for a parsed subtree", async ({ page }) => {
  const html =
    '<section><ul><li class="i">a</li><li class="i">b</li><li>c</li></ul><p>hi <b>x</b></p></section>';
  const result = await page.evaluate((markup) => {
    const { createDocument } = (window as any).WorkerVDOM;
    const ours = createDocument().createElement("div");
    ours.innerHTML = markup;
    const nat = document.createElement("div");
    nat.innerHTML = markup;
    const count = (root: any, sel: string) => root.querySelectorAll(sel).length;
    const sels = ["li", "li.i", "ul > li", "li:first-child", "li:nth-child(2)", "p b"];
    return {
      ours: sels.map((s) => count(ours, s)),
      native: sels.map((s) => count(nat, s)),
    };
  }, html);
  expect(result.ours).toEqual(result.native);
});

test("cloneNode(true) preserves structure like native", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createDocument } = (window as any).WorkerVDOM;
    const build = (el: any) => {
      el.innerHTML = "<p><b>hi</b> there</p>";
      return el.cloneNode(true).outerHTML;
    };
    return {
      ours: build(createDocument().createElement("div")),
      native: build(document.createElement("div")),
    };
  });
  expect(result.ours).toBe(result.native);
});
