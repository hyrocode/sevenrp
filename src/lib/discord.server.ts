// Server-only: camada REST oficial do Discord.
// O token NUNCA sai daqui: não é retornado, logado nem exposto ao cliente.
const API = "https://discord.com/api/v10";

export class DiscordError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getBotToken(): string | null {
  const token = process.env["DISCORD_BOT_TOKEN"];
  return token && token.trim().length > 0 ? token.trim() : null;
}

export function requireBotToken(): string {
  const token = getBotToken();
  if (!token) throw new DiscordError("Token do bot não configurado", 428);
  return token;
}

export async function discordFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const token = init.token ?? requireBotToken();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      detail = parsed.message ?? text;
    } catch {
      /* corpo não-JSON */
    }
    // Nunca inclua o token na mensagem.
    throw new DiscordError(detail || `Falha na API do Discord (${response.status})`, response.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export type DiscordBotUser = { id: string; username: string; discriminator: string; avatar: string | null };
export type DiscordGuild = { id: string; name: string; icon: string | null; approximate_member_count?: number };
export type DiscordChannel = { id: string; name: string; type: number; parent_id: string | null; position: number; nsfw?: boolean };
export type DiscordRole = { id: string; name: string; color: number; position: number; permissions: string; managed: boolean };

export const getBotUser = (token?: string) =>
  discordFetch<DiscordBotUser>("/users/@me", token ? { token } : {});

export const getBotGuilds = (token?: string) =>
  discordFetch<DiscordGuild[]>("/users/@me/guilds", token ? { token } : {});

export const getGuild = (guildId: string) =>
  discordFetch<DiscordGuild>(`/guilds/${guildId}?with_counts=true`);

export const getGuildChannels = (guildId: string) =>
  discordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`);

export const getGuildRoles = (guildId: string) =>
  discordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`);

export const getGuildMembers = (guildId: string, limit = 200) =>
  discordFetch<Array<{ user: { id: string; username: string; global_name?: string | null; avatar: string | null; bot?: boolean }; nick: string | null; roles: string[]; joined_at: string }>>(
    `/guilds/${guildId}/members?limit=${limit}`,
  );

export const createMessage = (channelId: string, payload: unknown) =>
  discordFetch<{ id: string }>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const putGuildCommands = (applicationId: string, guildId: string, commands: unknown[]) =>
  discordFetch<Array<{ id: string; name: string }>>(`/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: "PUT",
    body: JSON.stringify(commands),
  });

// Permissões mínimas necessárias para o que o painel realmente faz.
export const MINIMAL_PERMISSIONS = [
  { key: "VIEW_CHANNEL", bit: 1n << 10n, label: "Ver canais" },
  { key: "SEND_MESSAGES", bit: 1n << 11n, label: "Enviar mensagens" },
  { key: "EMBED_LINKS", bit: 1n << 14n, label: "Enviar embeds" },
  { key: "ATTACH_FILES", bit: 1n << 15n, label: "Anexar arquivos" },
  { key: "READ_MESSAGE_HISTORY", bit: 1n << 16n, label: "Ler histórico" },
  { key: "MANAGE_MESSAGES", bit: 1n << 13n, label: "Gerenciar mensagens (moderação)" },
  { key: "MODERATE_MEMBERS", bit: 1n << 40n, label: "Silenciar membros" },
  { key: "KICK_MEMBERS", bit: 1n << 1n, label: "Expulsar membros" },
  { key: "BAN_MEMBERS", bit: 1n << 2n, label: "Banir membros" },
  { key: "MANAGE_ROLES", bit: 1n << 28n, label: "Gerenciar cargos (auto-role)" },
] as const;

export function buildOAuthUrl(applicationId: string, permissionKeys: string[], guildId?: string | null) {
  const permissions = MINIMAL_PERMISSIONS.filter((p) => permissionKeys.includes(p.key)).reduce(
    (acc, p) => acc | p.bit,
    0n,
  );
  const params = new URLSearchParams({
    client_id: applicationId,
    scope: "bot applications.commands",
    permissions: permissions.toString(),
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// ---- Operações adicionais usadas pela inicialização do servidor e templates ----
export const getChannel = (channelId: string) =>
  discordFetch<DiscordChannel & { guild_id?: string; permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }> }>(
    `/channels/${channelId}`,
  );

export const getMessage = (channelId: string, messageId: string) =>
  discordFetch<{ id: string; pinned: boolean }>(`/channels/${channelId}/messages/${messageId}`);

export const editMessage = (channelId: string, messageId: string, payload: unknown) =>
  discordFetch<{ id: string }>(`/channels/${channelId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteMessage = (channelId: string, messageId: string) =>
  discordFetch<null>(`/channels/${channelId}/messages/${messageId}`, { method: "DELETE" });

export const pinMessage = (channelId: string, messageId: string) =>
  discordFetch<null>(`/channels/${channelId}/messages/${messageId}/pins`, { method: "PUT" });

export const unpinMessage = (channelId: string, messageId: string) =>
  discordFetch<null>(`/channels/${channelId}/messages/${messageId}/pins`, { method: "DELETE" });

export const getGuildMember = (guildId: string, memberId: string) =>
  discordFetch<{ user: { id: string; username: string; global_name?: string | null; avatar: string | null }; roles: string[]; joined_at: string }>(
    `/guilds/${guildId}/members/${memberId}`,
  );

export const addMemberRole = (guildId: string, memberId: string, roleId: string) =>
  discordFetch<null>(`/guilds/${guildId}/members/${memberId}/roles/${roleId}`, { method: "PUT" });

/** Envia mensagem com anexo real (multipart) — usado pelo banner de boas-vindas. */
export async function createMessageWithFile(
  channelId: string,
  payload: unknown,
  file: { name: string; bytes: Uint8Array; contentType: string },
) {
  const token = requireBotToken();
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([file.bytes as BlobPart], { type: file.contentType }), file.name);
  const response = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });
  const text = await response.text();
  if (!response.ok) throw new DiscordError(text || `Falha ao enviar anexo (${response.status})`, response.status);
  return JSON.parse(text) as { id: string };
}

