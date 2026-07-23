// Benchmark runner for worker-vdom.
//
//   npm run build        # produce dist/
//   npm run bench        # == node --expose-gc benchmarks/run.mjs
//
// Results are RAW timings from your machine and vary widely by CPU, Node
// version, and load. They are here to catch regressions and to let you compare
// operations against each other — not to advertise a fixed number.
import { createDocument, serializeHTML } from "../dist/index.js";

// --- Tiny harness ----------------------------------------------------------

/** Force a GC between benchmarks when the runner was started with --expose-gc. */
function maybeGc() {
  if (typeof globalThis.gc === "function") globalThis.gc();
}

/**
 * Run `fn` once (already includes its own loop of `iterations` units of work)
 * and return timing. `iterations` is the number of logical operations `fn`
 * performed, used to compute ops/sec.
 */
function bench(name, iterations, fn) {
  maybeGc();
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  const opsPerSec = iterations / (elapsed / 1000);
  return { name, iterations, ms: elapsed, opsPerSec };
}

function fmt(n, digits = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function printTable(rows) {
  const headers = ["Benchmark", "Ops", "Total (ms)", "Ops/sec"];
  const data = rows.map((r) => [
    r.name,
    fmt(r.iterations),
    fmt(r.ms, 2),
    fmt(r.opsPerSec),
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((row) => row[i].length)),
  );
  const line = (cols) =>
    cols
      .map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])))
      .join("  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of data) console.log(line(row));
}

// --- Benchmarks ------------------------------------------------------------

const N = 100_000;

// (a) Create 100,000 detached elements.
function benchCreateElements() {
  return bench("create 100k elements", N, () => {
    const doc = createDocument();
    const bucket = new Array(N);
    for (let i = 0; i < N; i++) {
      bucket[i] = doc.createElement("div");
    }
    // Touch the array so the loop is not optimized away.
    if (bucket.length !== N) throw new Error("unreachable");
  });
}

// (b) Append 100,000 nodes via a DocumentFragment, then attach once.
function benchAppendFragment() {
  return bench("append 100k via fragment", N, () => {
    const doc = createDocument();
    const frag = doc.createDocumentFragment();
    for (let i = 0; i < N; i++) {
      const li = doc.createElement("li");
      li.appendChild(doc.createTextNode("item " + i));
      frag.appendChild(li);
    }
    doc.body.appendChild(frag);
    if (doc.body.childElementCount !== N) throw new Error("append mismatch");
  });
}

// (c) Set many attributes on freshly created elements.
function benchSetAttributes() {
  const ATTRS = 8;
  const count = N; // number of elements; ATTRS setAttribute calls each
  const total = count * ATTRS;
  return bench("setAttribute (8 attrs x 100k els)", total, () => {
    const doc = createDocument();
    for (let i = 0; i < count; i++) {
      const el = doc.createElement("div");
      el.setAttribute("id", "el-" + i);
      el.setAttribute("class", "row even highlighted");
      el.setAttribute("title", "row " + i);
      el.setAttribute("role", "listitem");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-index", String(i));
      el.setAttribute("data-state", "idle");
      el.setAttribute("aria-hidden", "false");
    }
  });
}

// Build a wide+deep tree used by clone / serialize / selector benchmarks.
function buildLargeTree() {
  const doc = createDocument();
  const root = doc.createElement("div");
  root.id = "root";
  const SECTIONS = 200;
  const ROWS = 50;
  let nodeCount = 1;
  for (let s = 0; s < SECTIONS; s++) {
    const section = doc.createElement("section");
    section.className = "section";
    section.dataset.section = String(s);
    nodeCount++;
    for (let r = 0; r < ROWS; r++) {
      const row = doc.createElement("div");
      row.className = r % 2 === 0 ? "row even" : "row odd";
      const label = doc.createElement("span");
      label.className = "label";
      label.textContent = "Section " + s + " row " + r;
      const value = doc.createElement("span");
      value.className = "value";
      value.textContent = String(r);
      row.appendChild(label);
      row.appendChild(value);
      section.appendChild(row);
      nodeCount += 3;
    }
    root.appendChild(section);
  }
  doc.body.appendChild(root);
  return { doc, root, nodeCount };
}

// (d) Deep-clone a large subtree.
function benchCloneSubtree() {
  const { root, nodeCount } = buildLargeTree();
  return bench("cloneNode(deep) large tree", nodeCount, () => {
    const REPEAT = 20;
    for (let i = 0; i < REPEAT; i++) {
      const copy = root.cloneNode(true);
      if (copy === root) throw new Error("clone mismatch");
    }
  });
}

// (e) Serialize a large tree to HTML.
function benchSerialize() {
  const { root, nodeCount } = buildLargeTree();
  return bench("serialize large tree (HTML)", nodeCount, () => {
    const REPEAT = 20;
    let sink = 0;
    for (let i = 0; i < REPEAT; i++) {
      sink += serializeHTML(root).length;
    }
    if (sink === 0) throw new Error("serialize produced nothing");
  });
}

// (f) Run common selectors over a large tree.
function benchSelectors() {
  const { root } = buildLargeTree();
  const selectors = [
    "span", // type
    ".row", // class
    "section .value", // descendant
    "div.row:nth-child(2)", // structural pseudo
  ];
  const REPEAT = 20;
  const iterations = selectors.length * REPEAT;
  return bench("querySelectorAll x4 selectors", iterations, () => {
    let sink = 0;
    for (let i = 0; i < REPEAT; i++) {
      for (const sel of selectors) {
        sink += root.querySelectorAll(sel).length;
      }
    }
    if (sink === 0) throw new Error("selectors matched nothing");
  });
}

// --- Main ------------------------------------------------------------------

function main() {
  console.log("worker-vdom benchmarks");
  console.log("node " + process.version + " on " + process.platform + "/" + process.arch);
  if (typeof globalThis.gc !== "function") {
    console.log("(tip: run with `node --expose-gc` for steadier numbers)");
  }
  console.log("");

  const rows = [
    benchCreateElements(),
    benchAppendFragment(),
    benchSetAttributes(),
    benchCloneSubtree(),
    benchSerialize(),
    benchSelectors(),
  ];

  printTable(rows);
  console.log("");
  console.log("Note: raw timings from this machine. Results vary by hardware,");
  console.log("Node version, and system load. Do not treat them as guarantees.");
}

main();
