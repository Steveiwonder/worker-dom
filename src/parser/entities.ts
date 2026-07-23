/**
 * Entity decoding for a practical subset of HTML named entities plus full
 * numeric (decimal and hexadecimal) character references.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  times: "×",
  divide: "÷",
  deg: "°",
  plusmn: "±",
  micro: "µ",
  para: "¶",
  sect: "§",
  middot: "·",
  bull: "•",
  dagger: "†",
  Dagger: "‡",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup2: "²",
  sup3: "³",
  szlig: "ß",
  agrave: "à",
  aacute: "á",
  eacute: "é",
  egrave: "è",
  ccedil: "ç",
  ntilde: "ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  emsp: " ",
  ensp: " ",
  thinsp: " ",
  zwnj: "‌",
  zwj: "‍",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
  harr: "↔",
  spades: "♠",
  clubs: "♣",
  hearts: "♥",
  diams: "♦",
};

const ENTITY_RE = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g;

function codePointToString(cp: number): string {
  if (cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
    return "�";
  }
  return String.fromCodePoint(cp);
}

/** Decode HTML entities in a string. Unknown entities are left as-is. */
export function decodeEntities(input: string): string {
  if (input.indexOf("&") === -1) return input;
  return input.replace(ENTITY_RE, (match, body: string) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const num = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(num)) return match;
      return codePointToString(num);
    }
    const replacement = NAMED_ENTITIES[body];
    return replacement !== undefined ? replacement : match;
  });
}