const PERM = {
  ADMINISTRATOR: 1n << 3n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
} as const;

export type ChannelPermissionCheck = {
  ok: boolean;
  missing: string[];
};

/** Valida de verdade as permissões do bot em um canal (roles + overwrites). */
export async function checkChannelPermissions(guildId: string, channelId: string): Promise<ChannelPermissionCheck> {
  const bot = await getBotUser();
  const [member, roles, channel] = await Promise.all([
    getGuildMember(guildId, bot.id),
    getGuildRoles(guildId),
    getChannel(channelId),
  ]);

  const everyone = roles.find((role) => role.id === guildId);
  let permissions = BigInt(everyone?.permissions ?? "0");
  for (const roleId of member.roles) {
    const role = roles.find((item) => item.id === roleId);
    if (role) permissions |= BigInt(role.permissions);
  }

  if (!(permissions & PERM.ADMINISTRATOR)) {
    const overwrites = channel.permission_overwrites ?? [];
    const everyoneOverwrite = overwrites.find((item) => item.id === guildId);
    if (everyoneOverwrite) {
      permissions &= ~BigInt(everyoneOverwrite.deny);
      permissions |= BigInt(everyoneOverwrite.allow);
    }
    let allow = 0n;
    let deny = 0n;
    for (const overwrite of overwrites) {
      if (overwrite.type === 0 && member.roles.includes(overwrite.id)) {
        deny |= BigInt(overwrite.deny);
        allow |= BigInt(overwrite.allow);
      }
    }
    permissions = (permissions & ~deny) | allow;
    const memberOverwrite = overwrites.find((item) => item.id === bot.id);
    if (memberOverwrite) {
      permissions &= ~BigInt(memberOverwrite.deny);
      permissions |= BigInt(memberOverwrite.allow);
    }
  }

  if (permissions & PERM.ADMINISTRATOR) return { ok: true, missing: [] };

  const required: Array<[keyof typeof PERM, string]> = [
    ["VIEW_CHANNEL", "Ver canal"],
    ["SEND_MESSAGES", "Enviar mensagens"],
    ["EMBED_LINKS", "Enviar embeds"],
    ["ATTACH_FILES", "Anexar arquivos"],
    ["MANAGE_MESSAGES", "Fixar mensagens"],
  ];
  const missing = required.filter(([key]) => !(permissions & PERM[key])).map(([, label]) => label);
  return { ok: missing.length === 0, missing };
}

// ---- Canais de fórum (type 15) e mídia (16) ----
export const CHANNEL_TYPE_FORUM = 15;
export const CHANNEL_TYPE_MEDIA = 16;

export const isForumChannel = (type: number) => type === CHANNEL_TYPE_FORUM || type === CHANNEL_TYPE_MEDIA;

/** Cria o post inicial de um fórum: o id da thread também é o id da mensagem inicial. */
export const createForumPost = (channelId: string, name: string, content: string) =>
  discordFetch<{ id: string }>(`/channels/${channelId}/threads`, {
    method: "POST",
    body: JSON.stringify({ name: name.slice(0, 100), message: { content: content.slice(0, 2000) } }),
  });

/** Fixa o post do fórum na lista do canal (flag PINNED). */
/** Remove um canal/thread (usado para apagar o post inicial de fórum). */
export const deleteChannel = (channelId: string) =>
  discordFetch<null>(`/channels/${channelId}`, { method: "DELETE" });

export const pinForumPost = (threadId: string) =>
  discordFetch<{ id: string }>(`/channels/${threadId}`, { method: "PATCH", body: JSON.stringify({ flags: 1 << 1 }) });
