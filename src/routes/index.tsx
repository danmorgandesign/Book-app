import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanLine, BookOpen, Loader2, Search, Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CoverScanner } from "@/components/CoverScanner";
import { lookupBook, lookupBookByQuery, type BookData } from "@/lib/lookupBook";
import { identifyCover } from "@/lib/identifyCover.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shelfscan — Scan books into a shared library" },
      {
        name: "description",
        content:
          "Point your phone at a book's barcode and watch it appear in a beautiful shared catalog. No login required.",
      },
      { property: "og:title", content: "Shelfscan" },
      {
        property: "og:description",
        content: "Scan ISBN barcodes with your phone to build a shared book catalog.",
      },
    ],
  }),
  component: Index,
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
  created_at: string;
}

function Index() {
  const [books, setBooks] = useState<Book[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [coverScannerOpen, setCoverScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  async function loadBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setBooks(data as Book[]);
  }

  useEffect(() => {
    loadBooks();
    const channel = supabase
      .channel("books-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "books" },
        (payload) => {
          setBooks((prev) => {
            const next = payload.new as Book;
            if (prev.some((b) => b.id === next.id)) return prev;
            return [next, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleIsbn(rawIsbn: string) {
    setScannerOpen(false);
    setBusy(true);
    try {
      const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");
      if (isbn.length !== 10 && isbn.length !== 13) {
        toast.error("That doesn't look like a book barcode (ISBN-10/13).");
        return;
      }

      const { data: existing } = await supabase
        .from("books")
        .select("title")
        .eq("isbn", isbn)
        .maybeSingle();
      if (existing) {
        toast(`Already on the shelf: ${existing.title}`);
        return;
      }

      const book = await lookupBook(isbn);
      if (!book) {
        toast.error("Couldn't find that book. Try another edition?");
        return;
      }

      const { error } = await supabase.from("books").insert(book);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Added "${book.title}"`);
      loadBooks();
    } finally {
      setBusy(false);
    }
  }

  async function insertBook(book: Awaited<ReturnType<typeof lookupBook>>) {
    if (!book) return false;
    const { data: existing } = await supabase
      .from("books")
      .select("title")
      .eq("isbn", book.isbn)
      .maybeSingle();
    if (existing) {
      toast(`Already on the shelf: ${existing.title}`);
      return true;
    }
    const { error } = await supabase.from("books").insert(book);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(`Added "${book.title}"`);
    loadBooks();
    return true;
  }

  async function handleCover(imageBase64: string) {
    setCoverScannerOpen(false);
    setBusy(true);
    try {
      const id = await identifyCover({ data: { imageBase64 } });
      if (!id || !id.title) {
        toast.error("Couldn't read the cover. Try better lighting or a closer shot.");
        return;
      }
      // Prefer ISBN if the model returned one
      let book = id.isbn ? await lookupBook(id.isbn) : null;
      if (!book) book = await lookupBookByQuery(id.title, id.authors);
      if (!book) {
        toast.error(`Found "${id.title}" but no catalog match. Try the barcode instead.`);
        return;
      }
      await insertBook(book);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover scan failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleIsbn}
          onClose={() => setScannerOpen(false)}
        />
      )}
      {coverScannerOpen && (
        <CoverScanner
          onCapture={handleCover}
          onClose={() => setCoverScannerOpen(false)}
        />
      )}

      <header className="mx-auto max-w-5xl px-6 pt-12 pb-8 sm:pt-20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          <span className="tracking-wide uppercase">Shelfscan</span>
        </div>
        <h1 className="mt-4 text-5xl font-semibold leading-[1.05] sm:text-6xl">
          Every book,<br />
          <span className="text-primary italic">one scan</span> away.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Scan a book's barcode — or snap its front cover — and we'll add it to
          the shared shelf. No account, no fuss.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            onClick={() => setScannerOpen(true)}
            disabled={busy}
            className="h-14 gap-2 px-6 text-base"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ScanLine className="h-5 w-5" />
            )}
            Scan barcode
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setCoverScannerOpen(true)}
            disabled={busy}
            className="h-14 gap-2 px-6 text-base"
          >
            <Camera className="h-5 w-5" />
            Scan front cover
          </Button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualIsbn.trim()) {
                handleIsbn(manualIsbn.trim());
                setManualIsbn("");
              }
            }}
            className="flex flex-1 gap-2"
          >
            <Input
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="…or type an ISBN"
              className="h-14 bg-card text-base"
              inputMode="numeric"
            />
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              className="h-14"
              disabled={busy}
            >
              <Search className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="text-2xl font-semibold">The shelf</h2>
          <span className="text-sm text-muted-foreground">
            {books.length} {books.length === 1 ? "book" : "books"}
          </span>
        </div>

        {books.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <li className="group flex flex-col gap-3">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-secondary shadow-[0_10px_30px_-12px_rgba(60,30,10,0.4)] transition-transform duration-300 group-hover:-translate-y-1">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" />
          </div>
        )}
      </div>
      <div>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {book.authors.join(", ") || "Unknown author"}
        </p>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
      <p className="mt-4 font-medium">The shelf is empty.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Scan your first book to get things started.
      </p>
    </div>
  );
}
