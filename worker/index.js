// Worker Persistente 24/7 para SEVEN ROLEPLAY
// Desenvolvido para rodar no Render (Web Service) + KeepAlive Anti-Sleep
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActivityType,
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import {
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import { getMusicAutocompleteChoices, MUSIC_COMMAND_DEFINITIONS, MUSIC_COMMAND_NAMES, MusicManager } from "./music.js";
import { buildLinkWarning, detectExternalLink, isModerationExempt } from "./moderation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bannersDir = path.join(__dirname, "banners");
let bannerFiles = [];
try {
  if (fs.existsSync(bannersDir)) {
    bannerFiles = fs
      .readdirSync(bannersDir)
      .filter((f) => f.endsWith(".png") || f.endsWith(".jpg"))
      .sort();
    console.log(`[Banners] ${bannerFiles.length} banner(s) carregados para rotação.`);
  }
} catch (err) {
  console.warn("[Banners] Aviso ao ler diretório local de banners:", err.message);
}
let currentBannerIndex = 0;

function cleanEnv(val) {
  if (!val) return "";
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const PORT = Number(process.env.PORT) || 3000;
let rawToken = cleanEnv(process.env.DISCORD_BOT_TOKEN);
if (rawToken.startsWith("Bot ")) {
  rawToken = rawToken.slice(4).trim();
}
const DISCORD_BOT_TOKEN = rawToken;
const WORKER_SHARED_SECRET = cleanEnv(process.env.WORKER_SHARED_SECRET);
const DASHBOARD_URL = cleanEnv(process.env.DASHBOARD_URL).replace(/\/+$/, "");
const WORKER_ID = cleanEnv(process.env.WORKER_ID) || "render-worker-01";
const SELF_URL = cleanEnv(process.env.RENDER_EXTERNAL_URL) || "https://seven-discord-worker.onrender.com";
const WELCOME_CHANNEL_ID = cleanEnv(process.env.WELCOME_CHANNEL_ID) || "1545352442160611469";
const VOICE_CHANNEL_ID = cleanEnv(process.env.VOICE_CHANNEL_ID) || "1544539183748620328";
const VOICE_CHANNEL_STATUS = cleanEnv(process.env.VOICE_CHANNEL_STATUS) || "Preparando Cidade...";
const LINK_FILTER_ENABLED = cleanEnv(process.env.LINK_FILTER_ENABLED).toLowerCase() !== "false";
const LINK_WARNING_CHANNEL_ID = cleanEnv(process.env.LINK_WARNING_CHANNEL_ID) || "1549700633588928572";
const LINK_WARNING_COOLDOWN_MS = 15_000;
const INVITE_ANNOUNCEMENT_CHANNEL_ID = cleanEnv(process.env.INVITE_ANNOUNCEMENT_CHANNEL_ID) || "1550343043767607338";
const INVITE_ANNOUNCEMENT_URL = cleanEnv(process.env.INVITE_ANNOUNCEMENT_URL) || "https://discord.gg/R9uxzQbgps";
const INVITE_ANNOUNCEMENT_MARKER = "SEVEN_INVITE_ANNOUNCEMENT_V1";
const SUGGESTIONS_FORUM_CHANNEL_ID = cleanEnv(process.env.SUGGESTIONS_FORUM_CHANNEL_ID) || "1544539285678587954";
const SUGGESTIONS_POST_TITLE = "💡 SUGESTÕES | SEVEN ROLEPLAY";
const SUGGESTIONS_POST_BODY = [
  "O Seven Roleplay está em desenvolvimento, e queremos construir uma comunidade que também participe dessa evolução.",
  "",
  "Este espaço é destinado às suas ideias e sugestões para o projeto. Você pode sugerir sistemas, mecânicas, veículos, empregos, organizações, economia, mapa, interface, recursos de Roleplay e muito mais.",
  "",
  "Antes de publicar, tente explicar de forma clara:",
  "",
  "• O que você está sugerindo?",
  "• Como funcionaria?",
  "• O que isso acrescentaria ao jogo?",
  "",
  "Todas as sugestões serão avaliadas pela equipe. Uma ideia enviada aqui pode, futuramente, fazer parte do Seven Roleplay. 💜",
  "",
  "Sua ideia também pode ajudar a construir esse mundo.",
  "",
  "@everyone",
].join("\n");
let linkModerationGuildId = cleanEnv(process.env.LINK_FILTER_GUILD_ID);
let linkModerationGuildResolved = Boolean(linkModerationGuildId);
const VOICE_RECONNECT_DELAY_MS = 5000;
const VOICE_HEALTHCHECK_INTERVAL_MS = 5 * 60 * 1000;
const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
let musicManager = null;

if (!DISCORD_BOT_TOKEN) {
  console.error("ERRO: Variável DISCORD_BOT_TOKEN não definida.");
  process.exit(1);
}

console.log(
  `[Config] Token carregado (comprimento: ${DISCORD_BOT_TOKEN.length}, canal boas-vindas: ${WELCOME_CHANNEL_ID}, canal de voz: ${VOICE_CHANNEL_ID})`
);
console.log(
  `[Config] Filtro de links ${LINK_FILTER_ENABLED ? "ativo" : "desativado"}; aviso permanente no canal ${LINK_WARNING_CHANNEL_ID}`
);
console.log(
  `[Config] Anúncio do convite ${INVITE_ANNOUNCEMENT_URL} no canal ${INVITE_ANNOUNCEMENT_CHANNEL_ID}`
);
console.log(`[Config] Post de sugestões no fórum ${SUGGESTIONS_FORUM_CHANNEL_ID}`);

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function isMusicInteraction(interaction) {
  if (interaction?.type === 2 || interaction?.type === 4) return MUSIC_COMMAND_NAMES.has(interaction.data?.name);
  return interaction?.type === 3 && String(interaction.data?.custom_id || "").startsWith("music:");
}

function isInviteCopyInteraction(interaction) {
  return interaction?.type === 3 && interaction.data?.custom_id === "invite:copy";
}

function isSupportedInteraction(interaction) {
  return isMusicInteraction(interaction) || isInviteCopyInteraction(interaction);
}

async function ensureSuggestionsPost() {
  if (!client.isReady()) return;

  try {
    const forum = await client.channels.fetch(SUGGESTIONS_FORUM_CHANNEL_ID);
    if (!forum?.threads?.create || typeof forum.threads.fetchActive !== "function") {
      throw new Error(`O canal ${SUGGESTIONS_FORUM_CHANNEL_ID} não é um fórum compatível.`);
    }

    const activeThreads = await forum.threads.fetchActive();
    let existingThread = activeThreads.threads.find((thread) => thread.name === SUGGESTIONS_POST_TITLE);

    if (!existingThread && typeof forum.threads.fetchArchived === "function") {
      const archivedThreads = await forum.threads.fetchArchived({ type: "public", limit: 100 });
      existingThread = archivedThreads.threads.find((thread) => thread.name === SUGGESTIONS_POST_TITLE);
    }

    if (existingThread) {
      if (!existingThread.flags?.has("Pinned")) {
        await existingThread.pin("Publicação oficial de sugestões do Seven Roleplay");
      }
      console.log(`[Sugestões] ✅ Publicação já existente verificada e fixada: ${existingThread.id}.`);
      return;
    }

    const thread = await forum.threads.create({
      name: SUGGESTIONS_POST_TITLE,
      message: {
        content: SUGGESTIONS_POST_BODY,
        allowedMentions: { parse: ["everyone"] },
      },
      reason: "Publicação oficial inicial do canal de sugestões",
    });

    await thread.pin("Publicação oficial de sugestões do Seven Roleplay");
    console.log(`[Sugestões] ✅ Publicação criada e fixada no fórum ${SUGGESTIONS_FORUM_CHANNEL_ID} (ThreadID: ${thread.id}).`);
  } catch (error) {
    console.error(`[Sugestões] ❌ Falha ao publicar no fórum ${SUGGESTIONS_FORUM_CHANNEL_ID}:`, error.message);
  }
}

async function ensureInviteAnnouncement() {
  if (!client.isReady()) return;

  try {
    const channel = await client.channels.fetch(INVITE_ANNOUNCEMENT_CHANNEL_ID);
    if (!channel || !channel.isTextBased() || !channel.messages?.fetch || typeof channel.send !== "function") {
      throw new Error(`O canal ${INVITE_ANNOUNCEMENT_CHANNEL_ID} não aceita mensagens.`);
    }

    const recentMessages = await channel.messages.fetch({ limit: 100 });
    const existingMessage = recentMessages.find((message) => {
      if (message.author?.id !== client.user?.id) return false;
      return message.embeds?.some((embed) => embed.footer?.text === INVITE_ANNOUNCEMENT_MARKER)
        || message.content?.includes("Que tal compartilhar o SevenRP?")
        || message.components?.some((row) => row.components?.some((component) =>
          component.url === INVITE_ANNOUNCEMENT_URL || component.customId === "invite:copy" || component.custom_id === "invite:copy"));
    });

    const announcementPayload = {
      content: "",
      embeds: [{
        title: "💜 Que tal compartilhar o SevenRP?",
        description: [
          "Olá, comunidade!",
          "",
          "O SevenRP está construindo uma cidade feita para quem gosta de viver boas histórias.",
          "Compartilhe o servidor com seus amigos e ajude a trazer novas ideias, personagens e momentos para a comunidade.",
          "",
          "Cada pessoa nova ajuda a deixar o nosso Roleplay mais vivo. Obrigado por fazer parte disso! 🚀",
          "",
          "**🔗 Convite do servidor**",
          "```",
          INVITE_ANNOUNCEMENT_URL,
          "```",
        ].join("\n"),
        color: 0x7c5cff,
        footer: { text: "SEVEN RP • Compartilhe a cidade" },
      }],
      allowedMentions: { parse: [] },
    };

    if (existingMessage) {
      await existingMessage.edit(announcementPayload);
      console.log(`[Convite] ✅ Mensagem existente atualizada no canal ${INVITE_ANNOUNCEMENT_CHANNEL_ID}.`);
      return;
    }

    const sentMessage = await channel.send(announcementPayload);

    console.log(`[Convite] ✅ Mensagem publicada no canal ${INVITE_ANNOUNCEMENT_CHANNEL_ID} (MsgID: ${sentMessage.id}).`);
  } catch (error) {
    console.error(`[Convite] Falha ao publicar no canal ${INVITE_ANNOUNCEMENT_CHANNEL_ID}:`, error.message);
  }
}

// -------------------------------------------------------------
// 1. Servidor HTTP & KeepAlive (Impede que o Render Free durma)
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/discord/interactions") {
    readRequestBody(req)
      .then(async (body) => {
        const providedSecret = String(req.headers["x-worker-secret"] || "");
        if (!WORKER_SHARED_SECRET || providedSecret.length !== WORKER_SHARED_SECRET.length || providedSecret !== WORKER_SHARED_SECRET) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Não autorizado" }));
          return;
        }
        const interaction = JSON.parse(body);
        if (!isSupportedInteraction(interaction)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Interação não suportada por este worker" }));
          return;
        }
        if (isInviteCopyInteraction(interaction)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            type: 4,
            data: {
              content: `🔗 **Link do SevenRP**\n\n\`${INVITE_ANNOUNCEMENT_URL}\`\n\nToque e segure no link para copiar.`,
              flags: 64,
              allowed_mentions: { parse: [] },
            },
          }));
          return;
        }
        if (interaction.type === 4) {
          const focusedOption = (interaction.data?.options || []).find((option) => option.focused);
          const choices = interaction.data?.name === "play"
            ? await getMusicAutocompleteChoices(focusedOption?.value || "")
            : [];
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ type: 8, data: { choices } }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(interaction.type === 3 ? { type: 6 } : { type: 5, data: {} }));
        musicManager.processInteraction(interaction).catch((error) => {
          console.error(`[Música] Falha ao processar interação: ${error.message}`);
        });
      })
      .catch((error) => {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Payload inválido: ${error.message}` }));
      });
    return;
  }

  if (req.url === "/" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        workerId: WORKER_ID,
        uptimeSeconds: Math.floor(process.uptime()),
        discordConnected: client.isReady(),
        pingMs: client.isReady() ? client.ws.ping : null,
        voiceChannelId: VOICE_CHANNEL_ID,
        voiceChannelStatus: VOICE_CHANNEL_STATUS,
        voiceConnected:
          voiceConnection?.state.status === VoiceConnectionStatus.Ready,
        activeVoiceChannelId: voiceConnection?.joinConfig?.channelId || VOICE_CHANNEL_ID,
        music: musicManager?.healthSnapshot() || { active: false, queueLength: 0 },
        bannersCount: bannerFiles.length,
      })
    );
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`[HTTP] Servidor de saúde ouvindo na porta ${PORT}`);
});

function pingSelf() {
  const url = `${SELF_URL}/healthz`;
  fetch(url)
    .then((res) => {
      if (res.ok) {
        console.log(`[KeepAlive] Auto-ping bem-sucedido (${res.status})`);
      } else {
        console.warn(`[KeepAlive] Auto-ping retornou HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      console.warn(`[KeepAlive] Aviso no auto-ping:`, err.message);
    });
}
// Dispara após 5 segundos e a cada 3 minutos continuamente
setTimeout(pingSelf, 5000);
setInterval(pingSelf, 3 * 60 * 1000);

