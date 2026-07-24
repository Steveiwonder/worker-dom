# worker-vdom

A lightweight, dependency-free virtual DOM that runs inside a browser Web
Worker. It gives you familiar DOM APIs — `createElement`, `setAttribute`,
`appendChild`, `querySelectorAll`, `classList`, `dataset`, `cloneNode`,
`innerHTML`/`outerHTML` — for building, mutating, querying, cloning, and
serializing an isolated document tree, with no reliance on `window` or the real
`document`.

It is ESM-only and has zero runtime dependencies.

## Installation

```bash
npm install worker-vdom
```

```js
import {
  createDocument,
  serialize,
  serializeHTML,
  serializeXML,
  parseFragment,
} from "worker-vdom";
```

> During local development of this repo the entry point is the built output in
> `dist/`, so the examples and benchmarks import from `../dist/index.js`. Run
> `npm run build` first.

## Quick start

Build an SVG tree and serialize it — no browser DOM involved:

```js
import { createDocument, SVG_NS } from "worker-vdom";

const document = createDocument();

const svg = document.createElementNS(SVG_NS, "svg");
svg.setAttribute("viewBox", "0 0 100 100");

const circle = document.createElementNS(SVG_NS, "circle");
circle.setAttribute("cx", "50");
circle.setAttribute("cy", "50");
circle.setAttribute("r", "40");

svg.appendChild(circle);
document.body.appendChild(svg);

console.log(document.documentElement.outerHTML);
// <html><head></head><body><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"></circle></svg></body></html>
```

## HTML mode vs XML mode

`createDocument(options?)` accepts `{ mode?: "html" | "xml" }`.

- **`"html"` (default)** pre-populates the document with
  `<!DOCTYPE html><html><head></head><body></body></html>`, folds element and
  attribute names to lowercase (so `tagName` reports uppercase, and attribute
  lookups are case-insensitive), recognizes void elements (`<br>`, `<img>`, …)
  and raw-text elements (`<script>`, `<style>`), and puts elements in the HTML
  namespace.
- **`"xml"`** creates an empty document — no doctype, no `<html>`/`<head>`/
  `<body>` — preserves the exact case of names, gives elements no namespace by
  default, and self-closes empty elements (`<Flag/>`).

```js
const html = createDocument();               // has document.body
const xml = createDocument({ mode: "xml" });  // document.body === null
```

See [`docs/html-vs-xml.md`](docs/html-vs-xml.md) for the full breakdown of case
sensitivity, void elements, self-closing serialization, escaping, and the
auto-populated tree.

## Namespaces

Elements and attributes are namespace-aware. Elements expose `namespaceURI`,
`prefix`, and `localName`; attributes can be set and read by namespace.

```js
import { createDocument, SVG_NS, XLINK_NS } from "worker-vdom";

const doc = createDocument();

const rect = doc.createElementNS(SVG_NS, "svg:rect");
rect.namespaceURI; // SVG_NS
rect.prefix;       // "svg"
rect.localName;    // "rect"

const use = doc.createElementNS(SVG_NS, "use");
use.setAttributeNS(XLINK_NS, "xlink:href", "#icon");
use.getAttributeNS(XLINK_NS, "href"); // "#icon"
use.hasAttributeNS(XLINK_NS, "href"); // true
use.outerHTML;                        // '<use xlink:href="#icon"></use>'  (prefix preserved)
```

The exported namespace constants are `HTML_NS`, `SVG_NS`, `MATHML_NS`,
`XML_NS`, `XMLNS_NS`, and `XLINK_NS`. Invalid qualified names throw a
`DOMException` (`InvalidCharacterError` or `NamespaceError`). When parsing HTML,
`<svg>` and `<math>` automatically switch their subtrees into the SVG / MathML
namespaces. Full details are in [`docs/namespaces.md`](docs/namespaces.md).

### Selectors supported

`querySelector`, `querySelectorAll`, `matches`, and `closest` accept a
practical subset of CSS Selectors:

- **Simple selectors:** universal `*`, type `div` (with optional namespace
  prefix syntax `ns|tag`, `*|tag`, `|tag` — matched by local name), id `#id`,
  class `.cls`.
- **Attribute selectors:** `[attr]`, `[attr=val]`, `[attr~=val]`, `[attr|=val]`,
  `[attr^=val]`, `[attr$=val]`, `[attr*=val]`, plus the case flags `i` and `s`.
- **Combinators:** descendant (space), child `>`, adjacent sibling `+`, general
  sibling `~`.
- **Selector lists:** comma-separated (`a, b, c`).
- **Pseudo-classes:** `:first-child`, `:last-child`, `:only-child`,
  `:first-of-type`, `:last-of-type`, `:empty`, `:root`, `:not()`, `:is()`,
  `:where()`, `:nth-child()`, `:nth-last-child()` (including `odd`, `even`, and
  `An+B`).

