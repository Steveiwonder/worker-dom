import { describe, it, expect, afterEach } from "vitest";

/**
 * Verifies the library never touches DOM globals. We delete `window` and
 * `document` from `globalThis` before importing and using the library, and
 * also install throwing traps to catch any accidental access.
 */
describe("Web Worker compatibility", () => {
  const saved = {
    window: (globalThis as Record<string, unknown>).window,
    document: (globalThis as Record<string, unknown>).document,
  };

  afterEach(() => {
    (globalThis as Record<string, unknown>).window = saved.window;
    (globalThis as Record<string, unknown>).document = saved.document;
  });

  it("works with window/document removed from globalThis", async () => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).document;
    expect((globalThis as Record<string, unknown>).document).toBeUndefined();

    const { createDocument, serializeHTML } = await import("../src/index.js");
    const document = createDocument();
    const el = document.createElement("section");
    el.setAttribute("data-id", "42");
    el.textContent = "hello worker";
    document.body.appendChild(el);

    expect(el.outerHTML).toBe('<section data-id="42">hello worker</section>');
    expect(serializeHTML(document)).toContain("hello worker");
  });

  it("does not read from a booby-trapped window/document", async () => {
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error("library accessed a DOM global");
        },
      },
    );
    (globalThis as Record<string, unknown>).window = trap;
    (globalThis as Record<string, unknown>).document = trap;

    const { createDocument } = await import("../src/index.js");
    expect(() => {
      const doc = createDocument();
      const div = doc.createElement("div");
      div.innerHTML = '<p class="x">hi</p>';
      div.querySelectorAll("p");
      div.cloneNode(true);
      div.outerHTML;
    }).not.toThrow();
  });

  it("mirrors the documented worker example shape", async () => {
    const { createDocument } = await import("../src/index.js");
    const document = createDocument();

    // Simulate: self.onmessage = ({ data }) => { ... self.postMessage({ html }) }
    const handle = (data: { id: string; text: string }) => {
      const root = document.createElement("section");
      root.setAttribute("data-id", data.id);
      root.textContent = data.text;
      return { html: root.outerHTML };
    };

    expect(handle({ id: "7", text: "hi" })).toEqual({
      html: '<section data-id="7">hi</section>',
    });
  });
});
