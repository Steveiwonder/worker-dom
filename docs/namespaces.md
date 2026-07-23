# Namespaces

`worker-vdom` implements XML-namespace-aware elements and attributes, so you can
build SVG and MathML content, use `xlink:href`, and round-trip prefixes through
serialization.

## The six well-known namespaces

The library exports these constants (their string values match the DOM):

| Constant   | URI                                        | Used for                          |
| ---------- | ------------------------------------------ | --------------------------------- |
| `HTML_NS`  | `http://www.w3.org/1999/xhtml`             | HTML elements                     |
| `SVG_NS`   | `http://www.w3.org/2000/svg`               | SVG elements                      |
| `MATHML_NS`| `http://www.w3.org/1998/Math/MathML`       | MathML elements                   |
| `XML_NS`   | `http://www.w3.org/XML/1998/namespace`     | the `xml:` prefix (`xml:lang`, …) |
| `XMLNS_NS` | `http://www.w3.org/2000/xmlns/`            | `xmlns` declarations              |
| `XLINK_NS` | `http://www.w3.org/1999/xlink`             | the `xlink:` prefix (`xlink:href`)|

```js
import { SVG_NS, XLINK_NS } from "worker-vdom";
```

## Creating namespaced elements

`createElementNS(namespaceURI, qualifiedName)` validates and splits the
qualified name into a prefix and local name:

```js
const doc = createDocument();

const svg = doc.createElementNS(SVG_NS, "svg");
svg.namespaceURI; // SVG_NS
svg.prefix;       // null
svg.localName;    // "svg"

const rect = doc.createElementNS(SVG_NS, "svg:rect");
rect.prefix;    // "svg"
rect.localName; // "rect"
rect.tagName;   // "svg:rect"  (qualified name; not upper-cased — non-HTML)
```

Note that `tagName` is only upper-cased for HTML-namespace elements in an HTML
document; SVG/MathML/XML elements report their qualified name as-is.

Plain `createElement` (no namespace argument) places the element in `HTML_NS` in
an HTML document, or in **no** namespace (`null`) in an XML document.

## Namespaced attributes

`setAttributeNS(namespace, qualifiedName, value)` stores the namespace, prefix,
local name, and the qualified name to serialize. An empty-string namespace is
normalized to `null`.

```js
const use = doc.createElementNS(SVG_NS, "use");
use.setAttributeNS(XLINK_NS, "xlink:href", "#icon");

use.getAttributeNS(XLINK_NS, "href"); // "#icon"   (look up by localName)
use.hasAttributeNS(XLINK_NS, "href"); // true
use.removeAttributeNS(XLINK_NS, "href");
```

`getAttributeNS` / `hasAttributeNS` / `removeAttributeNS` match on the
`(namespace, localName)` pair. The non-namespaced `getAttribute("xlink:href")`
matches on the full qualified name instead.

## Qualified-name validation errors

Both `createElementNS` and `setAttributeNS` run the DOM "validate and extract"
algorithm and throw a `DOMException` with a stable `name`:

| Situation                                                        | `DOMException.name`      |
| ---------------------------------------------------------------- | ------------------------ |
| Qualified name is not a valid XML QName (e.g. `"1bad"`, `""`)    | `InvalidCharacterError`  |
| A prefix is present but the namespace is `null` (e.g. `pre:fix`) | `NamespaceError`         |
| Prefix `xml` used with a namespace other than `XML_NS`           | `NamespaceError`         |
| Name/prefix `xmlns` used with a namespace other than `XMLNS_NS`  | `NamespaceError`         |
| `XMLNS_NS` used with a name/prefix that is not `xmlns`           | `NamespaceError`         |

```js
doc.createElementNS(null, "pre:fix");   // throws NamespaceError
doc.createElementNS(SVG_NS, "xml:lang"); // throws NamespaceError
doc.createElementNS(SVG_NS, "1bad");     // throws InvalidCharacterError
```

## Prefix preservation on serialization

Serialization emits the stored qualified name for both elements and attributes,
so prefixes survive a round trip:

```js
const use = doc.createElementNS(SVG_NS, "use");
use.setAttributeNS(XLINK_NS, "xlink:href", "#icon");
use.outerHTML; // '<use xlink:href="#icon"></use>'
```

## SVG and MathML auto-namespacing during HTML parsing

When parsing HTML (via `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or
`parseFragment`) inside an HTML context, an `<svg>` start tag switches the
parser into `SVG_NS` and `<math>` switches into `MATHML_NS`. Descendants inherit
their parent's namespace, so an entire SVG/MathML subtree lands in the right
namespace automatically:

```js
doc.body.innerHTML =
  "<div><svg><circle></circle></svg><math><mi>x</mi></math></div>";

doc.querySelector("svg").namespaceURI;    // SVG_NS
doc.querySelector("circle").namespaceURI; // SVG_NS  (inherited)
doc.querySelector("mi").namespaceURI;     // MATHML_NS
```

The parser also recognizes namespaced attribute prefixes: `xlink:*` →
`XLINK_NS`, `xml:*` → `XML_NS`, and `xmlns` / `xmlns:*` → `XMLNS_NS`.

## What is not done

- No automatic `xmlns=` declaration generation on serialize. Namespaces are
  tracked on nodes and prefixes are preserved, but the serializer does not
  synthesize `xmlns` attributes for you — add them yourself if a consumer needs
  them.
- HTML-parser namespace switching is limited to the `<svg>` / `<math>`
  integration-point shortcut above; it does not implement the full HTML foreign
  content algorithm.