Type selectors are case-insensitive for HTML elements. Any pseudo-class not in
the list above (for example `:hover`, `:checked`) never matches, and
pseudo-elements are not supported. An unparseable selector throws a
`DOMException` (`SyntaxError`).

## Collections are snapshots

Every collection this library returns — `childNodes`, `children`,
`querySelectorAll`, `getElementsBy*`-style results, and the `attributes`
`NamedNodeMap` — is a **static snapshot** taken at the moment of the call. Unlike
the browser DOM, they do **not** update when the tree changes afterward:

```js
const items = list.querySelectorAll("li");
list.appendChild(doc.createElement("li"));
items.length; // unchanged — still the count from when the query ran
```

Re-run the query to get current results. This keeps behavior predictable and
avoids the surprises of live collections.

## Web Worker usage

The library never touches `window` or the real `document`, so it runs happily
on a worker thread. Build a tree in the worker, then post a serialized string
back to the page:

```js
// worker.js  (a module worker)
import { createDocument } from "worker-vdom";

self.onmessage = (event) => {
  const { id, text } = event.data;

  const doc = createDocument();
  const section = doc.createElement("section");
  section.dataset.id = String(id);
  section.textContent = text;
  doc.body.appendChild(section);

  self.postMessage(section.outerHTML);
};
```

```js
// main thread
const worker = new Worker("./worker.js", { type: "module" });
worker.onmessage = (e) => {
  document.getElementById("out").innerHTML = e.data;
};
worker.postMessage({ id: 1, text: "Built off the main thread" });
```

Libraries that render SVG but expect browser globals can opt into the
compatibility surface before importing the renderer:

```js
import { createDocument, installDOMGlobals } from "worker-vdom";

const document = createDocument();
installDOMGlobals(document);

// Import DOM-dependent renderers after the globals have been installed.
const renderer = await import("./renderer.js");
```

`installDOMGlobals` fills missing globals by default. Pass
`{ overwrite: true }` to replace existing implementations, or
`{ target: sandbox }` to install them on a specific worker-like object. It
includes SVG animated values and transforms, style reflection, event targets,
`DOMParser`, `XMLSerializer`, animation-frame scheduling, and the common
`SVG*Element` constructors used for `instanceof` checks. It is explicitly
installed and has no import-time side effects.

A complete, runnable version is in [`examples/`](examples/) (see
[`examples/README.md`](examples/README.md)), along with a plain-Node demo
(`examples/node-demo.mjs`).

## DOM API support

Three states: **Supported** (works like the browser for the common cases),
**Partial** (implemented with documented differences), **Unsupported** (out of
scope — never provided).

### Node

| API | State | Notes |
| --- | --- | --- |
| `nodeType`, `nodeName`, `ownerDocument`, `isConnected` | Supported | |
| `parentNode`, `parentElement`, `firstChild`, `lastChild`, `previousSibling`, `nextSibling` | Supported | |
| `childNodes` | Partial | static snapshot, not live |
| `textContent` (get/set) | Supported | |
| `nodeValue` | Partial | meaningful on Text/Comment; `null` on elements |
| `hasChildNodes`, `contains` | Supported | |
| `appendChild`, `insertBefore`, `removeChild`, `replaceChild`, `remove` | Supported | pre-insertion validity enforced |
| `before`, `after`, `replaceWith`, `append`, `prepend`, `replaceChildren` | Supported | accept nodes and strings |
| `cloneNode(deep?)` | Supported | shallow and deep |
| `addEventListener`, `removeEventListener`, `dispatchEvent` | Partial | local EventTarget behavior; no capture/bubble traversal |

### Element

| API | State | Notes |
| --- | --- | --- |
| `tagName`, `localName`, `prefix`, `namespaceURI` | Supported | |
| `id`, `className` | Supported | reflected attributes |
| `classList` (`DOMTokenList`) | Supported | stays synced with the `class` attribute |
| `dataset` (`DOMStringMap`) | Supported | stays synced with `data-*` attributes |
| `getAttribute`, `setAttribute`, `removeAttribute`, `hasAttribute`, `toggleAttribute` | Supported | |
| `getAttributeNS`, `setAttributeNS`, `removeAttributeNS`, `hasAttributeNS` | Supported | |
| `getAttributeNames`, `hasAttributes` | Supported | |
| `attributes` (`NamedNodeMap`) | Partial | read-only static snapshot with `item`/`getNamedItem`/`getNamedItemNS` |
| `children`, `childElementCount`, `firstElementChild`, `lastElementChild`, `previousElementSibling`, `nextElementSibling` | Supported | `children` is a snapshot |
| `innerHTML`, `outerHTML` (get/set) | Partial | serializer is exact; parser is a practical subset (below) |
| `insertAdjacentHTML`, `insertAdjacentElement`, `insertAdjacentText` | Supported | |
| `matches`, `closest`, `querySelector`, `querySelectorAll` | Partial | selector subset (see above) |
| `style` (`CSSStyleDeclaration`) | Partial | attribute-backed declarations; no cascade or stylesheet evaluation |
| SVG animated values, transforms, matrices | Partial | reflected values required by SVG renderers; no animation engine |
| `getBBox`, `getBoundingClientRect`, `clientWidth`/`clientHeight`, `offsetWidth`/`offsetHeight` | Partial | derived from SVG geometry attributes/viewBox; no layout engine |

