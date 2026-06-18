import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/loan")({
  head: () => ({
    meta: [
      { title: "Loan a Book — Bathampton Primary School Library" },
      { name: "description", content: "Loan a book to a child." },
    ],
  }),
  component: LoanPage,
});

interface Book {
  id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  subgenre: string | null;
}
interface ClassRow {
  id: string;
  name: string;
}
interface ChildRow {
  id: string;
  class_id: string;
  first_name: string;
  last_initial: string | null;
}
interface Loan {
  id: string;
  book_id: string;
  child_id: string;
  loaned_at: string;
  returned_at: string | null;
}

function LoanPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedChild, setSelectedChild] = useState<string>("");

  async function load() {
    const [b, c, ch, l] = await Promise.all([
      supabase.from("books").select("id,title,authors,cover_url,subgenre").order("title"),
      supabase.from("classes").select("*").order("name"),
      supabase.from("children").select("*").order("first_name"),
      supabase.from("loans").select("*").is("returned_at", null),
    ]);
    if (b.data) setBooks(b.data as Book[]);
    if (c.data) setClasses(c.data as ClassRow[]);
    if (ch.data) setChildren(ch.data as ChildRow[]);
    if (l.data) setActiveLoans(l.data as Loan[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredChildren = children.filter((c) => c.class_id === selectedClass);
  const loanByBook = new Map(activeLoans.map((l) => [l.book_id, l]));
  const childById = new Map(children.map((c) => [c.id, c]));

  async function loan(bookId: string) {
    if (!selectedChild) {
      toast.error("Pick a child first");
      return;
    }
    const { error } = await supabase.from("loans").insert({
      book_id: bookId,
      child_id: selectedChild,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Book loaned");
      load();
    }
  }

  async function returnBook(loanId: string) {
    const { error } = await supabase
      .from("loans")
      .update({ returned_at: new Date().toISOString() })
      .eq("id", loanId);
    if (error) toast.error(error.message);
    else {
      toast.success("Book returned");
      load();
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Loan a Book</h1>
            <p className="text-sm text-muted-foreground">Pick a child, then loan a book</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Select
            value={selectedClass}
            onValueChange={(v) => {
              setSelectedClass(v);
              setSelectedChild("");
            }}
          >
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedChild}
            onValueChange={setSelectedChild}
            disabled={!selectedClass}
          >
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Choose a child" />
            </SelectTrigger>
            <SelectContent>
              {filteredChildren.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.first_name}
                  {c.last_initial ? ` ${c.last_initial}.` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">The shelf is empty.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {books.map((book) => {
              const activeLoan = loanByBook.get(book.id);
              const borrower = activeLoan ? childById.get(activeLoan.child_id) : null;
              return (
                <li key={book.id}>
                  <div className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4">
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
                      {borrower && (
                        <p className="mt-1 text-xs text-primary">
                          On loan to {borrower.first_name}
                          {borrower.last_initial ? ` ${borrower.last_initial}.` : ""}
                        </p>
                      )}
                    </div>
                    {activeLoan ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => returnBook(activeLoan.id)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" /> Return
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => loan(book.id)}
                        disabled={!selectedChild}
                      >
                        Loan
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
