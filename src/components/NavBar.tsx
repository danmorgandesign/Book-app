import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ChevronDown, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  const linkClass = (active: boolean) =>
    `text-sm font-medium underline-offset-4 hover:underline ${
      active ? "text-foreground" : "text-muted-foreground"
    }`;

  const libraryActive = current === "/books" || current === "/add";
  const adminActive = current === "/classes" || current === "/users";

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Library Lite
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/books-on-loan" className={linkClass(current === "/books-on-loan")}>
            Books on Loan
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1 ${linkClass(libraryActive)}`}
            >
              Library
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link to="/books">Search Books</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/add">Add Book</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex items-center gap-1 ${linkClass(adminActive)}`}
              >
                Admin
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/classes">Manage Classes</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/users">Users</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Link
            to="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ScanLine className="h-4 w-4" />
            Loan a Book
          </Link>
        </div>
      </div>
    </nav>
  );
}
