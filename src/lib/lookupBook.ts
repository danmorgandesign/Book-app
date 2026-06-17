export interface BookData {
  isbn: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  description: string | null;
}

function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "");
}

export async function lookupBook(rawIsbn: string): Promise<BookData | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (isbn.length !== 10 && isbn.length !== 13) return null;

  // Try Open Library first
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
    if (res.ok) {
      const json = await res.json();
      const entry = json[`ISBN:${isbn}`];
      if (entry) {
        return {
          isbn,
          title: entry.title ?? "Untitled",
          authors: (entry.authors ?? []).map((a: { name: string }) => a.name),
          cover_url: entry.cover?.large ?? entry.cover?.medium ?? entry.cover?.small ?? null,
          publisher: (entry.publishers ?? []).map((p: { name: string }) => p.name).join(", ") || null,
          published_date: entry.publish_date ?? null,
          page_count: entry.number_of_pages ?? null,
          description: typeof entry.notes === "string" ? entry.notes : null,
        };
      }
    }
  } catch {
    // fall through
  }

  // Fallback: Google Books
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    );
    if (res.ok) {
      const json = await res.json();
      const item = json.items?.[0]?.volumeInfo;
      if (item) {
        return {
          isbn,
          title: item.title ?? "Untitled",
          authors: item.authors ?? [],
          cover_url:
            item.imageLinks?.thumbnail?.replace("http:", "https:") ?? null,
          publisher: item.publisher ?? null,
          published_date: item.publishedDate ?? null,
          page_count: item.pageCount ?? null,
          description: item.description ?? null,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function fromGoogleVolume(item: any, fallbackIsbn?: string): BookData | null {
  const info = item?.volumeInfo;
  if (!info) return null;
  const ids: Array<{ type: string; identifier: string }> = info.industryIdentifiers ?? [];
  const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier;
  const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier;
  const isbn = isbn13 ?? isbn10 ?? fallbackIsbn ?? "";
  if (!isbn) return null;
  return {
    isbn: normalizeIsbn(isbn),
    title: info.title ?? "Untitled",
    authors: info.authors ?? [],
    cover_url: info.imageLinks?.thumbnail?.replace("http:", "https:") ?? null,
    publisher: info.publisher ?? null,
    published_date: info.publishedDate ?? null,
    page_count: info.pageCount ?? null,
    description: info.description ?? null,
  };
}

export async function lookupBookByQuery(
  title: string,
  authors: string[] = [],
): Promise<BookData | null> {
  const q = [
    title ? `intitle:${title}` : "",
    ...authors.filter(Boolean).map((a) => `inauthor:${a}`),
  ]
    .filter(Boolean)
    .join("+");
  if (!q) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const items: any[] = json.items ?? [];
    for (const item of items) {
      const book = fromGoogleVolume(item);
      if (book) return book;
    }
  } catch {
    // ignore
  }
  return null;
}