// -------------------------------------------------------------
// 2. Cliente Discord com Intents Necessários
// -------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// -------------------------------------------------------------
// 3. Conexão persistente no canal de voz
// -------------------------------------------------------------
let voiceConnection = null;
let voiceGuildId = "";
let voiceReconnectTimer = null;
let voiceConnectInFlight = null;

function scheduleVoiceReconnect(reason, delayMs = VOICE_RECONNECT_DELAY_MS) {
  if (!client.isReady() || voiceReconnectTimer) return;

  console.warn(`[Voz] Reconexão agendada em ${delayMs}ms: ${reason}`);
  voiceReconnectTimer = setTimeout(() => {
    voiceReconnectTimer = null;
    connectToVoiceChannel().catch((error) => {
      console.error("[Voz] Falha na tentativa de reconexão:", error.message);
    });
  }, delayMs);
}

async function setVoiceChannelStatus() {
  if (!client.isReady()) return false;

  try {
    const response = await fetch(
      `${DISCORD_API_BASE_URL}/channels/${VOICE_CHANNEL_ID}/voice-status`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: VOICE_CHANNEL_STATUS }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `[Voz] Não foi possível definir o status do canal (${response.status}): ${errorText}`
      );
      return false;
    }

    console.log(`[Voz] Status do canal atualizado para: ${VOICE_CHANNEL_STATUS}`);
    return true;
  } catch (error) {
    console.warn("[Voz] Erro de rede ao atualizar o status do canal:", error.message);
    return false;
  }
}

