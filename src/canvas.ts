import { HTML_NS } from "./constants.js";
import { VElement } from "./element.js";
import { VNode } from "./node.js";

export interface VTextMetrics {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
}

type CanvasDirectionLike = "inherit" | "ltr" | "rtl";
type CanvasTextAlignLike = "start" | "end" | "left" | "right" | "center";
type CanvasTextBaselineLike =
  | "top"
  | "hanging"
  | "middle"
  | "alphabetic"
  | "ideographic"
  | "bottom";

interface NativeTextMetricsLike {
  width: number;
  actualBoundingBoxLeft?: number;
  actualBoundingBoxRight?: number;
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
  fontBoundingBoxAscent?: number;
  fontBoundingBoxDescent?: number;
}

interface NativeCanvasContextLike {
  font: string;
  direction: CanvasDirectionLike;
  textAlign: CanvasTextAlignLike;
  textBaseline: CanvasTextBaselineLike;
  measureText(text: string): NativeTextMetricsLike;
}

interface NativeOffscreenCanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): NativeCanvasContextLike | null;
}

interface NativeOffscreenCanvasConstructor {
  new (width: number, height: number): NativeOffscreenCanvasLike;
}

/**
 * Small worker-safe subset of CanvasRenderingContext2D.
 *
 * It is intentionally focused on DOM/SVG renderers that use a temporary
 * canvas for text measurement. In browsers it delegates to OffscreenCanvas
 * when available; otherwise it provides deterministic estimates.
 */
export class VCanvasRenderingContext2D {
  font = "10px sans-serif";
  direction: CanvasDirectionLike = "inherit";
  fontKerning = "auto";
  fontStretch = "normal";
  fontVariantCaps = "normal";
  letterSpacing = "0px";
  textAlign: CanvasTextAlignLike = "start";
  textBaseline: CanvasTextBaselineLike = "alphabetic";
  textRendering = "auto";
  wordSpacing = "0px";

  constructor(public readonly canvas: VHTMLCanvasElement) {}

  measureText(text: string): VTextMetrics {
    const value = String(text);
    const native = this.canvas._nativeContext();
    if (native) {
      native.font = this.font;
      native.direction = this.direction;
      native.textAlign = this.textAlign;
      native.textBaseline = this.textBaseline;
      const metrics = native.measureText(value);
      return {
        width: metrics.width,
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft ?? 0,
        actualBoundingBoxRight:
          metrics.actualBoundingBoxRight ?? metrics.width,
        actualBoundingBoxAscent:
          metrics.actualBoundingBoxAscent ?? this._fontSize() * 0.8,
        actualBoundingBoxDescent:
          metrics.actualBoundingBoxDescent ?? this._fontSize() * 0.2,
        fontBoundingBoxAscent:
          metrics.fontBoundingBoxAscent ?? this._fontSize() * 0.8,
        fontBoundingBoxDescent:
          metrics.fontBoundingBoxDescent ?? this._fontSize() * 0.2,
      };
    }

    const size = this._fontSize();
    const letterSpacing = Number.parseFloat(this.letterSpacing) || 0;
    let width = 0;
    for (const character of value) {
      width += characterWidthFactor(character) * size;
    }
    width += Math.max(0, value.length - 1) * letterSpacing;
    return {
      width,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      actualBoundingBoxAscent: size * 0.8,
      actualBoundingBoxDescent: size * 0.2,
      fontBoundingBoxAscent: size * 0.8,
      fontBoundingBoxDescent: size * 0.2,
    };
  }

  save(): void {}
  restore(): void {}
  scale(_x: number, _y: number): void {}
  rotate(_angle: number): void {}
  translate(_x: number, _y: number): void {}
  transform(
    _a: number,
    _b: number,
    _c: number,
    _d: number,
    _e: number,
    _f: number,
  ): void {}
  setTransform(
    _a = 1,
    _b = 0,
    _c = 0,
    _d = 1,
    _e = 0,
    _f = 0,
  ): void {}
  resetTransform(): void {}

  private _fontSize(): number {
    const match = /(\d+(?:\.\d+)?)px/i.exec(this.font);
    return match ? Number.parseFloat(match[1]) : 10;
  }
}

export class VHTMLCanvasElement extends VElement {
  private _context2d?: VCanvasRenderingContext2D;
  private _offscreen?: NativeOffscreenCanvasLike;

  constructor() {
    super(HTML_NS, null, "canvas");
  }

  override get width(): number {
    return Number.parseInt(this.getAttribute("width") ?? "300", 10) || 0;
  }
  override set width(value: number) {
    this.setAttribute("width", Math.max(0, Number(value) || 0));
    if (this._offscreen) this._offscreen.width = this.width;
  }

  override get height(): number {
    return Number.parseInt(this.getAttribute("height") ?? "150", 10) || 0;
  }
  override set height(value: number) {
    this.setAttribute("height", Math.max(0, Number(value) || 0));
    if (this._offscreen) this._offscreen.height = this.height;
  }

  getContext(
    contextId: "2d",
    _options?: Record<string, unknown>,
  ): VCanvasRenderingContext2D;
  getContext(contextId: string, _options?: unknown): null;
  getContext(
    contextId: string,
    _options?: unknown,
  ): VCanvasRenderingContext2D | null {
    if (contextId !== "2d") return null;
    this._context2d ??= new VCanvasRenderingContext2D(this);
    return this._context2d;
  }

  /** @internal */
  _nativeContext(): NativeCanvasContextLike | null {
    const NativeOffscreenCanvas = (
      globalThis as typeof globalThis & {
        OffscreenCanvas?: NativeOffscreenCanvasConstructor;
      }
    ).OffscreenCanvas;
    if (!NativeOffscreenCanvas) return null;
    this._offscreen ??= new NativeOffscreenCanvas(this.width, this.height);
    return this._offscreen.getContext("2d");
  }

  override _shallowClone(): VNode {
    const clone = new VHTMLCanvasElement();
    clone._ownerDocument = this._ownerDocument;
    clone._attributes = this._attributes.map((attribute) => ({
      ...attribute,
    }));
    return clone;
  }
}

function characterWidthFactor(character: string): number {
  if (/\s/.test(character)) return 0.33;
  if (/[ilI1'`.,:;|!]/.test(character)) return 0.28;
  if (/[mwMW@#%&]/.test(character)) return 0.9;
  if (/[A-Z]/.test(character)) return 0.67;
  return 0.56;
}
