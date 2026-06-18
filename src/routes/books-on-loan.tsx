import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, ScanLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export const Route = createFileRoute("/books-on-loan")({
  head: () => ({
    meta: [
      { title: "Books on Loan — Bathampton Primary School Library" },
      { name: "description", content: "Current loans, filterable by class." },
    ],
  }),
  component: BooksOnLoanPage,
});

interface LoanRow {
  id: string;
  loaned_at: string;
  book: { id: string; title: string; authors: string[]; cover_url: string | null } | null;
  child: { id: string; first_name: string; last_initial: string | null; class_id: string } | null;
}
interface ClassRow {
  id: string;
  name: string;
}

function BooksOnLoanPage() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [returning, setReturning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: loanData, error }, { data: classData }] = await Promise.all([
      supabase
        .from("loans")
        .select(
          "id, loaned_at, book:books(id,title,authors,cover_url), child:children(id,first_name,last_initial,class_id)",
        )
        .is("returned_at", null)
        .order("loaned_at", { ascending: false }),
      supabase.from("classes").select("id,name").order("name"),
    ]);
    if (error) toast.error(error.message);
    setLoans((loanData ?? []) as unknown as LoanRow[]);
    setClasses((classData ?? []) as ClassRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (classFilter === "all") return loans;
    return loans.filter((l) => l.child?.class_id === classFilter);
  }, [loans, classFilter]);

  async function returnLoan(id: string) {
    setReturning(id);
    const { error } = await supabase
      .from("loans")
      .update({ returned_at: new Date().toISOString() })
      .eq("id", id);
    setReturning(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Book returned");
    setLoans((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Loans</h1>
              <p className="text-sm text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length} book${filtered.length === 1 ? "" : "s"} out`}
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="h-12 gap-2 px-5 text-base">
            <Link to="/loan">
              <ScanLine className="h-5 w-5" />
              Loan a Book
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filter by class
          </span>
          <ToggleGroup
            type="single"
            value={classFilter}
            onValueChange={(v) => v && setClassFilter(v)}
            className="flex-wrap"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {classes.map((c) => (
              <ToggleGroupItem key={c.id} value={c.id}>
                {c.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium">No active loans.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {classFilter === "all"
                ? "Loan a book to get started."
                : "No books currently out for this class."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((loan) => {
              const childName = loan.child
                ? `${loan.child.first_name}${loan.child.last_initial ? ` ${loan.child.last_initial}.` : ""}`
                : "Unknown child";
              const className =
                classes.find((c) => c.id === loan.child?.class_id)?.name ?? "—";
              return (
                <li
                  key={loan.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div className="h-16 w-11 flex-none overflow-hidden rounded bg-secondary">
                    {loan.book?.cover_url ? (
                      <img
                        src={loan.book.cover_url}
                        alt={`Cover of ${loan.book.title}`}
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
                      {loan.book?.title ?? "Unknown book"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {loan.book?.authors?.join(", ") || "Unknown author"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{childName}</span>
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      {className}
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      Loaned {new Date(loan.loaned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={returning === loan.id}
                    onClick={() => returnLoan(loan.id)}
                    className="gap-1"
                  >
                    {returning === loan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Return
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