function attachVoiceConnectionHandlers(connection, channelId = VOICE_CHANNEL_ID) {
  if (connection.__sevenHandlersAttached) return;
  connection.__sevenHandlersAttached = true;
  connection.__sevenChannelId = channelId;

  connection.on(VoiceConnectionStatus.Ready, () => {
    console.log(`[Voz] ✅ Conectado ao canal ${channelId}.`);
    if (channelId === VOICE_CHANNEL_ID) {
      setVoiceChannelStatus().catch((error) => {
        console.warn("[Voz] Falha ao reaplicar o status do canal:", error.message);
      });
    }
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn("[Voz] Conexão de voz interrompida; tentando recuperar...");

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
      console.log("[Voz] Conexão de voz recuperada sem recriar a sessão.");
    } catch {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
      if (channelId === VOICE_CHANNEL_ID && !musicManager?.isBusy(voiceGuildId)) {
        scheduleVoiceReconnect("a sessão de voz não se recuperou");
      } else if (channelId !== VOICE_CHANNEL_ID && musicManager?.isBusy(voiceGuildId)) {
        musicManager.reconnectActive(voiceGuildId).catch((error) => {
          console.error("[Música] Falha ao recuperar a sessão de voz:", error.message);
        });
      }
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    console.warn("[Voz] Sessão destruída; uma nova conexão será criada.");
    if (channelId === VOICE_CHANNEL_ID && !musicManager?.isBusy(voiceGuildId)) {
      scheduleVoiceReconnect("a sessão foi destruída");
    } else if (channelId !== VOICE_CHANNEL_ID && musicManager?.isBusy(voiceGuildId)) {
      musicManager.reconnectActive(voiceGuildId).catch((error) => {
        console.error("[Música] Falha ao recriar a sessão de voz:", error.message);
      });
    }
  });

  connection.on("error", (error) => {
    console.error("[Voz] Erro na conexão de voz:", error.message);
  });
}

