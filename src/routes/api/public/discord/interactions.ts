import { createFileRoute } from "@tanstack/react-router";

/**
 * Interactions Endpoint oficial do Discord (slash commands sem gateway).
 * Configure esta URL em Discord Developer Portal > Interactions Endpoint URL.
 * A assinatura Ed25519 é verificada antes de qualquer processamento.
 */
function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function verifySignature(publicKey: string, signature: string, timestamp: string, body: string) {
  try {
    const key = await crypto.subtle.importKey("raw", hexToBytes(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/discord/interactions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const publicKey = process.env["DISCORD_PUBLIC_KEY"];
        if (!publicKey) return new Response("Interactions não configuradas", { status: 503 });

        const signature = request.headers.get("x-signature-ed25519");
        const timestamp = request.headers.get("x-signature-timestamp");
        const body = await request.text();
        if (!signature || !timestamp || !(await verifySignature(publicKey, signature, timestamp, body))) {
          return new Response("invalid request signature", { status: 401 });
        }

        const interaction = JSON.parse(body) as {
          type: number;
          data?: { name?: string };
          member?: { user?: { id: string; username: string } };
          user?: { id: string; username: string };
        };

        if (interaction.type === 1) return Response.json({ type: 1 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const commandName = interaction.data?.name ?? "desconhecido";
        const author = interaction.member?.user ?? interaction.user ?? null;

        const { data: command } = await supabaseAdmin
          .from("bot_commands")
          .select("*")
          .eq("name", commandName)
          .maybeSingle();

        if (!command || !command.enabled) {
          await supabaseAdmin.from("audit_logs").insert({
            actor_label: author?.username ?? "Discord",
            action: `command.${commandName}`,
            entity: "bot_commands",
            status: "error",
            metadata: { reason: "comando desativado ou inexistente" } as never,
          });
          return Response.json({ type: 4, data: { content: "Este comando está desativado.", flags: 64 } });
        }

        await supabaseAdmin
          .from("bot_commands")
          .update({ uses: (command.uses ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq("id", command.id);

        await supabaseAdmin.from("audit_logs").insert({
          actor_label: author?.username ?? "Discord",
          action: `command.${commandName}`,
          entity: "bot_commands",
          entity_id: command.id,
          metadata: { discordUserId: author?.id ?? null } as never,
        });

        if (commandName === "ticket") {
          const { data: ticket } = await supabaseAdmin
            .from("tickets")
            .insert({
              title: "Atendimento aberto pelo Discord",
              requester: author?.username ?? "Membro",
              requester_discord_id: author?.id ?? null,
              category: "geral",
            })
            .select("reference")
            .maybeSingle();
          return Response.json({
            type: 4,
            data: { content: `Ticket ${ticket?.reference ?? ""} aberto. A equipe responderá em breve.`, flags: 64 },
          });
        }

        if (commandName === "sugerir") {
          await supabaseAdmin.from("suggestions").insert({
            title: "Sugestão enviada pelo Discord",
            author_label: author?.username ?? "Membro",
            author_discord_id: author?.id ?? null,
          });
          return Response.json({ type: 4, data: { content: "Sugestão registrada. Obrigado!", flags: 64 } });
        }

        return Response.json({ type: 4, data: { content: "Comando recebido.", flags: 64 } });
      },
    },
  },
});
