import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  workerId: z.string().min(1).max(64),
  status: z.enum(["online", "degraded", "starting"]).default("online"),
  gatewayLatencyMs: z.number().int().min(0).max(60_000).optional(),
  shardCount: z.number().int().min(0).max(1000).optional(),
  version: z.string().max(40).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export function authorizeWorker(request: Request) {
  const secret = process.env["WORKER_SHARED_SECRET"];
  if (!secret) return { ok: false, response: new Response("Worker não configurado", { status: 503 }) };
  const provided = request.headers.get("x-worker-secret") ?? "";
  if (provided.length !== secret.length || provided !== secret) {
    return { ok: false, response: new Response("Não autorizado", { status: 401 }) };
  }
  return { ok: true as const, response: null };
}

export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authorizeWorker(request);
        if (!auth.ok) return auth.response!;

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Payload inválido", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("worker_heartbeats").insert({
          worker_id: parsed.data.workerId,
          status: parsed.data.status,
          gateway_latency_ms: parsed.data.gatewayLatencyMs ?? null,
          shard_count: parsed.data.shardCount ?? null,
          version: parsed.data.version ?? null,
          details: (parsed.data.details ?? {}) as never,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
