import type { VElement } from "./element.js";

export interface SVGLengthValueLike {
  value: number;
  valueAsString: string;
  valueInSpecifiedUnits: number;
  unitType: number;
  convertToSpecifiedUnits(unitType: number): void;
  newValueSpecifiedUnits(unitType: number, value: number): void;
}

function numericValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class VSVGAnimatedString {
  constructor(
    private readonly element: VElement,
    private readonly attribute: string,
    private readonly fallbackAttribute?: string,
  ) {}

  get baseVal(): string {
    return (
      this.element.getAttribute(this.attribute) ??
      (this.fallbackAttribute
        ? this.element.getAttribute(this.fallbackAttribute)
        : null) ??
      ""
    );
  }

  set baseVal(value: string) {
    this.element.setAttribute(this.attribute, value);
  }

  get animVal(): string {
    return this.baseVal;
  }
}

class VSVGLengthValue implements SVGLengthValueLike {
  unitType = 1;

  constructor(
    private readonly element: VElement,
    private readonly attribute: string,
  ) {}

  get valueAsString(): string {
    return this.element.getAttribute(this.attribute) ?? "0";
  }

  set valueAsString(value: string) {
    this.element.setAttribute(this.attribute, value);
  }

  get value(): number {
    return numericValue(this.valueAsString);
  }

  set value(value: number) {
    this.valueAsString = String(value);
  }

  get valueInSpecifiedUnits(): number {
    return this.value;
  }

  set valueInSpecifiedUnits(value: number) {
    this.value = value;
  }

  convertToSpecifiedUnits(unitType: number): void {
    this.unitType = unitType;
  }

  newValueSpecifiedUnits(unitType: number, value: number): void {
    this.unitType = unitType;
    this.value = value;
  }
}

export class VSVGAnimatedLength {
  readonly baseVal: SVGLengthValueLike;
  readonly animVal: SVGLengthValueLike;

  constructor(element: VElement, attribute: string) {
    this.baseVal = new VSVGLengthValue(element, attribute);
    this.animVal = this.baseVal;
  }
}

export interface SVGRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parseViewBox(value: string): SVGRectLike {
  const parts = value
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : 0,
    y: Number.isFinite(parts[1]) ? parts[1] : 0,
    width: Number.isFinite(parts[2]) ? parts[2] : 0,
    height: Number.isFinite(parts[3]) ? parts[3] : 0,
  };
}

export class VSVGAnimatedRect {
  constructor(
    private readonly element: VElement,
    private readonly attribute: string,
  ) {}

  get baseVal(): SVGRectLike {
    return parseViewBox(this.element.getAttribute(this.attribute) ?? "");
  }

  get animVal(): SVGRectLike {
    return this.baseVal;
  }
}

export interface SVGMatrixLike {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export class VSVGMatrix implements SVGMatrixLike {
  constructor(
    public a = 1,
    public b = 0,
    public c = 0,
    public d = 1,
    public e = 0,
    public f = 0,
  ) {}

  translate(x: number, y: number): VSVGMatrix {
    return new VSVGMatrix(this.a, this.b, this.c, this.d, this.e + x, this.f + y);
  }

  scale(factor: number): VSVGMatrix {
    return this.scaleNonUniform(factor, factor);
  }

  scaleNonUniform(x: number, y: number): VSVGMatrix {
    return new VSVGMatrix(
      this.a * x,
      this.b * x,
      this.c * y,
      this.d * y,
      this.e,
      this.f,
    );
  }

  multiply(other: SVGMatrixLike): VSVGMatrix {
    return new VSVGMatrix(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    );
  }

  inverse(): VSVGMatrix {
    const determinant = this.a * this.d - this.b * this.c;
    if (determinant === 0) return new VSVGMatrix();
    return new VSVGMatrix(
      this.d / determinant,
      -this.b / determinant,
      -this.c / determinant,
      this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant,
    );
  }
}

export class VSVGTransform {
  type = 1;
  angle = 0;
  matrix = new VSVGMatrix();

  setMatrix(matrix: SVGMatrixLike): void {
    this.matrix = new VSVGMatrix(
      matrix.a,
      matrix.b,
      matrix.c,
      matrix.d,
      matrix.e,
      matrix.f,
    );
  }

  setTranslate(x: number, y: number): void {
    this.type = 2;
    this.matrix = new VSVGMatrix(1, 0, 0, 1, x, y);
  }

  setScale(x: number, y: number): void {
    this.type = 3;
    this.matrix = new VSVGMatrix(x, 0, 0, y, 0, 0);
  }

  setRotate(angle: number, x = 0, y = 0): void {
    this.type = 4;
    this.angle = angle;
    const radians = (angle * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    this.matrix = new VSVGMatrix(
      cosine,
      sine,
      -sine,
      cosine,
      x - x * cosine + y * sine,
      y - x * sine - y * cosine,
    );
  }
}

function serializeTransform(transform: VSVGTransform): string {
  const { a, b, c, d, e, f } = transform.matrix;
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}

export class VSVGTransformList {
  private readonly items: VSVGTransform[] = [];

  constructor(private readonly element: VElement) {}

  get numberOfItems(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.element.removeAttribute("transform");
  }

  initialize(item: VSVGTransform): VSVGTransform {
    this.items.splice(0, this.items.length, item);
    this.sync();
    return item;
  }

  getItem(index: number): VSVGTransform {
    const item = this.items[index];
    if (!item) throw new RangeError("SVG transform index is out of range");
    return item;
  }

  appendItem(item: VSVGTransform): VSVGTransform {
    this.items.push(item);
    this.sync();
    return item;
  }

  insertItemBefore(item: VSVGTransform, index: number): VSVGTransform {
    this.items.splice(Math.min(index, this.items.length), 0, item);
    this.sync();
    return item;
  }

  replaceItem(item: VSVGTransform, index: number): VSVGTransform {
    if (index >= this.items.length) {
      throw new RangeError("SVG transform index is out of range");
    }
    this.items[index] = item;
    this.sync();
    return item;
  }

  removeItem(index: number): VSVGTransform {
    const item = this.getItem(index);
    this.items.splice(index, 1);
    this.sync();
    return item;
  }

  consolidate(): VSVGTransform | null {
    if (this.items.length === 0) return null;
    const result = new VSVGTransform();
    result.setMatrix(
      this.items.reduce<SVGMatrixLike>(
        (matrix, item) => new VSVGMatrix(
          matrix.a,
          matrix.b,
          matrix.c,
          matrix.d,
          matrix.e,
          matrix.f,
        ).multiply(item.matrix),
        new VSVGMatrix(),
      ),
    );
    this.initialize(result);
    return result;
  }

  private sync(): void {
    if (this.items.length === 0) {
      this.element.removeAttribute("transform");
    } else {
      this.element.setAttribute(
        "transform",
        this.items.map(serializeTransform).join(" "),
      );
    }
  }
}

export class VSVGAnimatedTransformList {
  readonly baseVal: VSVGTransformList;
  readonly animVal: VSVGTransformList;

  constructor(element: VElement) {
    this.baseVal = new VSVGTransformList(element);
    this.animVal = this.baseVal;
  }
}

