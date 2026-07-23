// A plain Node demo — no DOM globals, no `window`, no real `document`.
// Run it with:  node examples/node-demo.mjs   (after `npm run build`)
//
// It builds a tree, queries it with selectors, mutates it, and serializes it,
// exercising the parts of the API you would use inside a Web Worker.
import {
  createDocument,
  serializeHTML,
  serializeXML,
  parseFragment,
  SVG_NS,
} from "../dist/index.js";

// --- 1. Build an HTML document -------------------------------------------
const doc = createDocument();

const main = doc.createElement("main");
main.id = "app";

const list = doc.createElement("ul");
list.className = "todo-list";

for (const [i, label] of ["Write docs", "Add tests", "Ship it"].entries()) {
  const li = doc.createElement("li");
  li.classList.add("todo");
  if (i === 2) li.classList.add("last");
  li.dataset.index = String(i);
  li.textContent = label;
  list.appendChild(li);
}

main.appendChild(list);
doc.body.appendChild(main);

// --- 2. Query with selectors ---------------------------------------------
console.log("querySelectorAll('.todo') count:", doc.querySelectorAll(".todo").length);
console.log("querySelector('li:nth-child(2)') text:", doc.querySelector("li:nth-child(2)").textContent);
console.log("querySelector('.todo.last') text:", doc.querySelector(".todo.last").textContent);
console.log("getElementById('app') tag:", doc.getElementById("app").tagName);

// --- 3. Namespaced (SVG) content -----------------------------------------
const svg = doc.createElementNS(SVG_NS, "svg");
svg.setAttribute("viewBox", "0 0 100 100");
const circle = doc.createElementNS(SVG_NS, "circle");
circle.setAttribute("cx", "50");
circle.setAttribute("cy", "50");
circle.setAttribute("r", "40");
svg.appendChild(circle);
main.appendChild(svg);

console.log("circle namespaceURI:", circle.namespaceURI);

// --- 4. Parse a fragment --------------------------------------------------
const frag = parseFragment("<p>Parsed <strong>fragment</strong></p>", doc);
main.appendChild(frag);
console.log("parsed <strong> text:", doc.querySelector("strong").textContent);

// --- 5. Clone a subtree ---------------------------------------------------
const clone = list.cloneNode(true);
console.log("clone is a different object:", clone !== list);
console.log("clone item count:", clone.querySelectorAll("li").length);

// --- 6. Serialize ---------------------------------------------------------
console.log("\n--- documentElement.outerHTML (HTML mode) ---");
console.log(doc.documentElement.outerHTML);

console.log("\n--- serializeHTML(main) ---");
console.log(serializeHTML(main));

// --- 7. XML mode is case-preserving and self-closes empties --------------
const xml = createDocument({ mode: "xml" });
const root = xml.createElement("Config");
const flag = xml.createElement("Flag");
flag.setAttribute("Enabled", "true");
root.appendChild(flag);
console.log("\n--- serializeXML(root) (XML mode) ---");
console.log(serializeXML(root));