async function connectToVoiceChannel() {
  if (!client.isReady()) return;
  if (voiceConnectInFlight) return voiceConnectInFlight;

  voiceConnectInFlight = (async () => {
    try {
      const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
      if (!channel || !channel.isVoiceBased() || !channel.guildId) {
        throw new Error(`O canal ${VOICE_CHANNEL_ID} não é um canal de voz válido.`);
      }

      const guild = channel.guild || (await client.guilds.fetch(channel.guildId));
      voiceGuildId = guild.id;

      const existingConnection = getVoiceConnection(guild.id);
      if (existingConnection && existingConnection.joinConfig.channelId !== channel.id && existingConnection.state.status !== VoiceConnectionStatus.Destroyed) {
        existingConnection.destroy();
      }
      const connection =
        existingConnection && existingConnection.joinConfig.channelId === channel.id && existingConnection.state.status !== VoiceConnectionStatus.Destroyed
          ? existingConnection
          : joinVoiceChannel({
              channelId: channel.id,
              guildId: guild.id,
              adapterCreator: guild.voiceAdapterCreator,
              selfDeaf: true,
              selfMute: true,
            });

      voiceConnection = connection;
      attachVoiceConnectionHandlers(connection, VOICE_CHANNEL_ID);
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      await setVoiceChannelStatus();
    } catch (error) {
      console.error("[Voz] Falha ao conectar ao canal configurado:", error.message);
      scheduleVoiceReconnect("a conexão inicial falhou");
    } finally {
      voiceConnectInFlight = null;
    }
  })();

  return voiceConnectInFlight;
}

