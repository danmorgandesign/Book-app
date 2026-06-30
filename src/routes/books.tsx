import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Library, SlidersHorizontal, Save, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  retired?: boolean;
}

import { SUBGENRES } from "@/lib/taxonomy";

function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Book | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    async function loadBooks() {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("retired", false)
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
    const q = filter.toLowerCase();
    if (!filter) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.authors.some((a) => a.toLowerCase().includes(q)) ||
      (b.isbn && b.isbn.includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  function handleSaved(updated: Book) {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditing(null);
  }

  function handleRetired(id: string) {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setEditing(null);
  }


  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex items-center gap-3">
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by title, author, or ISBN…"
            className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none ring-primary/20 transition-shadow placeholder:text-muted-foreground focus:ring-2"
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
          <>
            <ul className="flex flex-col gap-3">
              {paginated.map((book) => (
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
                        {book.published_date ? ` · ${book.published_date}` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditing(book)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline focus:outline-none"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit this Book
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {book.isbn}
                      </span>
                    </div>

                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {filtered.length} books
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <EditBookDialog
        book={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
        onRetired={handleRetired}
      />
    </div>
  );
}

function EditBookDialog({
  book,
  onClose,
  onSaved,
  onRetired,
}: {
  book: Book | null;
  onClose: () => void;
  onSaved: (b: Book) => void;
  onRetired: (id: string) => void;
}) {
  const [form, setForm] = useState<Book | null>(book);
  const [authorsText, setAuthorsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState(false);

  useEffect(() => {
    setForm(book);
    setAuthorsText(book?.authors.join(", ") ?? "");
  }, [book]);

  if (!form) return null;


  async function handleSave() {
    if (!form) return;
    setSaving(true);
    const authors = authorsText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const patch = {
      title: form.title.trim(),
      authors,
      isbn: form.isbn.trim(),
      publisher: form.publisher?.trim() || null,
      published_date: form.published_date?.trim() || null,
      page_count: form.page_count,
      cover_url: form.cover_url?.trim() || null,
      category: form.category,
      subgenre: form.subgenre,
    };
    const { data, error } = await supabase
      .from("books")
      .update(patch)
      .eq("id", form.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Couldn't save changes", { description: error.message });
      return;
    }
    toast.success("Book updated");
    onSaved(data as Book);
  }

  async function handleRetire() {
    if (!form) return;
    setRetiring(true);
    const { error } = await supabase
      .from("books")
      .update({ retired: true })
      .eq("id", form.id);
    setRetiring(false);
    if (error) {
      console.error(error);
      toast.error("Couldn't retire book", { description: error.message });
      return;
    }
    toast.success("Book retired");
    onRetired(form.id);
  }

  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit book</DialogTitle>
          <DialogDescription>
            Update details for this entry in the catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="authors">Authors</Label>
            <Input
              id="authors"
              value={authorsText}
              onChange={(e) => setAuthorsText(e.target.value)}
              placeholder="Comma separated"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                value={form.isbn}
                onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="published">Published</Label>
              <Input
                id="published"
                value={form.published_date ?? ""}
                onChange={(e) => setForm({ ...form, published_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                value={form.publisher ?? ""}
                onChange={(e) => setForm({ ...form, publisher: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pages">Pages</Label>
              <Input
                id="pages"
                type="number"
                value={form.page_count ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    page_count: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
            </div>
          </div>


          <div className="grid gap-1.5">
            <Label htmlFor="cover">Cover URL</Label>
            <Textarea
              id="cover"
              rows={2}
              value={form.cover_url ?? ""}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="destructive"
            onClick={handleRetire}
            disabled={saving || retiring}
          >
            {retiring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Retire book
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving || retiring}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || retiring}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}