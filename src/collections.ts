/**
 * DOM-like collections.
 *
 * NOTE: Unlike the real DOM, every collection returned by this library is a
 * **static snapshot** taken at the moment the query ran. They never update to
 * reflect later tree mutations. This is documented behavior (see README) and
 * keeps the implementation simple and predictable inside a Web Worker.
 */

/** Read-only, indexable, iterable list of nodes. */
export interface NodeListLike<T> extends Iterable<T> {
  readonly length: number;
  item(index: number): T | null;
  forEach(
    callback: (value: T, index: number, list: NodeListLike<T>) => void,
    thisArg?: unknown,
  ): void;
  keys(): IterableIterator<number>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[number, T]>;
  readonly [index: number]: T;
}

export type HTMLCollectionLike<T> = NodeListLike<T>;

/**
 * Concrete backing class for {@link NodeListLike} / {@link HTMLCollectionLike}.
 * Numeric indices are copied onto the instance so `list[0]` works.
 */
export class StaticNodeList<T> implements NodeListLike<T> {
  readonly length: number;
  [index: number]: T;

  constructor(items: readonly T[]) {
    this.length = items.length;
    for (let i = 0; i < items.length; i++) {
      this[i] = items[i];
    }
  }

  item(index: number): T | null {
    return index >= 0 && index < this.length ? this[index] : null;
  }

  forEach(
    callback: (value: T, index: number, list: NodeListLike<T>) => void,
    thisArg?: unknown,
  ): void {
    for (let i = 0; i < this.length; i++) {
      callback.call(thisArg, this[i], i, this);
    }
  }

  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.length; i++) yield i;
  }

  *values(): IterableIterator<T> {
    for (let i = 0; i < this.length; i++) yield this[i];
  }

  *entries(): IterableIterator<[number, T]> {
    for (let i = 0; i < this.length; i++) yield [i, this[i]];
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }
}

export function createNodeList<T>(items: readonly T[]): NodeListLike<T> {
  return new StaticNodeList<T>(items);
}
