import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authorizeWorker } from "./heartbeat";

/**
 * Ingestão de eventos observados por um worker de gateway persistente externo.
 * Só metadados: nenhuma mídia é armazenada (conteúdo sensível vira fila de revisão).
 */
const schema = z.object({
  type: z.enum(["blocked_term", "spam", "nsfw", "raid", "moderation", "member_join"]),
  channelId: z.string().max(32).optional(),
  channelName: z.string().max(120).optional(),
  authorId: z.string().max(32).optional(),
  authorLabel: z.string().max(120).optional(),
  guildId: z.string().max(32).optional(),
  avatarUrl: z.string().max(500).nullish(),
  memberNumber: z.number().int().min(0).optional(),
  messageId: z.string().max(32).optional(),
  messageLink: z.string().url().max(300).optional(),
  alreadySent: z.boolean().optional(),
  term: z.string().max(120).optional(),
  confidence: z.number().min(0).max(1).optional(),
  contentType: z.enum(["image", "video", "text", "link"]).optional(),
  joinsDetected: z.number().int().min(0).max(100000).optional(),
  windowSeconds: z.number().int().min(1).max(86400).optional(),
  actionTaken: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/worker/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authorizeWorker(request);
        if (!auth.ok) return auth.response!;

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Payload inválido", { status: 400 });
        const event = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event.type === "member_join") {
          if (!event.guildId || !event.authorId) return new Response("Payload inválido", { status: 400 });

          if (event.alreadySent) {
            await supabaseAdmin.from("welcome_events").insert({
              guild_id: event.guildId,
              member_id: event.authorId,
              username: event.authorLabel ?? "Novo membro",
              status: "sent",
              message_id: event.messageId ?? null,
              channel_id: event.channelId ?? "1545352442160611469",
            });
            return Response.json({ ok: true, direct: true });
          }

          const { sendWelcome } = await import("@/lib/welcome.server");
          const result = await sendWelcome({
            guildId: event.guildId,
            memberId: event.authorId,
            username: event.authorLabel ?? "Novo membro",
            avatarUrl: event.avatarUrl ?? null,
            memberNumber: event.memberNumber ?? null,
          });
          return Response.json(result);
        }

        if (event.type === "nsfw") {
          await supabaseAdmin.from("nsfw_reviews").insert({
            channel_id: event.channelId ?? null,
            channel_name: event.channelName ?? null,
            author_label: event.authorLabel ?? null,
            author_discord_id: event.authorId ?? null,
            message_id: event.messageId ?? null,
            message_link: event.messageLink ?? null,
            content_type: event.contentType ?? "image",
            confidence: event.confidence ?? 0,
            metadata: (event.metadata ?? {}) as never,
          });
          return Response.json({ ok: true, queued: "nsfw_review" });
        }

        if (event.type === "raid") {
          await supabaseAdmin.from("raid_events").insert({
            trigger: event.actionTaken ?? "join_burst",
            joins_detected: event.joinsDetected ?? null,
            window_seconds: event.windowSeconds ?? null,
            action_taken: event.actionTaken ?? null,
            details: (event.metadata ?? {}) as never,
          });
          return Response.json({ ok: true, queued: "raid_event" });
        }

        if (event.type === "blocked_term" && event.term) {
          const { data: term } = await supabaseAdmin
            .from("blocked_terms")
            .select("id, hits, min_confidence, action")
            .eq("term", event.term)
            .maybeSingle();
          if (term) {
            await supabaseAdmin.from("blocked_terms").update({ hits: (term.hits ?? 0) + 1 }).eq("id", term.id);
            const confident = (event.confidence ?? 1) >= Number(term.min_confidence ?? 0.7);
            if (!confident) {
              return Response.json({ ok: true, skipped: "abaixo do limiar de confiança" });
            }
          }
        }

        await supabaseAdmin.from("moderation_cases").insert({
          target_label: event.authorLabel ?? "Desconhecido",
          target_discord_id: event.authorId ?? null,
          reason: event.term ? `Termo bloqueado: ${event.term}` : `Detecção automática: ${event.type}`,
          severity: (event.confidence ?? 0) > 0.9 ? "high" : "medium",
          source: "worker",
          evidence: (event.metadata ?? {}) as never,
        });

        return Response.json({ ok: true, queued: "moderation_case" });
      },
    },
  },
});