async function ensureVoiceConnection() {
  if (!client.isReady()) return;
  if (musicManager?.isBusy(voiceGuildId)) return;

  const currentConnection = voiceGuildId ? getVoiceConnection(voiceGuildId) : voiceConnection;
  if (currentConnection?.state.status === VoiceConnectionStatus.Ready) {
    voiceConnection = currentConnection;
    await setVoiceChannelStatus();
    return;
  }

  await connectToVoiceChannel();
}

musicManager = new MusicManager(client, {
  idleChannelId: VOICE_CHANNEL_ID,
  onVoiceConnection: (connection, channelId) => {
    voiceConnection = connection;
    voiceGuildId = connection.joinConfig.guildId || voiceGuildId;
    attachVoiceConnectionHandlers(connection, channelId);
  },
  onReturnToIdle: async (guildId) => {
    if (!voiceGuildId || voiceGuildId === guildId) await connectToVoiceChannel();
  },
});

async function registerMusicCommands() {
  if (!client.user) return;
  const definitions = MUSIC_COMMAND_DEFINITIONS.map((command) => ({ type: 1, ...command }));
  for (const guild of client.guilds.cache.values()) {
    const endpoint = `${DISCORD_API_BASE_URL}/applications/${client.user.id}/guilds/${guild.id}/commands`;
    try {
      const currentResponse = await fetch(endpoint, { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } });
      const current = currentResponse.ok ? await currentResponse.json() : [];
      const merged = new Map();
      for (const command of Array.isArray(current) ? current : []) {
        const { id, application_id, guild_id, version, ...definition } = command;
        merged.set(command.name, definition);
      }
      for (const definition of definitions) merged.set(definition.name, definition);
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([...merged.values()]),
      });
      if (!response.ok) {
        console.warn(`[Música] Falha ao registrar comandos no servidor ${guild.id}: ${await response.text()}`);
      } else {
        console.log(`[Música] ${definitions.length} comandos musicais registrados no servidor ${guild.id}.`);
      }
    } catch (error) {
      console.warn(`[Música] Registro de comandos indisponível no servidor ${guild.id}: ${error.message}`);
    }
  }
}

