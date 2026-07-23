import { VNode } from "./node.js";

/**
 * Shared base for {@link VText} and {@link VComment}. Holds string `data` and
 * implements the small slice of the CharacterData interface used by the
 * library.
 */
export abstract class VCharacterData extends VNode {
  /** @internal */
  data: string;

  constructor(data: string) {
    super();
    this.data = data;
  }

  get length(): number {
    return this.data.length;
  }

  override get nodeValue(): string | null {
    return this.data;
  }
  override set nodeValue(value: string | null) {
    this.data = value ?? "";
  }

  override get textContent(): string | null {
    return this.data;
  }
  override set textContent(value: string | null) {
    this.data = value ?? "";
  }

  appendData(data: string): void {
    this.data += data;
  }
}
