import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureLibraryUser } from "@/lib/library-user.functions";
import { NavBar } from "./NavBar";


export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showLostPassword, setShowLostPassword] = useState(false);
  const ensureUser = useServerFn(ensureLibraryUser);

  useEffect(() => {
    // Ensure the library account exists (idempotent, server-side).
    ensureUser({}).catch((e) => console.error("ensureLibraryUser failed", e));

    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, [ensureUser]);

  if (!ready) return null;

  if (authed) {
    return (
      <>
        <NavBar />
        {children}
        <button
          onClick={() => {
            supabase.auth.signOut();
          }}
          className="fixed bottom-4 right-4 z-50 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
        >
          Sign out
        </button>
      </>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Make sure the account exists before first sign-in attempt.
    try {
      await ensureUser({});
    } catch {
      /* non-fatal; sign-in will surface its own error */
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Incorrect email or password.");
    }
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bathampton Primary School Library
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowLostPassword((s) => !s)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Lost your password?
          </button>
          {showLostPassword && (
            <p className="mt-2 text-sm text-muted-foreground">
              Please contact the administrator to reset your password.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