// -------------------------------------------------------------
// 3. Helpers de Comunicação com o Dashboard
// -------------------------------------------------------------
async function postToDashboard(path, payload) {
  try {
    const response = await fetch(`${DASHBOARD_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": WORKER_SHARED_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[API] Falha em POST ${path} (${response.status}): ${errText}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`[API] Erro de rede ao conectar com o Dashboard em POST ${path}:`, error.message);
    return null;
  }
}

async function getFromDashboard(path) {
  try {
    const response = await fetch(`${DASHBOARD_URL}${path}`, {
      method: "GET",
      headers: {
        "x-worker-secret": WORKER_SHARED_SECRET,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`[API] Erro de rede ao buscar do Dashboard em GET ${path}:`, error.message);
    return null;
  }
}

// -------------------------------------------------------------
// 4. Heartbeat Periódico (mantém o status "Online" no painel)
// -------------------------------------------------------------
async function sendHeartbeat() {
  if (!client.isReady()) return;

  await postToDashboard("/api/public/worker/heartbeat", {
    workerId: WORKER_ID,
    status: "online",
    gatewayLatencyMs: Math.max(0, Math.round(client.ws.ping)),
    shardCount: 1,
    version: "1.0.0",
    details: {
      guilds: client.guilds.cache.size,
      cachedMembers: client.users.cache.size,
      uptime: Math.floor(process.uptime()),
    },
  });
}

// -------------------------------------------------------------
// 5. Polling de Ações Pendentes da Fila
// -------------------------------------------------------------
async function pollActions() {
  if (!client.isReady()) return;

  const data = await getFromDashboard("/api/public/worker/actions");
  const actions = data?.actions;
  if (!Array.isArray(actions) || actions.length === 0) return;

  for (const action of actions) {
    console.log(`[Ação] Processando ação pendente ${action.id} do tipo ${action.action_type}`);
    let status = "done";
    let errorMsg = null;

    try {
      if (action.action_type === "kick_member" && action.payload?.guildId && action.payload?.userId) {
        const guild = await client.guilds.fetch(action.payload.guildId);
        await guild.members.kick(action.payload.userId, action.payload.reason || "Ação do painel");
      }
    } catch (err) {
      status = "failed";
      errorMsg = err.message || "Erro desconhecido ao executar ação";
      console.error(`[Ação] Falha ao executar ação ${action.id}:`, errorMsg);
    }

    await postToDashboard("/api/public/worker/actions", {
      id: action.id,
      status,
      error: errorMsg,
    });
  }
}

// -------------------------------------------------------------
// 6. Envio de Boas-Vindas Direto & Confiável
// -------------------------------------------------------------
async function sendWelcomeDirect(member) {
  const memberTag = member.user?.tag || member.user?.username || member.id;
  console.log(`[Boas-Vindas] Processando entrada de ${memberTag} (${member.id})`);

  try {
    const channel = await client.channels.fetch(WELCOME_CHANNEL_ID).catch((err) => {
      console.error(`[Boas-Vindas] Erro ao buscar canal ${WELCOME_CHANNEL_ID}:`, err.message);
      return null;
    });

    if (!channel) {
      console.error(`[Boas-Vindas] Canal de boas-vindas ${WELCOME_CHANNEL_ID} não encontrado no Discord.`);
      return;
    }

    // Seleção de banner rotativo local
    let attachment = null;
    if (bannerFiles.length > 0) {
      const chosen = bannerFiles[currentBannerIndex % bannerFiles.length];
      currentBannerIndex = (currentBannerIndex + 1) % bannerFiles.length;
      const fullPath = path.join(bannersDir, chosen);
      if (fs.existsSync(fullPath)) {
        attachment = new AttachmentBuilder(fullPath, { name: "seven_welcome.png" });
        console.log(`[Boas-Vindas] Banner anexado: ${chosen} (índice ${currentBannerIndex})`);
      }
    }

    const title = "👋 Bem-vindo(a) ao Seven City!";
    const description = [
      `Olá <@${member.id}>, seja muito bem-vindo(a) à nossa comunidade!`,
      `O **Seven City** está a todo vapor em fase de desenvolvimento. Ficamos muito felizes em ter você aqui desde o início acompanhando cada passo do nosso projeto.\n`,
      `📌 **Acompanhe o Projeto:**`,
      `📰 **Novidades:** Veja atualizações do projeto em <#1545226562998108201>`,
      `👀 **Spoilers:** Confira prévias e bastidores em <#1545226668044587079>`,
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(0xe63946)
      .setTitle(title)
      .setDescription(description)
      .setFooter({
        text: member.guild?.memberCount
          ? `Seven City • Membro nº ${member.guild.memberCount}`
          : `Seven City • Comunidade em desenvolvimento`,
      })
      .setTimestamp();

    if (attachment) {
      embed.setImage("attachment://seven_welcome.png");
    }

    const sentMessage = await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
      files: attachment ? [attachment] : [],
      allowedMentions: { users: [member.id] },
    });

    console.log(`[Boas-Vindas] ✅ Mensagem de boas-vindas enviada para ${memberTag} no canal ${WELCOME_CHANNEL_ID} (MsgID: ${sentMessage.id})`);

    // Registra o evento no painel e Supabase
    postToDashboard("/api/public/worker/events", {
      type: "member_join",
      guildId: member.guild.id,
      channelId: WELCOME_CHANNEL_ID,
      authorId: member.user.id,
      authorLabel: memberTag,
      avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 512 }),
      memberNumber: member.guild.memberCount,
      messageId: sentMessage.id,
      alreadySent: true,
    }).catch((err) => {
      console.warn("[Boas-Vindas] Aviso ao registrar evento no painel:", err.message);
    });
  } catch (error) {
    console.error(`[Boas-Vindas] ❌ Erro ao enviar diretamente via Discord.js:`, error);

    // Fallback: se falhar o envio direto, tenta via dashboard Vercel
    postToDashboard("/api/public/worker/events", {
      type: "member_join",
      guildId: member.guild.id,
      channelId: WELCOME_CHANNEL_ID,
      authorId: member.user.id,
      authorLabel: memberTag,
      avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 512 }),
      memberNumber: member.guild.memberCount,
      alreadySent: false,
    }).catch(() => {});
  }
}

