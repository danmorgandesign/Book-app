import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Loader2,
  ScanLine,
  Camera,
  Search,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loan a Book — Library Lite" },
      { name: "description", content: "Scan a book and loan it to a child." },
    ],
  }),
  component: LoanPage,
});

import { SUBGENRES } from "@/lib/taxonomy";

interface DbBook {
  id: string;
  isbn: string;
  title: string;
  authors: string[];
  cover_url: string | null;
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

type Step =
  | "scan"
  | "confirm-book"
  | "add-to-collection"
  | "choose-class"
  | "choose-child"
  | "confirm-loan"
  | "done";

function LoanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [coverScannerOpen, setCoverScannerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");

  // book in play (either found in DB or newly looked up)
  const [foundBook, setFoundBook] = useState<DbBook | null>(null);
  const [pendingNew, setPendingNew] = useState<BookData | null>(null);

  // class / child selection
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedChild, setSelectedChild] = useState<string>("");

  // existing active loan info (if book already on loan)
  const [activeLoan, setActiveLoan] = useState<{
    id: string;
    child_id: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [c, ch] = await Promise.all([
        supabase.from("classes").select("*").order("name"),
        supabase.from("children").select("*").order("first_name"),
      ]);
      if (c.data) setClasses(c.data as ClassRow[]);
      if (ch.data) setChildren(ch.data as ChildRow[]);
    })();
  }, []);

  function reset() {
    setStep("scan");
    setFoundBook(null);
    setPendingNew(null);
    setSelectedClass("");
    setSelectedChild("");
    setActiveLoan(null);
  }

  async function processIsbn(rawIsbn: string) {
    const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) {
      toast.error("That doesn't look like a book barcode.");
      return;
    }
    setBusy(true);
    try {
      // Check if already in our library
      const { data: existing } = await supabase
        .from("books")
        .select("id,isbn,title,authors,cover_url")
        .eq("isbn", isbn)
        .eq("retired", false)
        .maybeSingle();
      if (existing) {
        const eBook = existing as DbBook;
        setFoundBook(eBook);
        // check active loan
        const { data: loan } = await supabase
          .from("loans")
          .select("id,child_id")
          .eq("book_id", eBook.id)
          .is("returned_at", null)
          .maybeSingle();
        setActiveLoan(loan ?? null);
        setStep("confirm-book");
        return;
      }
      // Not in DB — look up externally
      const book = await lookupBook(isbn);
      if (!book) {
        toast.error("Couldn't find that book. Try another edition?");
        return;
      }
      setPendingNew(book);
      setStep("add-to-collection");
    } finally {
      setBusy(false);
    }
  }

  async function handleIsbn(raw: string) {
    setScannerOpen(false);
    await processIsbn(raw);
  }

  async function handleCover(imageBase64: string) {
    setCoverScannerOpen(false);
    setBusy(true);
    try {
      const id = await identifyCover({ data: { imageBase64 } });
      if (!id || !id.title) {
        toast.error("Couldn't read the cover. Try better lighting.");
        return;
      }
      let book = id.isbn ? await lookupBook(id.isbn) : null;
      if (!book) book = await lookupBookByQuery(id.title, id.authors);
      if (!book) {
        toast.error(`Found "${id.title}" but no catalog match. Try the barcode.`);
        return;
      }
      // Reuse processIsbn path for db check
      await processIsbn(book.isbn);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addToCollection(
    book: BookData,
    category: string,
    subgenre: string,
  ) {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("books")
        .insert({ ...book, category, subgenre })
        .select("id,isbn,title,authors,cover_url")
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Could not add book.");
        return;
      }
      toast.success(`Added "${book.title}"`);
      setFoundBook(data as DbBook);
      setPendingNew(null);
      setActiveLoan(null);
      setStep("choose-class");
    } finally {
      setBusy(false);
    }
  }

  async function confirmLoan() {
    if (!foundBook || !selectedChild) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("loans").insert({
        book_id: foundBook.id,
        child_id: selectedChild,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  async function returnActive() {
    if (!activeLoan) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("loans")
        .update({ returned_at: new Date().toISOString() })
        .eq("id", activeLoan.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Book returned");
      setActiveLoan(null);
    } finally {
      setBusy(false);
    }
  }

  const filteredChildren = children.filter((c) => c.class_id === selectedClass);
  const childById = new Map(children.map((c) => [c.id, c]));
  const classById = new Map(classes.map((c) => [c.id, c]));

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

      <header className="mx-auto max-w-3xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Loan a Book</h1>
            <p className="text-sm text-muted-foreground">
              Scan a book, then pick the child borrowing it.
            </p>
          </div>
        </div>
        <StepBar step={step} />
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        {step === "scan" && (
          <ScanStep
            busy={busy}
            manualIsbn={manualIsbn}
            setManualIsbn={setManualIsbn}
            onScanBarcode={() => setScannerOpen(true)}
            onScanCover={() => setCoverScannerOpen(true)}
            onManual={(v) => processIsbn(v)}
          />
        )}

        {step === "confirm-book" && foundBook && (
          <ConfirmBookStep
            book={foundBook}
            activeLoanChildName={
              activeLoan
                ? (() => {
                    const c = childById.get(activeLoan.child_id);
                    return c
                      ? `${c.first_name}${c.last_initial ? ` ${c.last_initial}.` : ""}`
                      : "another child";
                  })()
                : null
            }
            busy={busy}
            onYes={() => setStep("choose-class")}
            onNo={reset}
            onReturn={returnActive}
          />
        )}

        {step === "add-to-collection" && pendingNew && (
          <AddToCollectionStep
            book={pendingNew}
            busy={busy}
            onCancel={reset}
            onConfirm={addToCollection}
          />
        )}

        {step === "choose-class" && (
          <ChoosePersonStep
            title="Choose a class"
            options={classes.map((c) => ({ id: c.id, label: c.name }))}
            value={selectedClass}
            onChange={(v) => {
              setSelectedClass(v);
              setSelectedChild("");
            }}
            onBack={() => setStep("confirm-book")}
            onNext={() => setStep("choose-child")}
            emptyHint="No classes yet — add one on Manage Classes."
          />
        )}

        {step === "choose-child" && (
          <ChoosePersonStep
            title="Choose a child"
            options={filteredChildren.map((c) => ({
              id: c.id,
              label: `${c.first_name}${c.last_initial ? ` ${c.last_initial}.` : ""}`,
            }))}
            value={selectedChild}
            onChange={setSelectedChild}
            onBack={() => setStep("choose-class")}
            onNext={() => setStep("confirm-loan")}
            emptyHint="No children in that class yet."
          />
        )}

        {step === "confirm-loan" && foundBook && (
          <ConfirmLoanStep
            book={foundBook}
            className={classById.get(selectedClass)?.name ?? ""}
            childName={(() => {
              const c = childById.get(selectedChild);
              return c
                ? `${c.first_name}${c.last_initial ? ` ${c.last_initial}.` : ""}`
                : "";
            })()}
            busy={busy}
            onBack={() => setStep("choose-child")}
            onConfirm={confirmLoan}
          />
        )}

        {step === "done" && foundBook && (
          <DoneStep
            book={foundBook}
            childName={(() => {
              const c = childById.get(selectedChild);
              return c
                ? `${c.first_name}${c.last_initial ? ` ${c.last_initial}.` : ""}`
                : "";
            })()}
            onAnother={reset}
          />
        )}
      </main>
    </div>
  );
}

function StepBar({ step }: { step: Step }) {
  const labels: { key: Step; label: string }[] = [
    { key: "scan", label: "Scan" },
    { key: "confirm-book", label: "Confirm" },
    { key: "choose-class", label: "Class" },
    { key: "choose-child", label: "Child" },
    { key: "confirm-loan", label: "Loan" },
  ];
  const idx = (() => {
    if (step === "add-to-collection") return 1;
    if (step === "done") return 4;
    return labels.findIndex((l) => l.key === step);
  })();
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs">
      {labels.map((l, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <li key={l.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={
                active
                  ? "font-medium"
                  : done
                    ? "text-primary"
                    : "text-muted-foreground"
              }
            >
              {l.label}
            </span>
            {i < labels.length - 1 && (
              <span className="mx-1 text-muted-foreground/40">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ScanStep({
  busy,
  manualIsbn,
  setManualIsbn,
  onScanBarcode,
  onScanCover,
  onManual,
}: {
  busy: boolean;
  manualIsbn: string;
  setManualIsbn: (v: string) => void;
  onScanBarcode: () => void;
  onScanCover: () => void;
  onManual: (v: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Scan the book</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use the barcode for the most reliable match, or snap the front cover.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          size="lg"
          onClick={onScanBarcode}
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
          onClick={onScanCover}
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
              onManual(manualIsbn.trim());
              setManualIsbn("");
            }
          }}
          className="flex flex-1 gap-2"
        >
          <Input
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
            placeholder="…or type an ISBN"
            className="h-14 bg-background text-base"
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
    </section>
  );
}

function BookCard({
  title,
  authors,
  cover_url,
}: {
  title: string;
  authors: string[];
  cover_url: string | null;
}) {
  return (
    <div className="flex gap-4">
      <div className="aspect-[2/3] w-24 flex-none overflow-hidden rounded bg-secondary">
        {cover_url ? (
          <img
            src={cover_url}
            alt={`Cover of ${title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className="h-6 w-6 opacity-40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {authors.join(", ") || "Unknown author"}
        </p>
      </div>
    </div>
  );
}

function ConfirmBookStep({
  book,
  activeLoanChildName,
  busy,
  onYes,
  onNo,
  onReturn,
}: {
  book: DbBook;
  activeLoanChildName: string | null;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
  onReturn: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Is this the right book?</h2>
      <div className="mt-4">
        <BookCard {...book} />
      </div>
      {activeLoanChildName && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Currently on loan to <strong>{activeLoanChildName}</strong>.
          <Button
            size="sm"
            variant="secondary"
            className="ml-3"
            disabled={busy}
            onClick={onReturn}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Mark returned
          </Button>
        </div>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onNo} disabled={busy}>
          <X className="mr-1 h-4 w-4" /> Not the right book
        </Button>
        <Button onClick={onYes} disabled={busy || !!activeLoanChildName}>
          <Check className="mr-1 h-4 w-4" /> Yes, loan it
        </Button>
      </div>
    </section>
  );
}

function AddToCollectionStep({
  book,
  busy,
  onCancel,
  onConfirm,
}: {
  book: BookData;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (book: BookData, category: string, subgenre: string) => void;
}) {
  const [category, setCategory] = useState<"Fiction" | "Non-Fiction" | "">("");
  const [subgenre, setSubgenre] = useState<string>("");
  const options = category ? SUBGENRES[category] : [];
  const canSave = !!category && !!subgenre && !busy;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Add this book to the collection</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        It's not on our shelf yet. Pick a category, then we'll loan it.
      </p>
      <div className="mt-4">
        <BookCard
          title={book.title}
          authors={book.authors}
          cover_url={book.cover_url}
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Category
          </label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v as "Fiction" | "Non-Fiction");
              setSubgenre("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Fiction / Non-Fiction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fiction">Fiction</SelectItem>
              <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sub-genre
          </label>
          <Select value={subgenre} onValueChange={setSubgenre} disabled={!category}>
            <SelectTrigger>
              <SelectValue
                placeholder={category ? "Choose a shelf" : "Pick category first"}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          disabled={!canSave}
          onClick={() => category && subgenre && onConfirm(book, category, subgenre)}
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Add & continue
        </Button>
      </div>
    </section>
  );
}

function ChoosePersonStep({
  title,
  options,
  value,
  onChange,
  onBack,
  onNext,
  emptyHint,
}: {
  title: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  emptyHint: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {options.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              className={`rounded-xl border px-3 py-4 text-sm font-medium transition ${
                value === o.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!value}>
          Next
        </Button>
      </div>
    </section>
  );
}

function ConfirmLoanStep({
  book,
  className,
  childName,
  busy,
  onBack,
  onConfirm,
}: {
  book: DbBook;
  className: string;
  childName: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Confirm the loan</h2>
      <div className="mt-4">
        <BookCard {...book} />
      </div>
      <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-secondary/40 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Class
          </dt>
          <dd className="mt-0.5 font-medium">{className}</dd>
        </div>
        <div className="rounded-lg bg-secondary/40 p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Borrower
          </dt>
          <dd className="mt-0.5 font-medium">{childName}</dd>
        </div>
        <div className="rounded-lg bg-secondary/40 p-3 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Loaned on
          </dt>
          <dd className="mt-0.5 font-medium">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1 h-4 w-4" />
          )}
          Confirm loan
        </Button>
      </div>
    </section>
  );
}

function DoneStep({
  book,
  childName,
  onAnother,
}: {
  book: DbBook;
  childName: string;
  onAnother: () => void;
}) {
  return (
    <section className="rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Loan recorded</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>{book.title}</strong> is now on loan to{" "}
        <strong>{childName}</strong>.
      </p>
      <Button className="mt-6" onClick={onAnother}>
        <ScanLine className="mr-1 h-4 w-4" /> Loan another book
      </Button>
    </section>
  );
}
