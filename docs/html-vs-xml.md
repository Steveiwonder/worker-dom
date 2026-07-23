# HTML mode vs XML mode

`createDocument()` takes an optional `mode`:

```js
import { createDocument } from "worker-vdom";

const htmlDoc = createDocument();               // mode: "html" (default)
const xmlDoc = createDocument({ mode: "xml" }); // mode: "xml"
```

The mode is fixed for the life of the document (`document.mode` is read-only)
and changes four things: the starting tree, name case-sensitivity, how empty
elements serialize, and how a few HTML-specific elements are treated.

## At a glance

| Behavior                       | HTML mode                                        | XML mode                              |
| ------------------------------ | ------------------------------------------------ | ------------------------------------- |
| Starting tree                  | `<!DOCTYPE html><html><head></head><body></body></html>` | empty (no doctype, no elements)       |
| Default element namespace      | HTML namespace                                   | `null` (no namespace)                 |
| Tag-name case                  | folded to lowercase; `tagName` reports UPPERCASE | preserved exactly as written          |
| Attribute-name case            | folded to lowercase                              | preserved exactly as written          |
| Empty element serialization    | `<div></div>`; void elements `<br>`              | self-closing `<div/>`                 |
| Void elements (`<br>`, `<img>`)| recognized, no end tag                           | not special — self-close when empty   |
| Raw-text elements (`<script>`) | content emitted verbatim, not escaped            | not special                           |
| `document.doctype`             | the `<!DOCTYPE html>` node                        | `null` unless you add one             |

## HTML mode (default)

### Auto-populated tree

A fresh HTML document already contains the standard skeleton, so `document.head`
and `document.body` are non-null immediately:

```js
const document = createDocument();
document.doctype.name;        // "html"
document.documentElement;     // <html>
document.head;                // <head>
document.body;                // <body>
```

### Case handling

`createElement` lowercases the tag name and puts the element in the HTML
namespace. The DOM-facing `tagName` / `nodeName` report the name in **uppercase**,
matching browsers:

```js
const el = document.createElement("DiV");
el.localName; // "div"
el.tagName;   // "DIV"
```

Attribute names are lowercased too, so `getAttribute` is case-insensitive:

```js
el.setAttribute("DATA-X", "1");
el.getAttribute("data-x"); // "1"
el.getAttributeNames();    // ["data-x"]
```

### Void elements

The HTML void elements never take children and serialize with no closing tag
and no trailing slash:

```
area base br col embed hr img input link meta param source track wbr
```

```js
document.createElement("br").outerHTML; // "<br>"
```

### Raw-text and escapable-raw-text elements

- **Raw text** — `<script>` and `<style>`: text content is serialized
  **verbatim** (no entity escaping) and, when parsing, read literally until the
  matching close tag.
- **Escapable raw text** — `<textarea>` and `<title>`: content is text only (no
  nested elements), and entities are decoded when parsing.

### Text and attribute escaping

When serializing in HTML mode:

- Text: `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, and the non-breaking space
  (U+00A0) →`&nbsp;`. Ordinary spaces are left as-is.
- Attribute values: `&`→`&amp;`, `"`→`&quot;`, and U+00A0 →`&nbsp;`.

## XML mode

### Empty document

`createDocument({ mode: "xml" })` gives you nothing but an empty document — no
doctype, no `<html>`, no `<head>`/`<body>`. `document.head` and
`document.body` are `null` until you build a tree. Create a root yourself:

```js
const doc = createDocument({ mode: "xml" });
const root = doc.createElement("Catalog");
doc.appendChild(root);
```

### Case is preserved

`createElement` keeps the exact case you pass and gives the element **no**
namespace (`namespaceURI === null`). Lookups are case-sensitive:

```js
const el = doc.createElement("BookList");
el.tagName;              // "BookList"  (not upper-cased)
el.setAttribute("Id", "1");
el.getAttribute("Id");   // "1"
el.getAttribute("id");   // null  (case-sensitive)
```

### Self-closing empty elements

Empty elements serialize using XML self-closing syntax; elements with children
use a normal start/end tag pair. There is no void-element or raw-text special
casing in XML mode:

```js
serializeXML(doc.createElement("Flag"));      // "<Flag/>"
const p = doc.createElement("P");
p.appendChild(doc.createTextNode("hi"));
serializeXML(p);                              // "<P>hi</P>"
```

### Text and attribute escaping

When serializing in XML mode:

- Text: `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`. The non-breaking space is left as a
  raw character.
- Attribute values: `&`→`&amp;`, `"`→`&quot;`, `<`→`&lt;`.

## Choosing the serializer

`element.innerHTML` / `element.outerHTML` pick their rules from the owner
document's mode automatically. You can also serialize explicitly regardless of
mode:

```js
import { serialize, serializeHTML, serializeXML } from "worker-vdom";

serializeHTML(node);            // force HTML rules
serializeXML(node);             // force XML rules
serialize(node);                // HTML rules by default
serialize(node, { xml: true }); // XML rules
```
