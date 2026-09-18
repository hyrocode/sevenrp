import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Gera uma URL temporária para exibir um arquivo privado do bucket de artes. */
export const getSignedAssetUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ data, context }) => {
    if (!data.path) return { url: null as string | null };
    const { data: signed, error } = await context.supabase.storage
      .from("brand-assets")
      .createSignedUrl(data.path, 60 * 60);
    if (error) return { url: null as string | null };
    return { url: signed?.signedUrl ?? null };
  });
