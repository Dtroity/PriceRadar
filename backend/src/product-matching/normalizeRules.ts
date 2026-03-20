const UNITS_RE = /\b(кг|л|шт|гр|г|мл|уп|упак)\b/gi;
const SPECIALS_RE = /[^a-zа-я0-9\s]/gi;
const SPACES_RE = /\s+/g;

export function normalizeProductName(rawName: string): string {
  return rawName
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(UNITS_RE, ' ')
    .replace(SPECIALS_RE, ' ')
    .replace(SPACES_RE, ' ')
    .trim();
}

