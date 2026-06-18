import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function NavBar() {
  const { location } = useRouterState();
  const current = location.pathname;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (!cancelled) setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkClass = (path: string) =>
    `text-sm font-medium underline-offset-4 hover:underline ${
      current === path ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Bathampton Primary School Library
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/" className={linkClass("/")}>
            Scanner
          </Link>
          <Link to="/books" className={linkClass("/books")}>
            Library
          </Link>
          <Link to="/loan" className={linkClass("/loan")}>
            Loan Book
          </Link>
          <Link to="/classes" className={linkClass("/classes")}>
            Manage Classes
          </Link>
          {isAdmin && (
            <Link to="/users" className={linkClass("/users")}>
              Users
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
