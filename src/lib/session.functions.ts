import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionInfo = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
};

/**
 * Retorna o perfil e papéis do usuário atual.
 * O primeiro usuário do painel recebe automaticamente o papel de owner.
 */
export const getCurrentSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = (context.claims["email"] as string | undefined) ?? null;

    let { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);

    if (!roles || roles.length === 0) {
      const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true });
      const role = (count ?? 0) === 0 ? "owner" : "viewer";
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role });
      roles = [{ role }];
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();

    const list = roles.map((row) => row.role as string);
    return {
      userId: context.userId,
      email,
      displayName: profile?.display_name || email?.split("@")[0] || "Administrador",
      avatarUrl: profile?.avatar_url ?? null,
      roles: list,
      isStaff: list.some((role) => ["owner", "admin", "moderator", "support"].includes(role)),
      isAdmin: list.some((role) => ["owner", "admin"].includes(role)),
    };
  });
