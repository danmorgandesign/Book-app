import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  listManagedUsers,
  inviteManagedUser,
  removeManagedUser,
  type ManagedUser,
} from "@/lib/users-admin.functions";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [{ title: "Users — Library Lite" }],
  }),
  component: UsersPage,
});

function UsersPage() {
  const list = useServerFn(listManagedUsers);
  const invite = useServerFn(inviteManagedUser);
  const remove = useServerFn(removeManagedUser);

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [meId, setMeId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list();
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setMeId(uid);
      if (!uid) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const isAdmin = !!roles?.some((r) => r.role === "admin");
      setAllowed(isAdmin);
      if (isAdmin) refresh();
      else setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await invite({ data: { email: email.trim(), password } });
      toast.success(`Added ${email.trim()}`);
      setEmail("");
      setPassword("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add user");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(userId: string, email: string | null) {
    if (!confirm(`Remove ${email ?? "this user"}? They will lose all access.`))
      return;
    try {
      await remove({ data: { userId } });
      toast.success("User removed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove user");
    }
  }

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold">Admins only</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You don't have permission to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="mx-auto max-w-3xl px-6 pt-8 pb-4 sm:pt-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Users</h1>
            <p className="text-sm text-muted-foreground">
              Grant teachers access by adding their email and a starter password.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <form
          onSubmit={onInvite}
          className="mb-8 rounded-2xl border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold">Add a teacher</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="email"
              required
              placeholder="teacher@school.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
            <Input
              type="text"
              required
              minLength={6}
              placeholder="Starter password (min 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="mr-1 h-4 w-4" /> Add
                </>
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Share the email and password with the teacher. They can sign in
            straight away.
          </p>
        </form>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Current users
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => {
              const isAdmin = u.role === "admin";
              const isMe = u.id === meId;
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.email ?? "(no email)"}
                      {isMe && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? `Last sign-in ${new Date(u.last_sign_in_at).toLocaleDateString()}`
                        : "Never signed in"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isAdmin
                        ? "bg-primary text-primary-foreground"
                        : u.role === "teacher"
                          ? "bg-secondary text-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {u.role ?? "no role"}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isAdmin || isMe}
                    onClick={() => onRemove(u.id, u.email)}
                    title={
                      isAdmin
                        ? "Admins can't be removed"
                        : isMe
                          ? "You can't remove yourself"
                          : "Remove user"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
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
