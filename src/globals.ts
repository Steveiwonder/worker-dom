import { VDocument } from "./document.js";
import { VElement } from "./element.js";
import {
  VNode,
  type VEventLike,
  type VEventListener,
} from "./node.js";
import { VCSSStyleDeclaration } from "./style.js";
import {
  VSVGMatrix,
  VSVGTransform,
} from "./svg.js";
import { VDOMParser, VXMLSerializer } from "./dom-parser.js";

export interface InstallDOMGlobalsOptions {
  /**
   * The worker-like object that receives the globals. Defaults to globalThis.
   * Passing a plain object is useful for sandboxing and tests.
   */
  target?: Record<string, unknown>;
  /**
   * Replace globals that already exist. The default preserves host-provided
   * implementations and only fills missing APIs.
   */
  overwrite?: boolean;
}

export class VEvent implements VEventLike {
  target?: unknown;
  currentTarget?: unknown;
  defaultPrevented = false;
  cancelBubble = false;

  constructor(
    public readonly type: string,
    public readonly eventInitDict: {
      bubbles?: boolean;
      cancelable?: boolean;
      composed?: boolean;
    } = {},
  ) {}

  get bubbles(): boolean {
    return this.eventInitDict.bubbles ?? false;
  }

  get cancelable(): boolean {
    return this.eventInitDict.cancelable ?? false;
  }

  get composed(): boolean {
    return this.eventInitDict.composed ?? false;
  }

  preventDefault(): void {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.cancelBubble = true;
  }

  stopImmediatePropagation(): void {
    this.cancelBubble = true;
  }
}

function install(
  target: Record<string, unknown>,
  name: string,
  value: unknown,
  overwrite: boolean,
): void {
  if (overwrite || !(name in target) || target[name] == null) {
    try {
      target[name] = value;
    } catch {
      Object.defineProperty(target, name, {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    }
  }
}

/**
 * Installs a worker-safe DOM compatibility surface for libraries that perform
 * `instanceof` checks or read browser globals while rendering.
 *
 * The library remains side-effect free unless this function is called.
 */
export function installDOMGlobals(
  document: VDocument,
  options: InstallDOMGlobalsOptions = {},
): Record<string, unknown> {
  const target = options.target ?? (globalThis as Record<string, unknown>);
  const overwrite = options.overwrite ?? false;
  let animationFrameId = 0;
  const eventListeners = new Map<string, Set<VEventListener>>();

  install(target, "document", document, overwrite);
  install(target, "window", target, overwrite);
  install(target, "self", target, overwrite);
  install(target, "top", target, overwrite);
  install(target, "parent", target, overwrite);
  install(target, "Document", VDocument, overwrite);
  install(target, "Node", VNode, overwrite);
  install(target, "Element", VElement, overwrite);
  install(target, "HTMLElement", VElement, overwrite);
  install(target, "SVGElement", VElement, overwrite);
  install(target, "SVGSVGElement", VElement, overwrite);
  install(target, "SVGGraphicsElement", VElement, overwrite);
  for (const constructorName of [
    "SVGGElement",
    "SVGDefsElement",
    "SVGPathElement",
    "SVGRectElement",
    "SVGCircleElement",
    "SVGEllipseElement",
    "SVGLineElement",
    "SVGPolylineElement",
    "SVGPolygonElement",
    "SVGTextElement",
    "SVGTSpanElement",
    "SVGImageElement",
    "SVGUseElement",
    "SVGClipPathElement",
    "SVGForeignObjectElement",
  ]) {
    install(target, constructorName, VElement, overwrite);
  }
  install(target, "SVGMatrix", VSVGMatrix, overwrite);
  install(target, "DOMMatrix", VSVGMatrix, overwrite);
  install(target, "SVGTransform", VSVGTransform, overwrite);
  install(target, "CSSStyleDeclaration", VCSSStyleDeclaration, overwrite);
  install(target, "Event", VEvent, overwrite);
  install(target, "CustomEvent", VEvent, overwrite);
  install(target, "DOMParser", VDOMParser, overwrite);
  install(target, "XMLSerializer", VXMLSerializer, overwrite);
  install(
    target,
    "addEventListener",
    (type: string, listener: VEventListener | null) => {
      if (!listener) return;
      const bucket = eventListeners.get(type) ?? new Set<VEventListener>();
      bucket.add(listener);
      eventListeners.set(type, bucket);
    },
    overwrite,
  );
  install(
    target,
    "removeEventListener",
    (type: string, listener: VEventListener | null) => {
      if (listener) eventListeners.get(type)?.delete(listener);
    },
    overwrite,
  );
  install(
    target,
    "dispatchEvent",
    (event: VEventLike) => {
      try {
        event.target ??= target;
        event.currentTarget = target;
      } catch {
        // Some third-party event objects expose read-only target properties.
      }
      for (const listener of [...(eventListeners.get(event.type) ?? [])]) {
        if (typeof listener === "function") listener.call(target, event);
        else listener.handleEvent(event);
      }
      return !event.defaultPrevented;
    },
    overwrite,
  );
  install(
    target,
    "getComputedStyle",
    (element: VElement) => element.style,
    overwrite,
  );
  install(
    target,
    "requestAnimationFrame",
    (callback: (timestamp: number) => void) => {
      const handle = ++animationFrameId;
      void Promise.resolve().then(() => callback(Date.now()));
      return handle;
    },
    overwrite,
  );
  install(
    target,
    "cancelAnimationFrame",
    (_handle: number) => undefined,
    overwrite,
  );

  install(
    target,
    "navigator",
    {
      userAgent: "worker-vdom",
      platform: "WebWorker",
      language: "en",
    },
    overwrite,
  );
  install(
    target,
    "location",
    {
      href: "",
      protocol: "",
      host: "",
      hostname: "",
      pathname: "",
      search: "",
      hash: "",
    },
    overwrite,
  );

  document.defaultView = target;
  return target;
}
