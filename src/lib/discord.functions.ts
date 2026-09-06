import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type IntegrationStatus = {
  tokenConfigured: boolean;
  publicKeyConfigured: boolean;
  workerSecretConfigured: boolean;
  applicationId: string | null;
  guild: {
    guildId: string | null;
    guildName: string | null;
    guildIcon: string | null;
    memberCount: number | null;
    lastSyncAt: string | null;
    connectionStatus: string;
    lastError: string | null;
    botUsername: string | null;
  } | null;
  worker: { online: boolean; lastSeenAt: string | null; latencyMs: number | null; workerId: string | null };
  gatewaySupported: false;
};

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationStatus> => {
    const { getBotToken } = await import("./discord.server");
    const { data: config } = await context.supabase
      .from("guild_config")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { data: heartbeat } = await context.supabase
      .from("worker_heartbeats")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastSeen = heartbeat?.received_at ?? null;
    const online = lastSeen ? Date.now() - new Date(lastSeen).getTime() < 90_000 : false;

    return {
      tokenConfigured: Boolean(getBotToken()),
      publicKeyConfigured: Boolean(process.env["DISCORD_PUBLIC_KEY"]),
      workerSecretConfigured: Boolean(process.env["WORKER_SHARED_SECRET"]),
      applicationId: config?.application_id ?? process.env["DISCORD_APPLICATION_ID"] ?? null,
      guild: config
        ? {
            guildId: config.guild_id,
            guildName: config.guild_name,
            guildIcon: config.guild_icon,
            memberCount: config.member_count,
            lastSyncAt: config.last_sync_at,
            connectionStatus: config.connection_status,
            lastError: config.last_error,
            botUsername: config.bot_username,
          }
        : null,
      worker: {
        online,
        lastSeenAt: lastSeen,
        latencyMs: heartbeat?.gateway_latency_ms ?? null,
        workerId: heartbeat?.worker_id ?? null,
      },
      gatewaySupported: false,
    };
  });

/** Teste REAL do token: autentica no Discord e devolve só a identidade pública do bot. */
export const testBotToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getBotToken, getBotUser, getBotGuilds, DiscordError } = await import("./discord.server");
    const { writeAudit } = await import("./audit.server");

    if (!getBotToken()) {
      return { ok: false as const, reason: "missing_secret" as const, message: "Token não configurado no backend." };
    }
    try {
      const [bot, guilds] = await Promise.all([getBotUser(), getBotGuilds()]);
      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims["email"] as string) ?? "Administrador",
        action: "discord.test_token",
        entity: "guild_config",
        targetLabel: bot.username,
      });
      return {
        ok: true as const,
        bot: { id: bot.id, username: bot.username, avatar: bot.avatar },
        guilds: guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon })),
      };
    } catch (error) {
      const message = error instanceof DiscordError ? error.message : "Falha ao contactar o Discord.";
      await writeAudit({
        actorId: context.userId,
        action: "discord.test_token",
        entity: "guild_config",
        status: "error",
        metadata: { message },
      });
      return { ok: false as const, reason: "invalid" as const, message };
    }
  });

/** Sincronização real de guild, canais, cargos e membros. */
export const syncGuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { guildId: string }) => {
    if (!/^\d{5,25}$/.test(input.guildId)) throw new Error("ID de guild inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas administradores podem sincronizar o servidor.");

    const { performGuildSync } = await import("./guild-sync.server");
    return performGuildSync(data.guildId, {
      userId: context.userId,
      label: (context.claims["email"] as string) ?? "Administrador",
    });
  });

/**
 * Conexão direta: detecta em quais servidores o bot já está e, assim que ele
 * entra em um servidor, sincroniza canais/cargos/membros automaticamente.
 */
export const autoConnectGuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getBotToken, getBotGuilds, DiscordError } = await import("./discord.server");
    if (!getBotToken()) {
      return { state: "missing_token" as const, guilds: [] as Array<{ id: string; name: string }> };
    }

    let guilds: Array<{ id: string; name: string; icon: string | null }> = [];
    try {
      guilds = (await getBotGuilds()).map((g) => ({ id: g.id, name: g.name, icon: g.icon ?? null }));
    } catch (error) {
      return {
        state: "error" as const,
        guilds: [],
        message: error instanceof DiscordError ? error.message : "Falha ao consultar o Discord.",
      };
    }

    if (!guilds.length) return { state: "awaiting_invite" as const, guilds };

    const { data: config } = await context.supabase
      .from("guild_config")
      .select("guild_id,last_sync_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const known = config?.guild_id && guilds.some((g) => g.id === config.guild_id) ? config.guild_id : null;
    const target = known ?? (guilds.length === 1 ? guilds[0]!.id : null);

    if (!target) return { state: "choose_guild" as const, guilds };
    if (known && config?.last_sync_at) return { state: "connected" as const, guilds, guildId: known };

    const { performGuildSync } = await import("./guild-sync.server");
    const result = await performGuildSync(target, {
      userId: context.userId,
      label: (context.claims["email"] as string) ?? "Administrador",
    });
    return result.ok
      ? { state: "connected" as const, guilds, guildId: target, synced: result }
      : { state: "error" as const, guilds, message: result.message };
  });

