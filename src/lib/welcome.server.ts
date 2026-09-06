// Server-only: envio real da mensagem de boas-vindas (REST do Discord).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createMessage, createMessageWithFile, addMemberRole, DiscordError } from "./discord.server";

export type WelcomeTarget = {
  guildId: string;
  memberId: string;
  username: string;
  avatarUrl?: string | null;
  memberNumber?: number | null;
};

type Attachment = { name: string; bytes: Uint8Array; contentType: string };

async function downloadBanner(path: string): Promise<Attachment | null> {
  const download = await supabaseAdmin.storage.from("brand-assets").download(path);
  if (!download.data) return null;
  const extension = path.split(".").pop()?.toLowerCase() ?? "png";
  return {
    name: `banner.${extension === "jpeg" ? "jpg" : extension}`,
    bytes: new Uint8Array(await download.data.arrayBuffer()),
    contentType: download.data.type || "image/png",
  };
}

/**
 * Rotação automática: escolhe o banner menos usado da galeria (até 50), então
 * cada novo membro recebe um banner diferente até todos terem sido usados.
 */
async function pickBanner(fallbackPath: string | null): Promise<(Attachment & { id?: string }) | null> {
  const { data: banners } = await supabaseAdmin
    .from("welcome_banners")
    .select("id, path, used_count")
    .order("used_count", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(50);

  const list = banners ?? [];
  if (list.length === 0) {
    return fallbackPath ? downloadBanner(fallbackPath) : null;
  }

  // Empates no menor uso são sorteados, para variar a ordem naturalmente.
  const lowest = list[0]!.used_count ?? 0;
  const pool = list.filter((banner) => (banner.used_count ?? 0) === lowest);
  const chosen = pool[Math.floor(Math.random() * pool.length)]!;

  const attachment = await downloadBanner(chosen.path);
  if (!attachment) return null;
  return { ...attachment, id: chosen.id };
}

export async function sendWelcome(target: WelcomeTarget) {
  const { data: config } = await supabaseAdmin.from("welcome_config").select("*").limit(1).maybeSingle();
  if (!config || !config.enabled) {
    return { ok: false as const, message: "Boas-vindas desativadas no painel." };
  }
  // Fallback: se o canal não estiver salvo nas boas-vindas, usamos o canal
  // configurado na finalidade "Boas-vindas" dos canais funcionais.
  let channelId = config.channel_id;
  if (!channelId) {
    const { data: setting } = await supabaseAdmin
      .from("channel_settings")
      .select("channel_id")
      .eq("purpose", "boas_vindas")
      .limit(1)
      .maybeSingle();
    channelId = setting?.channel_id ?? null;
  }
  if (!channelId) {
    return { ok: false as const, message: "Configuração necessária: selecione o canal de boas-vindas." };
  }

  const text = (config.message ?? "Bem-vindo, {user}!")
    .replaceAll("{user}", config.mention_user ? `<@${target.memberId}>` : target.username)
    .replaceAll("{username}", target.username)
    .replaceAll("{server}", "SEVEN ROLEPLAY");

  try {
    // Banner sorteado da galeria e anexado de verdade na mensagem: nenhuma
    // "caixa" de embed extra é enviada — só o texto e a imagem.
    const picked = await pickBanner(config.banner_path ?? null);

    const payload = {
      content: text,
      allowed_mentions: { users: [target.memberId] },
    };
    const message = picked
      ? await createMessageWithFile(channelId, payload, picked)
      : await createMessage(channelId, payload);

    if (config.auto_role_id) {
      try {
        await addMemberRole(target.guildId, target.memberId, config.auto_role_id);
      } catch {
        /* auto-role é opcional; não invalida a boas-vindas */
      }
    }

    await supabaseAdmin.from("welcome_events").insert({
      guild_id: target.guildId,
      member_id: target.memberId,
      username: target.username,
      status: "sent",
      message_id: message.id,
      channel_id: channelId,
    });

    if (picked?.id) {
      const { data: current } = await supabaseAdmin
        .from("welcome_banners")
        .select("used_count")
        .eq("id", picked.id)
        .maybeSingle();
      await supabaseAdmin
        .from("welcome_banners")
        .update({ used_count: (current?.used_count ?? 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", picked.id);
    }

    return { ok: true as const, messageId: message.id, banner: Boolean(picked) };
  } catch (error) {
    const message = error instanceof DiscordError ? error.message : "Falha ao enviar as boas-vindas.";
    await supabaseAdmin.from("welcome_events").insert({
      guild_id: target.guildId,
      member_id: target.memberId,
      username: target.username,
      status: "error",
      channel_id: channelId,
      error: message,
    });
    return { ok: false as const, message };
  }
}
