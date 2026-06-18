import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

export const Route = createFileRoute("/classes")({
  head: () => ({
    meta: [
      { title: "Manage Classes — Library Lite" },
      { name: "description", content: "Manage classes and children for the library." },
    ],
  }),
  component: ClassesPage,
});

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

function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClass, setNewClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [classFilter, setClassFilter] = useState<string>("all");

  async function load() {
    const [c, ch] = await Promise.all([
      supabase.from("classes").select("*").order("name"),
      supabase.from("children").select("*").order("first_name"),
    ]);
    if (c.data) setClasses(c.data as ClassRow[]);
    if (ch.data) setChildren(ch.data as ChildRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClass.trim()) return;
    setBusy(true);
    await supabase.from("classes").insert({ name: newClass.trim() });
    setNewClass("");
    setBusy(false);
    setAddOpen(false);
    load();
  }

  async function deleteClass(id: string) {
    if (!confirm("Delete this class and all its children?")) return;
    await supabase.from("classes").delete().eq("id", id);
    load();
  }

  async function addChild(classId: string, first: string, initial: string) {
    if (!first.trim()) return;
    await supabase.from("children").insert({
      class_id: classId,
      first_name: first.trim(),
      last_initial: initial.trim() || null,
    });
    load();
  }

  async function deleteChild(id: string) {
    await supabase.from("children").delete().eq("id", id);
    load();
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto max-w-5xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Manage Classes</h1>
            <p className="text-sm text-muted-foreground">Classes and children</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 pb-24">
        <div className="flex justify-end">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add class
          </Button>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add a class</DialogTitle>
              <DialogDescription>
                Create a new class for the library.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={addClass} className="grid gap-4 py-2">
              <Input
                placeholder="Class name (e.g. Squirrels)"
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                autoFocus
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !newClass.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add class
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classes yet.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Filter
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
            {classes
              .filter((cls) => classFilter === "all" || cls.id === classFilter)
              .map((cls) => {
                const kids = children.filter((c) => c.class_id === cls.id);
                return (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    kids={kids}
                    onDeleteClass={() => deleteClass(cls.id)}
                    onAddChild={(f, i) => addChild(cls.id, f, i)}
                    onDeleteChild={deleteChild}
                  />
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}

function ClassCard({
  cls,
  kids,
  onDeleteClass,
  onAddChild,
  onDeleteChild,
}: {
  cls: ClassRow;
  kids: ChildRow[];
  onDeleteClass: () => void;
  onAddChild: (first: string, initial: string) => void;
  onDeleteChild: (id: string) => void;
}) {
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{cls.name}</h2>
        <Button variant="ghost" size="sm" onClick={onDeleteClass}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {kids.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No children yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-border">
          {kids.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-2">
              <span className="text-sm">
                {k.first_name}
                {k.last_initial ? ` ${k.last_initial}.` : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onDeleteChild(k.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAddChild(first, initial);
          setFirst("");
          setInitial("");
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="First name"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
        />
        <Input
          className="w-24"
          placeholder="Initial"
          maxLength={1}
          value={initial}
          onChange={(e) => setInitial(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          <Plus className="mr-1 h-4 w-4" /> Add child
        </Button>
      </form>
    </section>
  );
}
