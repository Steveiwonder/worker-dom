# Benchmarks

Micro-benchmarks for `worker-vdom`. They import the **built** library from
`../dist/index.js`, so build first:

```bash
npm run build
npm run bench
```

`npm run bench` runs `node --expose-gc benchmarks/run.mjs`. The `--expose-gc`
flag lets the runner force a garbage collection between benchmarks for steadier
numbers; it still runs without the flag.

## What the numbers mean

The runner prints a table with the operation count, total wall-clock time
(`performance.now()`), and derived ops/sec for each benchmark. **These are raw
timings from whatever machine you run them on.** They vary widely with CPU,
Node version, and system load, so treat them as a way to spot regressions and
to compare operations against each other — not as headline figures.

## The benchmarks

| Benchmark                        | What it measures                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| **create 100k elements**         | Cost of `createElement` alone — allocating 100,000 detached elements.                            |
| **append 100k via fragment**     | Building 100,000 `<li>` (each with a text child) in a `DocumentFragment`, then one `appendChild` to attach them all. Exercises the fast fragment-move path. |
| **setAttribute (8 attrs x 100k)**| 800,000 `setAttribute` calls across 100,000 elements — attribute storage and lookup.             |
| **cloneNode(deep) large tree**   | Deep-cloning a wide+deep tree (~30k nodes) repeatedly — the iterative clone walk.                |
| **serialize large tree (HTML)**  | `serializeHTML` over the same ~30k-node tree repeatedly — the iterative serializer.              |
| **querySelectorAll x4 selectors**| Running a type, class, descendant, and structural-pseudo selector over the large tree — the selector engine's full-tree walk and matching. |

The large-tree benchmarks share one builder: 200 sections × 50 rows, each row
holding two `<span>` children.

## Notes

- The runner throws if a benchmark produces an obviously wrong result (e.g. a
  clone that matches the original, or selectors matching nothing), so a silent
  no-op regression is caught rather than reported as "fast".
- Ops counts differ per benchmark (elements, attribute calls, nodes, or
  selector runs), so compare ops/sec **within** a row over time, not across
  rows.