// -------------------------------------------------------------
// 7. Eventos do Discord
// -------------------------------------------------------------
client.once("ready", () => {
  console.log(`[Discord] Bot conectado como ${client.user.tag}!`);
  console.log(`[Discord] Servidores conectados: ${client.guilds.cache.size}`);

  client.user.setPresence({
    status: "online",
    activities: [{ name: VOICE_CHANNEL_STATUS, type: ActivityType.Playing }],
  });

  resolveLinkModerationGuild().catch((error) => {
    console.error("[Moderação] Falha ao identificar o servidor do filtro de links:", error.message);
  });

  ensureInviteAnnouncement();
  ensureSuggestionsPost();
  setTimeout(() => {
    ensureInviteAnnouncement().catch((error) => {
      console.error("[Convite] Falha na segunda tentativa de publicação:", error.message);
    });
  }, 15_000).unref?.();

  registerMusicCommands().catch((error) => {
    console.error("[Música] Falha ao registrar comandos musicais:", error.message);
  });

  connectToVoiceChannel().catch((error) => {
    console.error("[Voz] Falha ao iniciar a conexão persistente:", error.message);
  });
  setInterval(() => {
    ensureVoiceConnection().catch((error) => {
      console.error("[Voz] Falha na verificação periódica:", error.message);
    });
  }, VOICE_HEALTHCHECK_INTERVAL_MS);

  // Dispara o primeiro heartbeat imediatamente
  sendHeartbeat();

  // Mantém pulso de vida a cada 30 segundos
  setInterval(sendHeartbeat, 30_000);

  // Verifica fila de ações a cada 15 segundos
  setInterval(pollActions, 15_000);
});

// Evento: Entrada de Novo Membro (dispara boas-vindas instantâneas)
client.on("guildMemberAdd", async (member) => {
  console.log(`[Discord] Novo membro detectado no Gateway: ${member.user?.tag || member.user?.username} (${member.id})`);
  await sendWelcomeDirect(member);
});

// Evento: Mensagem criada no servidor
// O filtro é executado no worker Gateway para cobrir canais de texto, threads e fóruns.
const linkWarningCooldowns = new Map();

