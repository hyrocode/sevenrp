// Worker Persistente 24/7 para SEVEN ROLEPLAY
// Desenvolvido para rodar no Render (Web Service) + KeepAlive Anti-Sleep
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } from "discord.js";

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

if (!DISCORD_BOT_TOKEN) {
  console.error("ERRO: Variável DISCORD_BOT_TOKEN não definida.");
  process.exit(1);
}

console.log(`[Config] Token carregado (comprimento: ${DISCORD_BOT_TOKEN.length}, canal boas-vindas: ${WELCOME_CHANNEL_ID})`);

// -------------------------------------------------------------
// 1. Servidor HTTP & KeepAlive (Impede que o Render Free durma)
// -------------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        workerId: WORKER_ID,
        uptimeSeconds: Math.floor(process.uptime()),
        discordConnected: client.isReady(),
        pingMs: client.isReady() ? client.ws.ping : null,
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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
});

// -------------------------------------------------------------
// 8. Inicialização do Bot
// -------------------------------------------------------------
console.log("[Discord] Conectando ao Gateway...");
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[Discord] Erro fatal ao autenticar bot no Discord:", err);
  process.exit(1);
});
