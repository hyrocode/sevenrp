// Server-only: publicação idempotente de templates institucionais (texto ou fórum).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "./audit.server";
import {
  DiscordError,
  createForumPost,
  createMessage,
  editMessage,
  getChannel,
  getMessage,
  isForumChannel,
  pinForumPost,
  pinMessage,
} from "./discord.server";

export type PublishResult =
  | { ok: true; mode: "created" | "updated"; messageId: string; pinned: boolean; forum: boolean }
  | { ok: false; message: string };

/** Publica (ou atualiza sem duplicar) a mensagem do template no canal da finalidade. */
export async function publishTemplateById(
  templateId: string,
  actor: { actorId: string | null; actorLabel: string },
): Promise<PublishResult> {
  const { data: template } = await supabaseAdmin.from("server_templates").select("*").eq("id", templateId).maybeSingle();
  if (!template) return { ok: false, message: "Template não encontrado." };

  const { data: guild } = await supabaseAdmin.from("guild_config").select("guild_id").limit(1).maybeSingle();
  if (!guild?.guild_id) return { ok: false, message: "Sincronize o servidor antes de publicar." };

  const { data: setting } = await supabaseAdmin
    .from("channel_settings")
    .select("channel_id")
    .eq("purpose", template.purpose)
    .maybeSingle();
  const channelId = setting?.channel_id ?? template.channel_id;
  if (!channelId) return { ok: false, message: "Configuração necessária: defina o canal desta finalidade." };

  const color = Number.parseInt((template.color ?? "#7c5cff").replace("#", ""), 16);
  const payload = {
    embeds: [
      {
        title: template.title,
        description: template.description || undefined,
        color: Number.isNaN(color) ? 8149247 : color,
        image: template.image_url ? { url: template.image_url } : undefined,
        thumbnail: template.thumbnail_url ? { url: template.thumbnail_url } : undefined,
        footer: template.footer ? { text: template.footer } : undefined,
      },
    ],
  };

  try {
    const channel = await getChannel(channelId);
    const forum = isForumChannel(channel.type);
    let messageId = template.message_id;
    let mode: "created" | "updated" = "updated";

    if (messageId && template.channel_id === channelId) {
      try {
        // Em fórum, o id da thread também é o id da mensagem inicial.
        await getMessage(forum ? messageId : channelId, messageId);
        await editMessage(forum ? messageId : channelId, messageId, forum ? { content: template.description } : payload);
      } catch {
        messageId = null; // removida no Discord: republica
      }
    } else {
      messageId = null;
    }

    if (!messageId) {
      const created = forum
        ? await createForumPost(channelId, template.title || template.name, template.description)
        : await createMessage(channelId, payload);
      messageId = created.id;
      mode = "created";
    }

    let pinned = template.pinned;
    if (template.pin_message && !pinned) {
      try {
        if (forum) {
          await pinForumPost(messageId);
          try {
            await pinMessage(messageId, messageId);
          } catch {
            /* fixar dentro da thread é opcional */
          }
        } else {
          await pinMessage(channelId, messageId);
        }
        pinned = true;
      } catch {
        pinned = false;
      }
    }

    await supabaseAdmin
      .from("server_templates")
      .update({
        channel_id: channelId,
        message_id: messageId,
        pinned,
        published_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", template.id);

    await writeAudit({
      actorId: actor.actorId,
      actorLabel: actor.actorLabel,
      action: mode === "created" ? "template.publish" : "template.update",
      entity: "server_templates",
      entityId: template.id,
      targetLabel: template.name,
      metadata: { messageId, channelId, pinned, forum },
    });

    return { ok: true, mode, messageId, pinned, forum };
  } catch (error) {
    const message = error instanceof DiscordError ? error.message : "Falha ao publicar o template.";
    await supabaseAdmin.from("server_templates").update({ last_error: message }).eq("id", template.id);
    return { ok: false, message };
  }
}

/**
 * Publica automaticamente, uma única vez, os templates fixáveis de uma finalidade
 * que ainda não têm mensagem no Discord.
 */
export async function autoPublishPurpose(purpose: string, actor: { actorId: string | null; actorLabel: string }) {
  const { data: templates } = await supabaseAdmin
    .from("server_templates")
    .select("id, message_id, enabled")
    .eq("purpose", purpose)
    .eq("enabled", true)
    .is("message_id", null);
  const results: PublishResult[] = [];
  for (const template of templates ?? []) {
    results.push(await publishTemplateById(template.id, actor));
  }
  return results;
}
