import { describe, expect, it } from "vitest";
import {
  createDocument,
  installDOMGlobals,
  SVG_NS,
  VDocument,
  VDOMParser,
  VElement,
  VEvent,
  VNode,
  VSVGMatrix,
  VXMLSerializer,
} from "../src/index.js";

describe("yFiles SVG compatibility surface", () => {
  it("uses tag-specific SVG constructors for renderer branches", () => {
    const target: Record<string, unknown> = {};
    const document = createDocument();
    installDOMGlobals(document, { target });
    const text = document.createElementNS(SVG_NS, "text");
    const group = document.createElementNS(SVG_NS, "g");
    const SVGText = target.SVGTextElement as typeof VElement;
    const SVGGroup = target.SVGGElement as typeof VElement;

    expect(text).toBeInstanceOf(SVGText);
    expect(text).not.toBeInstanceOf(SVGGroup);
    expect(group).toBeInstanceOf(SVGGroup);
    expect(group).not.toBeInstanceOf(SVGText);
  });

  it("reflects SVG animated string and length properties", () => {
    const document = createDocument({ mode: "xml" });
    const image = document.createElementNS(SVG_NS, "image");

    image.setAttribute("xlink:href", "asset.svg");
    image.setAttribute("x", "12.5");
    image.setAttribute("width", "80");
    image.setAttribute("class", "diagram-node");

    const href = image.href as { baseVal: string };
    expect(href.baseVal).toBe("asset.svg");
    href.baseVal = "embedded.svg";
    expect(image.getAttribute("href")).toBe("embedded.svg");

    expect(image.x.baseVal.value).toBe(12.5);
    image.x.baseVal.value = 25;
    expect(image.getAttribute("x")).toBe("25");
    expect(image.width.animVal.value).toBe(80);

    expect((image.className as { baseVal: string }).baseVal).toBe(
      "diagram-node",
    );
  });

  it("reflects writable href strings on HTML link elements", () => {
    const document = createDocument();
    const link = document.createElement("link");

    link.href = "/assets/worker-renderer.js";

    expect(link.href).toBe("/assets/worker-renderer.js");
    expect(link.getAttribute("href")).toBe("/assets/worker-renderer.js");
  });

  it("supports SVG viewBox, transform lists, matrices and geometry", () => {
    const document = createDocument({ mode: "xml" });
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "10 20 300 200");
    document.appendChild(svg);

    expect(svg.viewBox.baseVal).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
    expect(svg.getBoundingClientRect()).toMatchObject({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      right: 310,
      bottom: 220,
    });

    const transform = svg.createSVGTransform();
    transform.setTranslate(40, 50);
    svg.transform.baseVal.appendItem(transform);
    expect(svg.transform.baseVal.numberOfItems).toBe(1);
    expect(svg.getAttribute("transform")).toBe("matrix(1 0 0 1 40 50)");

    const point = svg.createSVGPoint();
    point.x = 2;
    point.y = 3;
    expect(
      point.matrixTransform(new VSVGMatrix(1, 0, 0, 1, 10, 20)),
    ).toEqual({ x: 12, y: 23 });
  });

  it("provides attribute-backed style and computed style behaviour", () => {
    const document = createDocument();
    const element = document.createElement("div");

    element.style.setProperty("stroke-width", "2px");
    (element.style as unknown as { backgroundColor: string }).backgroundColor =
      "red";

    expect(element.style.getPropertyValue("stroke-width")).toBe("2px");
    expect(element.style.getPropertyValue("background-color")).toBe("red");
    expect(element.getAttribute("style")).toBe(
      "stroke-width: 2px; background-color: red",
    );

    element.setAttribute("style", "fill: blue; opacity: 0.5");
    expect(element.style.getPropertyValue("fill")).toBe("blue");
    expect(element.style.length).toBe(2);
  });

  it("supports document collection and implementation feature checks", () => {
    const document = createDocument();
    const svg = document.createElementNS(SVG_NS, "svg");
    const first = document.createElementNS(SVG_NS, "rect");
    const second = document.createElementNS(SVG_NS, "rect");
    second.classList.add("selected");
    svg.append(first, second);
    document.body.appendChild(svg);

    expect(document.implementation.hasFeature("SVG", "1.1")).toBe(true);
    expect(document.getElementsByTagName("rect")).toHaveLength(2);
    expect(document.getElementsByTagNameNS(SVG_NS, "rect")).toHaveLength(2);
    expect(document.getElementsByClassName("selected")).toHaveLength(1);
  });

  it("installs DOM globals explicitly without import-time side effects", () => {
    const document = createDocument();
    const target: Record<string, unknown> = {};

    installDOMGlobals(document, { target });

    expect(target.document).toBe(document);
    expect(target.window).toBe(target);
    expect(target.Document).toBe(VDocument);
    expect(target.Node).toBe(VNode);
    expect(target.Element).toBe(VElement);
    expect(document.defaultView).toBe(target);

    const element = document.createElement("div");
    element.style.color = "green";
    const computedStyle = target.getComputedStyle as (
      value: VElement,
    ) => { getPropertyValue(name: string): string };
    expect(computedStyle(element).getPropertyValue("color")).toBe("green");
  });

  it("provides event targets for elements and installed worker globals", () => {
    const document = createDocument();
    const element = document.createElement("div");
    const target: Record<string, unknown> = {};
    const calls: string[] = [];
    const onElement = () => calls.push("element");
    const onWorker = () => calls.push("worker");

    element.addEventListener("change", onElement);
    element.dispatchEvent(new VEvent("change"));

    installDOMGlobals(document, { target });
    (
      target.addEventListener as (
        type: string,
        listener: (event: VEvent) => void,
      ) => void
    )("resize", onWorker);
    (target.dispatchEvent as (event: VEvent) => boolean)(
      new VEvent("resize"),
    );

    expect(calls).toEqual(["element", "worker"]);
    expect(VNode.ELEMENT_NODE).toBe(1);
  });

  it("parses and serializes SVG through browser-compatible globals", () => {
    const parsed = new VDOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10"/></svg>',
      "image/svg+xml",
    );

    expect(parsed.documentElement.localName).toBe("svg");
    expect(parsed.querySelector("rect")?.namespaceURI).toBe(SVG_NS);
    expect(new VXMLSerializer().serializeToString(parsed)).toContain(
      '<rect width="10"/>',
    );
  });
});
