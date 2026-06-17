import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ArrowLeft, Loader2, Library, SlidersHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/books")({
  head: () => ({
    meta: [
      { title: "Library — Shelfscan" },
      {
        name: "description",
        content: "Browse every book that has been scanned into the shared Shelfscan catalog.",
      },
      { property: "og:title", content: "Library — Shelfscan" },
      {
        property: "og:description",
        content: "Browse every book that has been scanned into the shared Shelfscan catalog.",
      },
    ],
  }),
  component: BooksPage,
});

interface Book {
  id: string;
  isbn: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  publisher: string | null;
  published_date: string | null;
  page_count: number | null;
  category: string | null;
  subgenre: string | null;
  created_at: string;
}

function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function loadBooks() {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
      } else {
        setBooks(data as Book[]);
      }
      setLoading(false);
    }
    loadBooks();
  }, []);

  const filtered = books.filter((b) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.authors.some((a) => a.toLowerCase().includes(q)) ||
      (b.subgenre && b.subgenre.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.includes(q))
    );
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-4 sm:pt-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to scanner
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Library className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Library</h1>
            <p className="text-sm text-muted-foreground">
              {books.length} {books.length === 1 ? "book" : "books"} on the shelf
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-6">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by title, author, genre, or ISBN…"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none ring-primary/20 transition-shadow placeholder:text-muted-foreground focus:ring-2"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading catalog…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">
              {filter ? "No matches found." : "The shelf is empty."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter
                ? "Try a different search term."
                : "Scan your first book to get things started."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((book) => (
              <li
                key={book.id}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="h-16 w-11 flex-none overflow-hidden rounded bg-secondary">
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.cover_url}
                      alt={`Cover of ${book.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-5 w-5 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug">
                    {book.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {book.authors.join(", ") || "Unknown author"}
                    {book.published_date ? ` · ${book.published_date}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {book.subgenre && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {book.subgenre}
                    </span>
                  )}
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {book.isbn}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
