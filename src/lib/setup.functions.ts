import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = { supabase: { rpc: (fn: "is_admin", args: { _user_id: string }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function requireAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Apenas administradores podem executar esta ação.");
}

/** Estado completo da inicialização: guild, canais reais, cargos, templates, boas-vindas. */
export const getServerSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: guild }, { data: templates }, { data: welcome }, { data: settings }, { data: banners }] = await Promise.all([
      supabase.from("guild_config").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("server_templates").select("*").order("name", { ascending: true }),
      supabase.from("welcome_config").select("*").limit(1).maybeSingle(),
      supabase.from("channel_settings").select("*"),
      supabase.from("welcome_banners").select("id, path, label, sort_order").order("sort_order").order("created_at"),
    ]);

    const guildId = guild?.guild_id ?? null;
    const [{ data: channels }, { data: roles }, { data: events }] = await Promise.all([
      guildId
        ? supabase.from("discord_channels").select("channel_id, name, type, position").eq("guild_id", guildId).order("position")
        : Promise.resolve({ data: [] as Array<{ channel_id: string; name: string; type: number; position: number }> }),
      guildId
        ? supabase.from("discord_roles").select("role_id, name, position").eq("guild_id", guildId).order("position", { ascending: false })
        : Promise.resolve({ data: [] as Array<{ role_id: string; name: string; position: number }> }),
      supabase.from("welcome_events").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    return {
      guild: guild
        ? { guildId: guild.guild_id, guildName: guild.guild_name, lastSyncAt: guild.last_sync_at, memberCount: guild.member_count }
        : null,
      channels: channels ?? [],
      roles: roles ?? [],
      templates: templates ?? [],
      welcome: welcome ?? null,
      channelSettings: settings ?? [],
      welcomeEvents: events ?? [],
      welcomeBanners: banners ?? [],
    };
  });

/** Define o canal real de uma finalidade, validando as permissões do bot antes de salvar. */
export const saveChannelSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purpose: string; channelId: string }) => {
    if (!input.purpose) throw new Error("Finalidade obrigatória");
    if (input.channelId && !/^\d{5,25}$/.test(input.channelId)) throw new Error("ID de canal inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: guild } = await context.supabase.from("guild_config").select("guild_id").limit(1).maybeSingle();
    if (!guild?.guild_id) return { ok: false as const, message: "Sincronize o servidor antes de configurar canais." };

    const { checkChannelPermissions, getChannel, DiscordError } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./audit.server");

    try {
      const [channel, permissions] = await Promise.all([
        getChannel(data.channelId),
        checkChannelPermissions(guild.guild_id, data.channelId),
      ]);
      await supabaseAdmin.from("channel_settings").upsert(
        {
          guild_id: guild.guild_id,
          purpose: data.purpose,
          channel_id: channel.id,
          channel_name: channel.name,
          channel_type: channel.type,
          updated_by: context.userId,
        },
        { onConflict: "guild_id,purpose" },
      );
      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims["email"] as string) ?? "Administrador",
        action: "discord.channel_setting",
        entity: "channel_settings",
        entityId: channel.id,
        targetLabel: `${data.purpose} → #${channel.name}`,
        status: permissions.ok ? "success" : "warning",
        metadata: { missing: permissions.missing },
      });
      // Assim que a finalidade recebe um canal real, o bot publica e fixa
      // automaticamente (uma única vez) as mensagens oficiais dessa finalidade.
      if (permissions.ok) {
        const { autoPublishPurpose } = await import("./templates.server");
        await autoPublishPurpose(data.purpose, {
          actorId: context.userId,
          actorLabel: (context.claims["email"] as string) ?? "Administrador",
        });
      }

      return { ok: true as const, channelName: channel.name, missing: permissions.missing };
    } catch (error) {
      const message = error instanceof DiscordError ? error.message : "Falha ao validar o canal.";
      return { ok: false as const, message };
    }
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name: string;
      title: string;
      description: string;
      color: string;
      footer: string | null;
      imageUrl: string | null;
      thumbnailUrl: string | null;
      pinMessage: boolean;
      enabled: boolean;
      purpose: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("server_templates")
      .update({
        name: data.name,
        title: data.title,
        description: data.description,
        color: data.color,
        footer: data.footer,
        image_url: data.imageUrl,
        thumbnail_url: data.thumbnailUrl,
        pin_message: data.pinMessage,
        enabled: data.enabled,
        purpose: data.purpose,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: "template.save",
      entity: "server_templates",
      entityId: data.id,
      targetLabel: data.name,
    });
    return { ok: true as const };
  });

/** Publica ou atualiza (sem duplicar) a mensagem real do template no canal configurado. */
export const publishTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { publishTemplateById } = await import("./templates.server");
    return publishTemplateById(data.id, {
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
    });
  });

/** Remove a mensagem publicada no Discord e limpa o vínculo. */
export const unpublishTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteMessage, deleteChannel, getChannel, isForumChannel, DiscordError } = await import("./discord.server");
    const { writeAudit } = await import("./audit.server");

    const { data: template } = await context.supabase.from("server_templates").select("*").eq("id", data.id).maybeSingle();
    if (!template?.message_id || !template.channel_id) return { ok: false as const, message: "Este template não está publicado." };

    try {
      const parent = await getChannel(template.channel_id);
      // Em fórum, o "post" é uma thread: apagar a thread remove a mensagem inicial.
      if (isForumChannel(parent.type)) await deleteChannel(template.message_id);
      else await deleteMessage(template.channel_id, template.message_id);
    } catch (error) {
      if (!(error instanceof DiscordError) || error.status !== 404) {
        return { ok: false as const, message: error instanceof DiscordError ? error.message : "Falha ao remover a mensagem." };
      }
    }
    await supabaseAdmin
      .from("server_templates")
      .update({ message_id: null, pinned: false, published_at: null })
      .eq("id", template.id);
    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: "template.unpublish",
      entity: "server_templates",
      entityId: template.id,
      targetLabel: template.name,
    });
    return { ok: true as const };
  });

