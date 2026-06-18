import { useEffect, useState, type ReactNode, type FormEvent } from "react";

const STORAGE_KEY = "bathampton-auth";
const USERNAME = "danmorgandesign@gmail.com";
const PASSWORD = "morgan";

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showLostPassword, setShowLostPassword] = useState(false);

  useEffect(() => {
    try {
      setAuthed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  if (authed) {
    return (
      <>
        {children}
        <button
          onClick={() => {
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              /* ignore */
            }
            setAuthed(false);
          }}
          className="fixed bottom-4 right-4 z-50 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
        >
          Sign out
        </button>
      </>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.trim() === USERNAME && password === PASSWORD) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      setAuthed(true);
      setError(null);
    } else {
      setError("Incorrect username or password.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bathampton Library
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="username"
            type="email"
            autoComplete="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
