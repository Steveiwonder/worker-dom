# Examples

Small, runnable examples for `worker-vdom`. All of them import the **built**
library from `../dist`, so build once first:

```bash
npm run build
```

## `node-demo.mjs` — plain Node, no DOM globals

Builds a tree, queries it with selectors, adds namespaced SVG content, parses a
fragment, clones a subtree, and serializes in both HTML and XML mode. It uses
no `window` or real `document` — only Node's `console`.

```bash
node examples/node-demo.mjs
```

## `index.html` + `worker.js` — running inside a Web Worker

`worker.js` is a **module** Web Worker. It receives a message, builds a
`<section>` with worker-vdom entirely on the worker thread, and posts the
serialized `outerHTML` back. `index.html` starts the worker and displays the
result.

Because ES module imports and workers are involved, you must serve the files
over HTTP (opening `index.html` via `file://` will not work). Serve from the
**project root** so that `../dist/index.js` resolves correctly:

```bash
npm run build
# then, from the project root, start any static server, e.g.:
npx serve .
#   or:  python3 -m http.server 8080
```

Then open the printed URL and navigate to `/examples/index.html`.