export const saveWelcomeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      enabled: boolean;
      channelId: string | null;
      message: string;
      mentionUser: boolean;
      autoRoleId: string | null;
      bannerTitle: string;
      bannerSubtitle: string;
      bannerUrl: string | null;
      bannerPath?: string | null;
      accentColor: string;
      showAvatar: boolean;
      showMemberNumber: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./audit.server");

    const { data: existing } = await context.supabase.from("welcome_config").select("id").limit(1).maybeSingle();
    const row = {
      enabled: data.enabled,
      channel_id: data.channelId,
      message: data.message,
      mention_user: data.mentionUser,
      auto_role_id: data.autoRoleId,
      banner_title: data.bannerTitle,
      banner_subtitle: data.bannerSubtitle,
      banner_url: data.bannerUrl,
      banner_path: data.bannerPath ?? null,
      accent_color: data.accentColor,
      show_avatar: data.showAvatar,
      show_member_number: data.showMemberNumber,
    };
    const { error } = existing
      ? await supabaseAdmin.from("welcome_config").update(row).eq("id", existing.id)
      : await supabaseAdmin.from("welcome_config").insert(row);
    if (error) throw new Error(error.message);

    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: "welcome.save",
      entity: "welcome_config",
    });
    return { ok: true as const };
  });

/** Dispara uma boas-vindas real para um membro existente (teste verificável no Discord). */
export const sendWelcomeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId?: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: guild } = await context.supabase.from("guild_config").select("guild_id").limit(1).maybeSingle();
    if (!guild?.guild_id) return { ok: false as const, message: "Sincronize o servidor antes de testar." };

    const { getGuildMember, getBotUser, DiscordError } = await import("./discord.server");
    const { sendWelcome } = await import("./welcome.server");

    try {
      let memberId = data.memberId;
      if (!memberId) {
        const { data: realMember } = await context.supabase
          .from("discord_members")
          .select("member_id")
          .eq("guild_id", guild.guild_id)
          .eq("is_bot", false)
          .order("synced_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        memberId = realMember?.member_id ?? (await getBotUser()).id;
      }
      const member = await getGuildMember(guild.guild_id, memberId);
      const avatarUrl = member.user.avatar
        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`
        : null;
      return await sendWelcome({
        guildId: guild.guild_id,
        memberId: member.user.id,
        username: member.user.global_name ?? member.user.username,
        avatarUrl,
      });
    } catch (error) {
      return { ok: false as const, message: error instanceof DiscordError ? error.message : "Falha no teste de boas-vindas." };
    }
  });

/**
 * Re-sincroniza guild/canais/cargos/membros direto na API do Discord.
 * Usado pela Inicialização para que canais criados agora apareçam na hora.
 */
export const refreshChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: guild } = await context.supabase
      .from("guild_config")
      .select("guild_id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!guild?.guild_id) return { ok: false as const, message: "Servidor não conectado." };

    const { performGuildSync } = await import("./guild-sync.server");
    const result = await performGuildSync(guild.guild_id, {
      userId: context.userId,
      label: (context.claims["email"] as string) ?? "Administrador",
    });
    return result.ok
      ? { ok: true as const, channels: result.channels, roles: result.roles }
      : { ok: false as const, message: result.message };
  });

export const WELCOME_BANNER_LIMIT = 50;

/** Registra banners enviados ao storage privado na galeria de boas-vindas. */
export const addWelcomeBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paths: string[] }) => {
    if (!Array.isArray(input.paths) || input.paths.length === 0) throw new Error("Nenhum banner informado.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { count } = await context.supabase.from("welcome_banners").select("id", { count: "exact", head: true });
    const remaining = WELCOME_BANNER_LIMIT - (count ?? 0);
    if (remaining <= 0) return { ok: false as const, message: `Limite de ${WELCOME_BANNER_LIMIT} banners atingido.` };

    const accepted = data.paths.slice(0, remaining);
    const { error } = await context.supabase
      .from("welcome_banners")
      .upsert(
        accepted.map((path, index) => ({
          path,
          label: path.split("/").pop() ?? path,
          sort_order: (count ?? 0) + index,
          created_by: context.userId,
        })),
        { onConflict: "path" },
      );
    if (error) return { ok: false as const, message: error.message };

    const { writeAudit } = await import("./audit.server");
    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: "welcome.banners_add",
      entity: "welcome_banners",
      metadata: { added: accepted.length },
    });
    return { ok: true as const, added: accepted.length, skipped: data.paths.length - accepted.length };
  });

/** Remove um banner da galeria (e o arquivo do storage privado). */
export const removeWelcomeBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: banner } = await context.supabase.from("welcome_banners").select("path").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("welcome_banners").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    if (banner?.path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("brand-assets").remove([banner.path]);
    }
    return { ok: true as const };
  });