function canSendLinkWarning(userId) {
  const now = Date.now();
  const lastWarningAt = linkWarningCooldowns.get(userId) || 0;
  if (now - lastWarningAt < LINK_WARNING_COOLDOWN_MS) return false;
  linkWarningCooldowns.set(userId, now);
  setTimeout(() => {
    if (linkWarningCooldowns.get(userId) === now) linkWarningCooldowns.delete(userId);
  }, LINK_WARNING_COOLDOWN_MS * 2).unref?.();
  return true;
}

async function sendLinkWarning(message) {
  if (!canSendLinkWarning(message.author.id)) return true;

  try {
    const channel = await client.channels.fetch(LINK_WARNING_CHANNEL_ID);
    if (!channel || typeof channel.send !== "function") {
      throw new Error(`O canal ${LINK_WARNING_CHANNEL_ID} não aceita mensagens de texto.`);
    }
    if (channel.guild?.id && channel.guild.id !== message.guild.id) {
      throw new Error(`O canal de aviso pertence a outro servidor.`);
    }

    await channel.send({
      content: buildLinkWarning(message.author.id),
      allowedMentions: { users: [message.author.id] },
    });
    return true;
  } catch (error) {
    console.error(`[Moderação] Não foi possível enviar o aviso no canal ${LINK_WARNING_CHANNEL_ID}:`, error.message);
    return false;
  }
}

async function resolveLinkModerationGuild() {
  if (linkModerationGuildResolved) return;

  try {
    const warningChannel = await client.channels.fetch(LINK_WARNING_CHANNEL_ID);
    if (!warningChannel?.guildId) throw new Error("O canal de aviso não pertence a um servidor válido.");
    linkModerationGuildId = warningChannel.guildId;
    linkModerationGuildResolved = true;
    console.log(`[Moderação] Filtro limitado ao servidor do canal de aviso: ${linkModerationGuildId}`);
  } catch (error) {
    console.error(`[Moderação] Filtro de links aguardando acesso ao canal ${LINK_WARNING_CHANNEL_ID}:`, error.message);
  }
}

function reportLinkModeration(message, detection, deleted, warningSent) {
  void postToDashboard("/api/public/worker/events", {
    type: "moderation",
    guildId: message.guild?.id,
    channelId: message.channel?.id,
    channelName: message.channel?.name,
    authorId: message.author?.id,
    authorLabel: message.author?.tag || message.author?.username || message.author?.id,
    messageId: message.id,
    messageLink: `https://discord.com/channels/${message.guild?.id}/${message.channel?.id}/${message.id}`,
    actionTaken: deleted ? "link_message_deleted" : "link_message_delete_failed",
    metadata: {
      category: "external_link",
      linkType: detection.kind,
      host: detection.host,
      deleted,
      warningChannelId: LINK_WARNING_CHANNEL_ID,
      warningSent,
      channelType: message.channel?.type ?? null,
    },
  });
}

client.on("messageCreate", async (message) => {
  if (!LINK_FILTER_ENABLED || !linkModerationGuildResolved || message.author.bot || !message.guild) return;
  if (message.guild.id !== linkModerationGuildId) return;
  if (isModerationExempt(message.member)) return;

  const detection = detectExternalLink(message.content);
  if (!detection) return;

  let deleted = false;
  try {
    if (!message.deletable) throw new Error("O bot não tem permissão para apagar esta mensagem.");
    await message.delete();
    deleted = true;
    console.log(
      `[Moderação] Link removido: ${detection.host} enviado por ${message.author.tag || message.author.username} em #${message.channel?.name || message.channel?.id}`
    );
  } catch (error) {
    console.error(`[Moderação] Falha ao remover link de ${message.author?.id}:`, error.message);
  }

  // O aviso fica permanente no chat geral e nunca é apagado pelo worker.
  const warningSent = await sendLinkWarning(message);
  reportLinkModeration(message, detection, deleted, warningSent);
});

// -------------------------------------------------------------
// 8. Inicialização do Bot
// -------------------------------------------------------------
console.log("[Discord] Conectando ao Gateway...");
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[Discord] Erro fatal ao autenticar bot no Discord:", err);
  process.exit(1);
});
