// A module Web Worker that builds a DOM tree with worker-vdom and posts the
// serialized HTML back to the page. It never touches `window` or the real
// `document` — everything is the in-worker virtual DOM.
//
// The import path is relative to this file. When the project is served from
// its root, `../dist/index.js` resolves to the built library. Run
// `npm run build` first so `dist/` exists.
import { createDocument } from "../dist/index.js";

self.onmessage = (event) => {
  const { id, title, items } = event.data ?? {};

  const doc = createDocument();

  const section = doc.createElement("section");
  section.dataset.id = String(id ?? "0");
  section.setAttribute("aria-label", title ?? "section");

  const heading = doc.createElement("h2");
  heading.textContent = title ?? "Untitled";
  section.appendChild(heading);

  if (Array.isArray(items) && items.length) {
    const list = doc.createElement("ul");
    for (const item of items) {
      const li = doc.createElement("li");
      li.textContent = String(item);
      list.appendChild(li);
    }
    section.appendChild(list);
  }

  doc.body.appendChild(section);

  // Post the serialized markup for just the section we built.
  self.postMessage({
    id,
    outerHTML: section.outerHTML,
    documentHTML: doc.documentElement.outerHTML,
  });
};
