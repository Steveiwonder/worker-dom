import { describe, expect, it } from "vitest";
import {
  VCanvasRenderingContext2D,
  VHTMLCanvasElement,
  createDocument,
  installDOMGlobals,
} from "../src/index.js";

describe("canvas compatibility", () => {
  it("creates a canvas element with a stable 2d context", () => {
    const canvas = createDocument().createElement("canvas");

    expect(canvas).toBeInstanceOf(VHTMLCanvasElement);
    expect((canvas as VHTMLCanvasElement).width).toBe(300);
    expect((canvas as VHTMLCanvasElement).height).toBe(150);

    const first = (canvas as VHTMLCanvasElement).getContext("2d");
    const second = (canvas as VHTMLCanvasElement).getContext("2d");
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(VCanvasRenderingContext2D);
    expect((canvas as VHTMLCanvasElement).getContext("webgl")).toBeNull();
  });

  it("measures text deterministically without OffscreenCanvas", () => {
    const canvas = createDocument().createElement(
      "canvas",
    ) as VHTMLCanvasElement;
    const context = canvas.getContext("2d");
    context.font = "20px Arial";

    expect(context.measureText("worker").width).toBeGreaterThan(50);
    expect(context.measureText("WWW").width).toBeGreaterThan(
      context.measureText("iii").width,
    );
    expect(context.measureText("x").actualBoundingBoxAscent).toBe(16);
  });

  it("installs canvas constructors for instanceof checks", () => {
    const target: Record<string, unknown> = {};
    const document = createDocument();
    installDOMGlobals(document, { target });

    expect(target.HTMLCanvasElement).toBe(VHTMLCanvasElement);
    expect(target.CanvasRenderingContext2D).toBe(
      VCanvasRenderingContext2D,
    );
  });
});
