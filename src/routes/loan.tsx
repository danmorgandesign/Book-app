import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/loan")({
  head: () => ({
    meta: [
      { title: "Loan a Book — Shelfscan" },
      {
        name: "description",
        content: "Loan a book from the Bathampton Primary School Library.",
      },
    ],
  }),
  component: LoanPage,
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

function LoanPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBooks() {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("title", { ascending: true });
      if (error) {
        console.error(error);
      } else {
        setBooks(data as Book[]);
      }
      setLoading(false);
    }
    loadBooks();
  }, []);

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
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Loan a Book</h1>
            <p className="text-sm text-muted-foreground">
              Browse and loan books from the library
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading catalog…</p>
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">The shelf is empty.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No books available to loan right now.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {books.map((book) => (
              <li key={book.id}>
                <div className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40">
                  <div className="h-16 w-11 flex-none overflow-hidden rounded bg-secondary">
                    {book.cover_url ? (
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
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {book.subgenre && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {book.subgenre}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
