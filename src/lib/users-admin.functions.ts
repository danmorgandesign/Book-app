import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin only");
}

export interface ManagedUser {
  id: string;
  email: string | null;
  role: "admin" | "teacher" | "user" | null;
  created_at: string | null;
  last_sign_in_at: string | null;
}

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw error;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    const roleMap = new Map<string, "admin" | "teacher" | "user">();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      role: roleMap.get(u.id) ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));
  });

export const inviteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    if (!email.includes("@")) throw new Error("Enter a valid email address.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    return { email, password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find existing user by email (admin listUsers has no filter API; small project)
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    let userId = list.users.find(
      (u) => u.email?.toLowerCase() === data.email,
    )?.id;

    if (!userId) {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
        });
      if (createErr) throw createErr;
      userId = created.user?.id;
    } else {
      // Reset their password to the new one provided by admin.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: data.password },
      );
      if (updErr) throw updErr;
    }

    if (!userId) throw new Error("Could not create user.");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "teacher" },
        { onConflict: "user_id,role" },
      );
    if (roleErr) throw roleErr;

    return { ok: true, userId };
  });

export const removeManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId) throw new Error("Missing userId");
    return { userId: String(data.userId) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You can't remove your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Block removing other admins as a safety net.
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if ((roles ?? []).some((r: any) => r.role === "admin")) {
      throw new Error("Cannot remove an admin account.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });
