import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authorizeWorker } from "./heartbeat";

/**
 * Fila de ações que exigem gateway persistente.
 * GET: worker externo busca ações pendentes. POST: worker confirma execução.
 */
const ackSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["done", "failed"]),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(500).optional(),
});

export const Route = createFileRoute("/api/public/worker/actions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = authorizeWorker(request);
        if (!auth.ok) return auth.response!;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("worker_actions")
          .select("id, action_type, payload, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(25);
        return Response.json({ actions: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = authorizeWorker(request);
        if (!auth.ok) return auth.response!;
        const parsed = ackSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Payload inválido", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("worker_actions")
          .update({
            status: parsed.data.status,
            last_error: parsed.data.error ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.id);
        return Response.json({ ok: true });
      },
    },
  },
});
