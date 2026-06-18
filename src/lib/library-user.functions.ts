import { createServerFn } from "@tanstack/react-start";

const LIBRARY_EMAIL = "danmorgandesign@gmail.com";
const LIBRARY_PASSWORD = "morgan";

/**
 * Idempotently ensures the single library user exists in Supabase Auth.
 * Safe to call repeatedly; only ever creates this one specific account.
 */
export const ensureLibraryUser = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if user already exists by listing (small project, fine).
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw listError;

    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === LIBRARY_EMAIL.toLowerCase(),
    );
    if (existing) return { ok: true, created: false };

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: LIBRARY_EMAIL,
      password: LIBRARY_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw createError;

    return { ok: true, created: true };
  },
);
