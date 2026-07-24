export interface StyleAttributeOwner {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

function toCssName(name: string): string {
  if (name.startsWith("--")) return name;
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function parseDeclarations(cssText: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const declaration of cssText.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (name && value) declarations.set(name, value);
  }
  return declarations;
}

/**
 * A small, attribute-backed CSS declaration object. Unknown camelCase
 * properties are reflected as kebab-case CSS properties through a Proxy.
 */
export class VCSSStyleDeclaration {
  [property: string]: unknown;

  private readonly proxy: VCSSStyleDeclaration;

  constructor(private readonly owner: StyleAttributeOwner) {
    this.proxy = new Proxy(this, {
      get: (target, property, receiver) => {
        if (typeof property !== "string" || property in target) {
          return Reflect.get(target, property, receiver) as unknown;
        }
        return target.getPropertyValue(toCssName(property));
      },
      set: (target, property, value, receiver) => {
        if (typeof property !== "string" || property in target) {
          return Reflect.set(target, property, value, receiver);
        }
        target.setProperty(toCssName(property), String(value));
        return true;
      },
      ownKeys: (target) => [
        ...Reflect.ownKeys(target),
        ...target.names().filter((name) => !(name in target)),
      ],
      getOwnPropertyDescriptor: (target, property) => {
        if (
          typeof property === "string" &&
          !(property in target) &&
          target.getPropertyValue(toCssName(property))
        ) {
          return { configurable: true, enumerable: true, writable: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
  }

  asProxy(): VCSSStyleDeclaration {
    return this.proxy;
  }

  private declarations(): Map<string, string> {
    return parseDeclarations(this.owner.getAttribute("style") ?? "");
  }

  private names(): string[] {
    return [...this.declarations().keys()];
  }

  private write(declarations: Map<string, string>): void {
    if (declarations.size === 0) {
      this.owner.removeAttribute("style");
      return;
    }
    this.owner.setAttribute(
      "style",
      [...declarations]
        .map(([name, value]) => `${name}: ${value}`)
        .join("; "),
    );
  }

  get cssText(): string {
    return this.owner.getAttribute("style") ?? "";
  }

  set cssText(value: string) {
    const declarations = parseDeclarations(String(value));
    this.write(declarations);
  }

  get length(): number {
    return this.declarations().size;
  }

  item(index: number): string {
    return this.names()[index] ?? "";
  }

  getPropertyValue(property: string): string {
    return this.declarations().get(property.trim().toLowerCase()) ?? "";
  }

  getPropertyPriority(property: string): string {
    const value = this.getPropertyValue(property);
    return /!\s*important\s*$/i.test(value) ? "important" : "";
  }

  setProperty(
    property: string,
    value: string | null,
    priority: string | null = "",
  ): void {
    const name = property.trim().toLowerCase();
    if (!name) return;
    if (value === null || value === "") {
      this.removeProperty(name);
      return;
    }
    const declarations = this.declarations();
    const suffix =
      String(priority ?? "").toLowerCase() === "important"
        ? " !important"
        : "";
    declarations.set(name, `${String(value).trim()}${suffix}`);
    this.write(declarations);
  }

  removeProperty(property: string): string {
    const name = property.trim().toLowerCase();
    const declarations = this.declarations();
    const previous = declarations.get(name) ?? "";
    declarations.delete(name);
    this.write(declarations);
    return previous;
  }

  toString(): string {
    return this.cssText;
  }
}
