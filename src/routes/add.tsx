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
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CoverScanner } from "@/components/CoverScanner";
import { lookupBook, lookupBookByQuery, type BookData } from "@/lib/lookupBook";
import { validateIsbn } from "@/lib/isbn";
import { Textarea } from "@/components/ui/textarea";
import { identifyCover } from "@/lib/identifyCover.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/add")({
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
  component: AddPage,
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
  retired?: boolean;
}




function AddPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [coverScannerOpen, setCoverScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [pending, setPending] = useState<BookData | null>(null);
  const [manualEntry, setManualEntry] = useState<
    | { isbn: string; reason: "not-isbn" | "not-found"; rawCode?: string }
    | null
  >(null);

  async function loadBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("retired", false)
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

  // Look up a book and, if it's new, stage it for the confirm step.
  async function stageBook(book: BookData | null) {
    if (!book) return false;
    const { data: existing } = await supabase
      .from("books")
      .select("title")
      .eq("isbn", book.isbn)
      .eq("retired", false)
      .maybeSingle();
    if (existing) {
      toast(`Already on the shelf: ${existing.title}`);
      return true;
    }
    setPending(book);
    return true;
  }

  async function handleIsbn(rawCode: string) {
    setScannerOpen(false);
    setBusy(true);
    try {
      const check = validateIsbn(rawCode);
      if (!check.ok) {
        // Not a real ISBN — e.g. a UK price sticker or school accession label.
        toast.error("That barcode isn't an ISBN. Enter the book details manually.");
        setManualEntry({
          isbn: check.cleaned,
          reason: "not-isbn",
          rawCode,
        });
        return;
      }
      const book = await lookupBook(check.isbn);
      if (!book) {
        toast.error("Couldn't find that ISBN online. Enter the details manually.");
        setManualEntry({ isbn: check.isbn, reason: "not-found" });
        return;
      }
      await stageBook(book);
    } finally {
      setBusy(false);
    }
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
      let book = id.isbn ? await lookupBook(id.isbn) : null;
      if (!book) book = await lookupBookByQuery(id.title, id.authors);
      if (!book) {
        toast.error(`Found "${id.title}" but no catalog match. Try the barcode instead.`);
        return;
      }
      await stageBook(book);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfirmed(book: BookData) {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("books")
        .insert({ ...book });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`Added "${book.title}"`);
      setPending(null);
      loadBooks();
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

      <ConfirmBookDialog
        book={pending}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={saveConfirmed}
      />

      <ManualEntryDialog
        entry={manualEntry}
        onCancel={() => setManualEntry(null)}
        onSubmit={(book) => {
          setManualEntry(null);
          stageBook(book);
        }}
      />


      <header className="mx-auto max-w-5xl px-6 pt-12 pb-8 sm:pt-20">
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

function ConfirmBookDialog({
  book,
  busy,
  onCancel,
  onConfirm,
}: {
  book: BookData | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (book: BookData) => void;
}) {
  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm book info</DialogTitle>
          <DialogDescription>
            Check the details below and add it to the library.
          </DialogDescription>
        </DialogHeader>

        {book && (
          <div className="flex gap-4">
            <div className="aspect-[2/3] w-24 flex-none overflow-hidden rounded bg-secondary">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={`Cover of ${book.title}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-6 w-6 opacity-40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{book.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {book.authors.join(", ") || "Unknown author"}
              </p>
              {book.publisher && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {book.publisher}
                  {book.published_date ? ` · ${book.published_date}` : ""}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">ISBN {book.isbn}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!book || busy}
            onClick={() => book && onConfirm(book)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function ManualEntryDialog({
  entry,
  onCancel,
  onSubmit,
}: {
  entry: { isbn: string; reason: "not-isbn" | "not-found"; rawCode?: string } | null;
  onCancel: () => void;
  onSubmit: (book: BookData) => void;
}) {
  const [title, setTitle] = useState("");
  const [authorsText, setAuthorsText] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!entry) return;
    setTitle("");
    setAuthorsText("");
    setIsbn(entry.reason === "not-found" ? entry.isbn : "");
    setPublisher("");
    setPublishedDate("");
    setPageCount("");
    setCoverUrl("");
    setDescription("");
  }, [entry]);

  if (!entry) return null;

  const canSave = title.trim().length > 0 && isbn.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const authors = authorsText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    onSubmit({
      isbn: isbn.trim(),
      title: title.trim(),
      authors,
      publisher: publisher.trim() || null,
      published_date: publishedDate.trim() || null,
      page_count: pageCount ? parseInt(pageCount, 10) : null,
      cover_url: coverUrl.trim() || null,
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add book manually</DialogTitle>
          <DialogDescription>
            {entry.reason === "not-isbn" ? (
              <>
                The scanned barcode <span className="font-mono">{entry.rawCode ?? entry.isbn}</span>{" "}
                isn&apos;t an ISBN (it looks like a school sticker or price label).
                Enter the book&apos;s real details below — the ISBN is on the back
                cover or copyright page, usually starting with 978 or 979.
              </>
            ) : (
              <>
                We couldn&apos;t find ISBN <span className="font-mono">{entry.isbn}</span> in
                any of the lookup sources. Fill in what you can — at minimum a title
                and ISBN.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Title
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Authors
            </label>
            <Input
              value={authorsText}
              onChange={(e) => setAuthorsText(e.target.value)}
              placeholder="Comma separated"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ISBN
              </label>
              <Input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978…"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Published
              </label>
              <Input
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                placeholder="2019"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Publisher
              </label>
              <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pages
              </label>
              <Input
                type="number"
                inputMode="numeric"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cover image URL
            </label>
            <Input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