export const getOAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { permissions: string[]; guildId?: string | null; applicationId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { buildOAuthUrl, getBotToken, getBotUser } = await import("./discord.server");
    let applicationId = data.applicationId ?? process.env["DISCORD_APPLICATION_ID"] ?? null;
    if (!applicationId && getBotToken()) {
      try {
        applicationId = (await getBotUser()).id;
      } catch {
        applicationId = null;
      }
    }
    if (!applicationId) {
      const { data: config } = await context.supabase.from("guild_config").select("application_id").limit(1).maybeSingle();
      applicationId = config?.application_id ?? null;
    }
    if (!applicationId) return { ok: false as const, message: "Configuração necessária: informe o token do bot para descobrir o Application ID." };
    return { ok: true as const, url: buildOAuthUrl(applicationId, data.permissions, data.guildId ?? null) };
  });

export const COMMAND_BLUEPRINT = [
  { name: "ticket", description: "Abre um ticket de atendimento", category: "suporte" },
  { name: "sugerir", description: "Envia uma sugestão para a equipe", category: "comunidade" },
  { name: "punir", description: "Aplica uma punição a um membro", category: "moderacao" },
  { name: "infos", description: "Mostra informações do servidor", category: "servidor" },
  { name: "saldo", description: "Consulta o saldo do membro", category: "economia" },
] as const;

/** Registro real dos slash commands via REST (funciona sem gateway). */
export const registerSlashCommands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas administradores podem registrar comandos.");

    const { putGuildCommands, getBotUser, getBotToken, DiscordError } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./audit.server");

    if (!getBotToken()) return { ok: false as const, message: "Configuração necessária: token do bot ausente." };

    const { data: config } = await context.supabase.from("guild_config").select("guild_id").limit(1).maybeSingle();
    if (!config?.guild_id) return { ok: false as const, message: "Sincronize um servidor antes de registrar comandos." };

    const { data: stored } = await context.supabase.from("bot_commands").select("*").eq("enabled", true);
    const source = (stored ?? []).length
      ? (stored ?? []).map((c) => ({ name: c.name, description: c.description || c.name, type: 1 }))
      : COMMAND_BLUEPRINT.map((c) => ({ name: c.name, description: c.description, type: 1 }));

    try {
      const bot = await getBotUser();
      const registered = await putGuildCommands(bot.id, config.guild_id, source);
      for (const command of registered) {
        await supabaseAdmin.from("bot_commands").upsert(
          {
            name: command.name,
            description: source.find((s) => s.name === command.name)?.description ?? command.name,
            registered: true,
            discord_command_id: command.id,
            enabled: true,
          },
          { onConflict: "name" },
        );
      }
      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims["email"] as string) ?? "Administrador",
        action: "discord.register_commands",
        entity: "bot_commands",
        metadata: { total: registered.length },
      });
      return { ok: true as const, total: registered.length };
    } catch (error) {
      const message = error instanceof DiscordError ? error.message : "Falha ao registrar comandos.";
      return { ok: false as const, message };
    }
  });

/** Publica um embed institucional em um canal real. */
export const publishEmbed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { embedId: string }) => input)
  .handler(async ({ data, context }) => {
    const { createMessage, getBotToken, DiscordError } = await import("./discord.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("./audit.server");

    const { data: embed, error } = await context.supabase.from("embeds").select("*").eq("id", data.embedId).maybeSingle();
    if (error || !embed) return { ok: false as const, message: "Embed não encontrado." };
    if (!embed.target_channel_id) return { ok: false as const, message: "Selecione o canal de destino antes de publicar." };
    if (!getBotToken()) return { ok: false as const, message: "Configuração necessária: token do bot ausente." };

    const color = Number.parseInt((embed.color ?? "#7c5cff").replace("#", ""), 16);
    try {
      const message = await createMessage(embed.target_channel_id, {
        embeds: [
          {
            title: embed.title ?? embed.name,
            description: embed.description ?? undefined,
            color: Number.isNaN(color) ? 8149247 : color,
            image: embed.image_url ? { url: embed.image_url } : undefined,
            thumbnail: embed.thumbnail_url ? { url: embed.thumbnail_url } : undefined,
            footer: embed.footer ? { text: embed.footer } : undefined,
            fields: Array.isArray(embed.fields) ? embed.fields : [],
          },
        ],
      });
      await supabaseAdmin.from("embeds").update({ last_published_at: new Date().toISOString() }).eq("id", embed.id);
      await writeAudit({
        actorId: context.userId,
        actorLabel: (context.claims["email"] as string) ?? "Administrador",
        action: "discord.publish_embed",
        entity: "embeds",
        entityId: embed.id,
        targetLabel: embed.name,
        metadata: { messageId: message.id },
      });
      return { ok: true as const, messageId: message.id };
    } catch (err) {
      const message = err instanceof DiscordError ? err.message : "Falha ao publicar o embed.";
      return { ok: false as const, message };
    }
  });

/** Enfileira uma ação que exige gateway persistente (executada pelo worker externo). */
export const queueWorkerAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { actionType: string; payload?: Record<string, string | number | boolean | null> }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("worker_actions").insert({
      action_type: data.actionType,
      payload: (data.payload ?? {}) as never,
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
