// ISBN validation helpers.
//
// A real book barcode is an ISBN-13 (EAN starting with 978 or 979) or an
// ISBN-10. Many barcodes on the back of books in the UK are NOT ISBNs —
// e.g. school stock-control stickers, supermarket price labels (EANs that
// usually start with 5 for UK-assigned GTINs), or library accession codes.
// Catching these early lets us prompt the user for manual entry instead of
// uselessly hitting Open Library and Google Books.

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isValidIsbn10(code: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = code[i];
    const val = ch === "X" ? 10 : Number(ch);
    sum += val * (10 - i);
  }
  return sum % 11 === 0;
}

function isValidIsbn13(code: string): boolean {
  if (!/^[0-9]{13}$/.test(code)) return false;
  // Real ISBN-13s only use the Bookland prefixes.
  if (!code.startsWith("978") && !code.startsWith("979")) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = Number(code[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return sum % 10 === 0;
}

export type IsbnCheck =
  | { ok: true; isbn: string }
  | { ok: false; reason: "empty" | "length" | "prefix" | "checksum"; cleaned: string };

export function validateIsbn(raw: string): IsbnCheck {
  const cleaned = normalizeIsbn(raw);
  if (!cleaned) return { ok: false, reason: "empty", cleaned };
  if (cleaned.length !== 10 && cleaned.length !== 13) {
    return { ok: false, reason: "length", cleaned };
  }
  if (cleaned.length === 13) {
    if (!cleaned.startsWith("978") && !cleaned.startsWith("979")) {
      return { ok: false, reason: "prefix", cleaned };
    }
    if (!isValidIsbn13(cleaned)) return { ok: false, reason: "checksum", cleaned };
    return { ok: true, isbn: cleaned };
  }
  if (!isValidIsbn10(cleaned)) return { ok: false, reason: "checksum", cleaned };
  return { ok: true, isbn: cleaned };
}
