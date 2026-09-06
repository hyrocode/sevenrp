// Worker Persistente 24/7 para SEVEN ROLEPLAY
// Desenvolvido para rodar no Render (Web Service) + UptimeRobot (100% Grátis)
import http from "node:http";
import { Client, GatewayIntentBits } from "discord.js";

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

if (!DISCORD_BOT_TOKEN) {
  console.error("ERRO: Variável DISCORD_BOT_TOKEN não definida.");
  process.exit(1);
}

console.log(`[Config] Token carregado (comprimento: ${DISCORD_BOT_TOKEN.length}, prefixo: ${DISCORD_BOT_TOKEN.slice(0, 8)}...)`);


// -------------------------------------------------------------
// 1. Servidor HTTP (para o Render considerar Web Service & UptimeRobot)
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
      // Exemplo de execução conforme action_type
      if (action.action_type === "kick_member" && action.payload?.guildId && action.payload?.userId) {
        const guild = await client.guilds.fetch(action.payload.guildId);
        await guild.members.kick(action.payload.userId, action.payload.reason || "Ação do painel");
      }
    } catch (err) {
      status = "failed";
      errorMsg = err.message || "Erro desconhecido ao executar ação";
      console.error(`[Ação] Falha ao executar ação ${action.id}:`, errorMsg);
    }

    // Confirma execução para o painel
    await postToDashboard("/api/public/worker/actions", {
      id: action.id,
      status,
      error: errorMsg,
    });
  }
}

// -------------------------------------------------------------
// 6. Eventos do Discord
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

// Evento: Entrada de Novo Membro (dispara boas-vindas com banner e cargo)
client.on("guildMemberAdd", async (member) => {
  console.log(`[Discord] Novo membro entrou: ${member.user.tag} (${member.id})`);

  try {
    const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 512 });
    await postToDashboard("/api/public/worker/events", {
      type: "member_join",
      guildId: member.guild.id,
      authorId: member.user.id,
      authorLabel: member.user.tag || member.user.username,
      avatarUrl,
      memberNumber: member.guild.memberCount,
    });
  } catch (error) {
    console.error("[Discord] Falha ao processar evento guildMemberAdd:", error);
  }
});

// Evento: Mensagem criada no servidor (monitoramento básico de termos/spam)
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Se você tiver automações adicionais ou quiser logar mensagens para revisão,
  // elas podem ser enviadas para /api/public/worker/events aqui.
});

// -------------------------------------------------------------
// 7. Inicialização do Bot
// -------------------------------------------------------------
console.log("[Discord] Conectando ao Gateway...");
client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[Discord] Erro fatal ao autenticar bot no Discord:", err);
  process.exit(1);
});