### Document

| API | State | Notes |
| --- | --- | --- |
| `createElement`, `createElementNS`, `createTextNode`, `createComment`, `createDocumentFragment`, `createDocumentType` | Supported | |
| `documentElement`, `doctype`, `head`, `body` | Supported | `head`/`body` are `null` in XML mode until you build them |
| `getElementById` | Supported | |
| `getElementsByTagName`, `getElementsByTagNameNS`, `getElementsByClassName` | Partial | static snapshots |
| `querySelector`, `querySelectorAll` | Partial | selector subset |
| `importNode`, `adoptNode` | Supported | |
| `implementation.hasFeature` | Partial | compatibility method; always returns `true` |
| `defaultView` | Partial | populated by `installDOMGlobals` |
| `mode` | Supported | `"html"` or `"xml"`, read-only |

### Other

| Area | State | Notes |
| --- | --- | --- |
| `VText` / `VComment` character data (`data`, `length`, `appendData`, `wholeText`) | Supported | |
| `parseFragment` / setting `innerHTML` | Partial | handles nested elements, text, comments, quoted/boolean/unquoted attributes, self-closing/void elements, entities, and raw text; does not reproduce every WHATWG parse-error recovery rule |
| Collections (`childNodes`, `children`, query results, `NamedNodeMap`) | Partial | static snapshots, not live |
| `DOMException` | Partial | a bundled class with stable `name` values, not the engine's native `DOMException` |
| Foreign-node insertion | Supported | nodes from another document are **auto-adopted** on insert |
| `installDOMGlobals` | Partial | opt-in worker globals for DOM-dependent SVG renderers |
| `DOMParser` / `XMLSerializer` | Partial | practical HTML/XML parser and XML serializer |

### Out of scope (Unsupported)

These are intentionally **not** implemented — the goal is a document tree and
an SVG-rendering compatibility layer, not a browser:

- Event capture/bubbling/default browser actions
- CSS cascade, stylesheet loading, selector matching for style rules
- Browser layout and text measurement (`offsetTop`/`offsetLeft` and computed
  flow layout); geometry methods only reflect explicit SVG values
- Scrolling, focus, and selection
- Forms (submission, validation, form state)
- Media elements, canvas, and `2d`/`webgl` contexts
- Navigation and history (`installDOMGlobals` only supplies a read-only-shaped
  location placeholder when the host has none)
- Custom elements and the shadow DOM
- `MutationObserver`
- Script execution (`<script>` content is stored as text, never run)

## Differences from the browser DOM

- **Collections are static snapshots, not live** (see above).
- **`DOMException` is a bundled class**, not the environment's native one. Its
  `name` values are stable: `HierarchyRequestError`, `NotFoundError`,
  `InvalidCharacterError`, `NamespaceError`, `SyntaxError`, `NotSupportedError`
  (plus legacy numeric `code`s). Check `err.name`, not `instanceof` against the
  global.
- **The HTML parser is a practical subset** of the WHATWG algorithm. It does not
  perform full error-recovery/tree-construction (e.g. implied `<tbody>`, auto
  paragraph closing).
- **The selector engine is a subset** of CSS Selectors (listed above).
  Unsupported pseudo-classes simply never match.
- **Foreign nodes are auto-adopted.** Inserting a node created by a different
  document re-owns it (and its subtree) into the destination document instead of
  throwing `WrongDocumentError`.
- **No live rendering surface** — everything is out of scope per the list above.

## Scripts

```bash
npm run build       # compile TypeScript to dist/ (ESM + .d.ts)
npm test            # run the unit tests (Vitest, Node environment)
npm run test:watch  # Vitest in watch mode
npm run test:browser# Playwright specs comparing a subset against a real browser DOM (build first)
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
npm run bench       # run the benchmarks (build first)
```

Benchmarks live in [`benchmarks/`](benchmarks/) and cover element creation,
fragment appends, attribute setting, deep cloning, serialization, and selector
queries. They print raw per-machine timings and ops/sec — build first, then
`npm run bench`. See [`benchmarks/README.md`](benchmarks/README.md).

## License

MIT © steveiwonder
