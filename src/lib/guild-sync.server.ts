// Server-only: sincronização real de guild, canais, cargos e membros pela REST do Discord.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getGuild,
  getGuildChannels,
  getGuildRoles,
  getGuildMembers,
  getBotUser,
  DiscordError,
} from "./discord.server";
import { writeAudit } from "./audit.server";

export type SyncActor = { userId?: string | null; label?: string | null };

export async function performGuildSync(guildId: string, actor: SyncActor = {}) {
  try {
    const [guild, channels, roles, bot] = await Promise.all([
      getGuild(guildId),
      getGuildChannels(guildId),
      getGuildRoles(guildId),
      getBotUser(),
    ]);

    let members: Awaited<ReturnType<typeof getGuildMembers>> = [];
    try {
      members = await getGuildMembers(guildId);
    } catch {
      // Intent de membros pode não estar liberado — não é fatal.
    }

    const now = new Date().toISOString();

    await supabaseAdmin.from("guild_config").upsert(
      {
        guild_id: guild.id,
        guild_name: guild.name,
        guild_icon: guild.icon,
        bot_username: bot.username,
        bot_avatar: bot.avatar,
        application_id: bot.id,
        token_configured: true,
        connection_status: "rest_connected",
        member_count: guild.approximate_member_count ?? null,
        last_sync_at: now,
        last_error: null,
      },
      { onConflict: "guild_id" },
    );

    if (channels.length) {
      await supabaseAdmin.from("discord_channels").upsert(
        channels.map((c) => ({
          guild_id: guild.id,
          channel_id: c.id,
          name: c.name,
          type: c.type,
          parent_id: c.parent_id,
          position: c.position,
          nsfw: Boolean(c.nsfw),
          synced_at: now,
        })),
        { onConflict: "guild_id,channel_id" },
      );
    }

    if (roles.length) {
      await supabaseAdmin.from("discord_roles").upsert(
        roles.map((r) => ({
          guild_id: guild.id,
          role_id: r.id,
          name: r.name,
          color: r.color,
          position: r.position,
          permissions: r.permissions,
          managed: r.managed,
          synced_at: now,
        })),
        { onConflict: "guild_id,role_id" },
      );
    }

    if (members.length) {
      await supabaseAdmin.from("discord_members").upsert(
        members.map((m) => ({
          guild_id: guild.id,
          member_id: m.user.id,
          username: m.user.username,
          display_name: m.nick ?? m.user.global_name ?? null,
          avatar_url: m.user.avatar,
          is_bot: Boolean(m.user.bot),
          roles: m.roles as never,
          joined_at: m.joined_at,
          synced_at: now,
        })),
        { onConflict: "guild_id,member_id" },
      );
    }

    await writeAudit({
      actorId: actor.userId ?? null,
      actorLabel: actor.label ?? "Sincronização automática",
      action: "discord.sync",
      entity: "guild_config",
      entityId: guild.id,
      targetLabel: guild.name,
      metadata: { channels: channels.length, roles: roles.length, members: members.length },
    });

    return {
      ok: true as const,
      channels: channels.length,
      roles: roles.length,
      members: members.length,
      guildName: guild.name,
      guildId: guild.id,
    };
  } catch (error) {
    const message = error instanceof DiscordError ? error.message : "Falha na sincronização.";
    await supabaseAdmin
      .from("guild_config")
      .upsert({ guild_id: guildId, connection_status: "error", last_error: message }, { onConflict: "guild_id" });
    await writeAudit({
      actorId: actor.userId ?? null,
      action: "discord.sync",
      entity: "guild_config",
      status: "error",
      metadata: { message },
    });
    return { ok: false as const, message };
  }
}
