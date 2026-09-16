import { spawn } from "node:child_process";
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus, entersState, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import ffmpegPath from "ffmpeg-static";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const JAMENDO_API_URL = "https://api.jamendo.com/v3.0/tracks/";
const AUDIUS_API_URL = "https://discoveryprovider.audius.co/v1";
const MUSIC_RETURN_DELAY_MS = 5000;
const SEARCH_TIMEOUT_MS = 7000;

export const MUSIC_COMMAND_DEFINITIONS = [
  {
    name: "play",
    description: "Busca e adiciona uma música à fila",
    options: [{ type: 3, name: "consulta", description: "Nome da música ou link de áudio autorizado", required: true, max_length: 200 }],
  },
  { name: "pause", description: "Pausa a música atual" },
  { name: "resume", description: "Continua a música pausada" },
  { name: "avancar", description: "Avança para a próxima música" },
  { name: "stop", description: "Para a música e retorna ao canal de espera" },
  { name: "fila", description: "Mostra a fila de músicas" },
  { name: "agora", description: "Mostra a música atual" },
  {
    name: "volume",
    description: "Ajusta o volume da música",
    options: [{ type: 4, name: "nivel", description: "Volume entre 0 e 100", required: true, min_value: 0, max_value: 100 }],
  },
  {
    name: "loop",
    description: "Configura a repetição da fila",
    options: [{ type: 3, name: "modo", description: "Modo de repetição", required: true, choices: [{ name: "Desligado", value: "off" }, { name: "Música atual", value: "track" }, { name: "Fila", value: "queue" }] }],
  },
  { name: "shuffle", description: "Embaralha a fila" },
  {
    name: "remove",
    description: "Remove uma posição da fila",
    options: [{ type: 4, name: "posicao", description: "Posição na fila", required: true, min_value: 1, max_value: 100 }],
  },
  { name: "sair", description: "Retorna ao canal de espera" },
];

export const MUSIC_COMMAND_NAMES = new Set(MUSIC_COMMAND_DEFINITIONS.map((command) => command.name));

function env(name) {
  return String(process.env[name] ?? "").trim();
}

function optionValue(interaction, name) {
  return interaction.data?.options?.find((option) => option.name === name)?.value;
}

function formatDuration(milliseconds) {
  const total = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function safeText(value, fallback = "Desconhecido") {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 1000) : fallback;
}

function userLabel(interaction) {
  const user = interaction.member?.user ?? interaction.user;
  return user?.global_name || user?.username || "Membro";
}

function userId(interaction) {
  return interaction.member?.user?.id ?? interaction.user?.id ?? "";
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function allowedDirectUrl(value) {
  if (!isHttpUrl(value)) return false;
  const url = new URL(value);
  const configuredDomains = env("MUSIC_ALLOWED_DOMAINS")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (configuredDomains.length > 0) {
    return configuredDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  }
  return (
    url.hostname === "jamendo.com" ||
    url.hostname.endsWith(".jamendo.com") ||
    url.hostname === "audius.co" ||
    url.hostname.endsWith(".audius.co") ||
    url.hostname === "staked.cloud" ||
    url.hostname.endsWith(".staked.cloud")
  );
}

function directTrack(url) {
  const parsed = new URL(url);
  const filename = decodeURIComponent(parsed.pathname.split("/").pop() || "Audio autorizado").replace(/\.[a-z0-9]+$/i, "");
  return {
    id: `direct:${url}`,
    title: safeText(filename, "Áudio autorizado"),
    artist: "Fonte direta",
    album: "",
    year: "",
    durationMs: 0,
    artworkUrl: "",
    source: "Link autorizado",
    sourceUrl: url,
    streamUrl: url,
  };
}

function spotifyArtist(track) {
  return track?.artists?.map((artist) => artist.name).filter(Boolean).join(", ") || "Artista desconhecido";
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) throw new Error(parsed?.error?.message || parsed?.message || `HTTP ${response.status}`);
  return parsed;
}

async function searchSpotify(query) {
  const clientId = env("SPOTIFY_CLIENT_ID");
  const clientSecret = env("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return null;
    const url = new URL("https://api.spotify.com/v1/search");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", "1");
    const data = await fetchJson(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const track = data?.tracks?.items?.[0];
    if (!track) return null;
    return {
      title: track.name,
      artist: spotifyArtist(track),
      album: track.album?.name || "",
      year: track.album?.release_date?.slice(0, 4) || "",
      durationMs: track.duration_ms || 0,
      artworkUrl: track.album?.images?.[0]?.url || "",
      sourceUrl: track.external_urls?.spotify || "",
      source: "Spotify",
    };
  } catch (error) {
    console.warn(`[Música] Busca Spotify indisponível: ${error.message}`);
    return null;
  }
}

async function searchYouTube(query) {
  const apiKey = env("YOUTUBE_API_KEY");
  if (!apiKey) return null;

  try {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "1");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("key", apiKey);
    const data = await fetchJson(searchUrl);
    const item = data?.items?.[0];
    if (!item) return null;
    const videoId = item.id?.videoId;
    return {
      title: item.snippet?.title || query,
      artist: item.snippet?.channelTitle || "YouTube",
      album: "",
      year: item.snippet?.publishedAt?.slice(0, 4) || "",
      durationMs: 0,
      artworkUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "",
      sourceUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
      source: "YouTube",
    };
  } catch (error) {
    console.warn(`[Música] Busca YouTube indisponível: ${error.message}`);
    return null;
  }
}

async function searchJamendo(query) {
  const clientId = env("JAMENDO_CLIENT_ID");
  if (!clientId) return null;

  try {
    const url = new URL(JAMENDO_API_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("search", query);
    url.searchParams.set("audioformat", "mp32");
    url.searchParams.set("imagesize", "500");
    url.searchParams.set("include", "musicinfo");
    const data = await fetchJson(url);
    const item = data?.results?.find((track) => track.audio);
    if (!item) return null;
    return {
      id: `jamendo:${item.id}`,
      title: item.name,
      artist: item.artist_name,
      album: item.album_name || "",
      year: item.releasedate?.slice(0, 4) || "",
      durationMs: Number(item.duration || 0) * 1000,
      artworkUrl: item.album_image || item.image || "",
      source: "Jamendo",
      sourceUrl: item.shareurl || item.shorturl || "",
      streamUrl: item.audio,
    };
  } catch (error) {
    console.warn(`[Música] Busca Jamendo indisponível: ${error.message}`);
    return null;
  }
}

async function searchAudius(query) {
  try {
    const url = new URL(`${AUDIUS_API_URL}/tracks/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", "5");
    const data = await fetchJson(url);
    const item = data?.data?.find((track) => track?.id && track?.is_streamable !== false);
    if (!item) return null;
    const artwork = item.artwork || {};
    const permalink = String(item.permalink || "").trim();
    return {
      id: `audius:${item.id}`,
      title: item.title || query,
      artist: item.user?.name || "Artista desconhecido",
      album: item.album?.album_name || "",
      year: item.release_date?.slice(0, 4) || "",
      durationMs: Number(item.duration || 0) * 1000,
      artworkUrl: artwork["1000x1000"] || artwork["480x480"] || artwork["150x150"] || "",
      source: "Audius",
      sourceUrl: permalink ? `https://audius.co${permalink.startsWith("/") ? permalink : `/${permalink}`}` : "",
      streamUrl: `${AUDIUS_API_URL}/tracks/${encodeURIComponent(item.id)}/stream`,
    };
  } catch (error) {
    console.warn(`[Música] Busca Audius indisponível: ${error.message}`);
    return null;
  }
}

async function resolveTrack(query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) throw new Error("Informe o nome ou o link da música.");

  if (isHttpUrl(normalizedQuery)) {
    if (!allowedDirectUrl(normalizedQuery)) {
      throw new Error("Esse link não está em uma fonte de áudio autorizada pelo worker.");
    }
    return directTrack(normalizedQuery);
  }

  const [spotify, youtube] = await Promise.all([searchSpotify(normalizedQuery), searchYouTube(normalizedQuery)]);
  const searchTerm = spotify ? `${spotify.title} ${spotify.artist}` : normalizedQuery;
  const playable = (await searchAudius(searchTerm)) || (await searchJamendo(searchTerm));
  if (!playable) {
    throw new Error("Não encontrei uma faixa reproduzível nas fontes autorizadas agora. Tente outro nome.");
  }

  return {
    ...playable,
    ...(spotify || youtube || {}),
    id: playable.id,
    streamUrl: playable.streamUrl,
    source: `${playable.source}${spotify ? " • info Spotify" : youtube ? " • info YouTube" : ""}`,
    sourceUrl: playable.sourceUrl || spotify?.sourceUrl || youtube?.sourceUrl || "",
  };
}

function controls() {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: "music:pause", label: "Pausar", emoji: { name: "⏸️" } },
        { type: 2, style: 1, custom_id: "music:resume", label: "Continuar", emoji: { name: "▶️" } },
        { type: 2, style: 1, custom_id: "music:skip", label: "Avançar", emoji: { name: "⏭️" } },
        { type: 2, style: 2, custom_id: "music:shuffle", label: "Aleatório", emoji: { name: "🔀" } },
        { type: 2, style: 4, custom_id: "music:stop", label: "Parar", emoji: { name: "⏹️" } },
      ],
    },
  ];
}

function trackEmbed(track, session) {
  const status = session.player.state.status === AudioPlayerStatus.Paused ? "Pausada" : "Tocando agora";
  const fields = [
    { name: "Artista", value: safeText(track.artist), inline: true },
    { name: "Álbum", value: safeText(track.album, "Single"), inline: true },
    { name: "Ano", value: safeText(track.year, "—"), inline: true },
    { name: "Duração", value: formatDuration(track.durationMs), inline: true },
    { name: "Volume", value: `${Math.round(session.volume * 100)}%`, inline: true },
    { name: "Repetição", value: session.loop === "track" ? "Música" : session.loop === "queue" ? "Fila" : "Desligada", inline: true },
  ];
  const embed = {
    title: `🎶 ${status}`,
    description: track.sourceUrl ? `[${safeText(track.title)}](${track.sourceUrl})` : safeText(track.title),
    color: 0x7c5cff,
    fields,
    footer: { text: `Fonte: ${safeText(track.source)} • Solicitado por ${safeText(track.requestedBy)}` },
    timestamp: new Date().toISOString(),
  };
  if (track.artworkUrl) embed.thumbnail = { url: track.artworkUrl };
  return embed;
}

function responseBody(content, session = null) {
  if (!session?.current) return { content: content || "Nenhuma música está tocando.", embeds: [], components: [] };
  return { content: content || "", embeds: [trackEmbed(session.current, session)], components: controls() };
}

async function webhookEdit(interaction, body) {
  if (!interaction.application_id || !interaction.token) return;
  const response = await fetch(`${DISCORD_API_BASE_URL}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao atualizar resposta da música (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export class MusicManager {
  constructor(client, options) {
    this.client = client;
    this.idleChannelId = options.idleChannelId;
    this.onVoiceConnection = options.onVoiceConnection;
    this.onReturnToIdle = options.onReturnToIdle;
    this.sessions = new Map();
  }

  createSession(guildId) {
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    const session = {
      guildId,
      player,
      queue: [],
      current: null,
      connection: null,
      activeChannelId: this.idleChannelId,
      returnChannelId: this.idleChannelId,
      mode: "idle",
      loop: "off",
      volume: 1,
      ffmpeg: null,
      resource: null,
      lastInteraction: null,
      transition: null,
      returnTimer: null,
      stopping: false,
      skipRequested: false,
      lastError: null,
      playbackOffsetMs: 0,
      startedAt: 0,
      restartRequested: false,
      restartPositionMs: 0,
    };
    player.on(AudioPlayerStatus.Idle, () => {
      this.advance(session).catch((error) => console.error(`[Música] Falha ao avançar fila: ${error.message}`));
    });
    player.on("error", (error) => {
      session.lastError = error.message;
      console.error(`[Música] Erro no player (${guildId}): ${error.message}`);
      this.advance(session).catch((advanceError) => console.error(`[Música] Falha ao recuperar player: ${advanceError.message}`));
    });
    this.sessions.set(guildId, session);
    return session;
  }

  getSession(guildId) {
    return this.sessions.get(guildId) || this.createSession(guildId);
  }

  isBusy(guildId) {
    const session = this.sessions.get(guildId);
    return Boolean(session?.mode === "music" && (session.current || session.queue.length));
  }

  healthSnapshot() {
    const sessions = [...this.sessions.values()].filter((session) => session.current || session.queue.length);
    const session = sessions[0];
    return {
      active: Boolean(session),
      guildId: session?.guildId || null,
      activeChannelId: session?.activeChannelId || this.idleChannelId,
      current: session?.current ? { title: session.current.title, artist: session.current.artist, source: session.current.source } : null,
      queueLength: session?.queue.length || 0,
      state: session?.player.state.status || AudioPlayerStatus.Idle,
    };
  }

  async reconnectActive(guildId) {
    const session = this.sessions.get(guildId);
    if (!session || session.mode !== "music" || !session.activeChannelId) return;
    try {
      await this.ensureConnection(session, session.activeChannelId);
      if (session.current && session.player.state.status === AudioPlayerStatus.Idle) await this.startNext(session);
    } catch (error) {
      session.lastError = error.message;
      console.error(`[Música] Reconexão da sessão falhou: ${error.message}`);
    }
  }

  async getUserVoiceChannel(guildId, memberId) {
    const guild = this.client.guilds.cache.get(guildId) || await this.client.guilds.fetch(guildId);
    const cached = guild.voiceStates.cache.get(memberId);
    if (cached?.channelId) return { guild, channelId: cached.channelId };
    try {
      const member = await guild.members.fetch(memberId);
      return { guild, channelId: member.voice.channelId };
    } catch {
      return { guild, channelId: null };
    }
  }

  async ensureConnection(session, channelId) {
    const guild = this.client.guilds.cache.get(session.guildId) || await this.client.guilds.fetch(session.guildId);
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isVoiceBased() || channel.guildId !== session.guildId) throw new Error("O canal de voz informado não está disponível.");

    const existing = getVoiceConnection(session.guildId);
    if (existing && existing.joinConfig.channelId === channelId && existing.state.status !== VoiceConnectionStatus.Destroyed) {
      session.connection = existing;
      existing.subscribe(session.player);
      this.onVoiceConnection?.(existing, channelId);
      await entersState(existing, VoiceConnectionStatus.Ready, 30000);
      return existing;
    }

    if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) existing.destroy();
    const connection = joinVoiceChannel({
      channelId,
      guildId: session.guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
    session.connection = connection;
    this.onVoiceConnection?.(connection, channelId);
    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    connection.subscribe(session.player);
    return connection;
  }

  spawnAudio(track, session) {
    if (!ffmpegPath) throw new Error("FFmpeg não está disponível no worker.");
    const args = [
      "-hide_banner", "-loglevel", "error",
      "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
      "-i", track.streamUrl,
      "-vn", "-ac", "2", "-ar", "48000", "-c:a", "libopus", "-b:a", "128k", "-f", "webm", "pipe:1",
    ];
    if (session.playbackOffsetMs > 0) args.unshift("-ss", String(session.playbackOffsetMs / 1000));
    args.splice(11, 0, "-af", `volume=${session.volume}`);
    const ffmpeg = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    ffmpeg.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-2000);
    });
    ffmpeg.on("error", (error) => {
      session.lastError = error.message;
      console.error(`[Música] FFmpeg falhou: ${error.message}`);
    });
    ffmpeg.on("close", (code) => {
      if (code && !session.stopping && !session.skipRequested) {
        console.warn(`[Música] FFmpeg terminou com código ${code}: ${stderr}`);
      }
    });
    return ffmpeg;
  }

  async startNext(session) {
    if (session.current || session.queue.length === 0) return;
    const next = session.queue.shift();
    session.current = next;
    session.playbackOffsetMs = Number(next.offsetMs || 0);
    delete next.offsetMs;
    session.startedAt = Date.now() - session.playbackOffsetMs;
    session.skipRequested = false;
    session.lastError = null;
    try {
      await this.ensureConnection(session, session.activeChannelId);
      const ffmpeg = this.spawnAudio(next, session);
      session.ffmpeg = ffmpeg;
      const resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.WebmOpus,
        metadata: { title: next.title, track: next },
      });
      session.resource = resource;
      session.player.play(resource);
      await entersState(session.player, AudioPlayerStatus.Playing, 15000);
      await this.updateNowPlaying(session);
    } catch (error) {
      session.lastError = error.message;
      console.error(`[Música] Não foi possível iniciar ${next.title}: ${error.message}`);
      this.cleanupAudio(session);
      session.current = null;
      if (session.queue.length) return this.startNext(session);
      await this.returnToIdle(session);
    }
  }

  cleanupAudio(session) {
    if (session.ffmpeg && !session.ffmpeg.killed) session.ffmpeg.kill("SIGKILL");
    session.ffmpeg = null;
    session.resource = null;
  }

  async advance(session) {
    if (session.transition) return session.transition;
    session.transition = (async () => {
      this.cleanupAudio(session);
      if (session.stopping) {
        session.current = null;
        session.stopping = false;
        return;
      }
      const ended = session.current;
      session.current = null;
      if (session.restartRequested && ended) {
        session.restartRequested = false;
        session.queue.unshift({ ...ended, offsetMs: session.restartPositionMs });
        await this.startNext(session);
        return;
      }
      if (ended && session.loop === "track" && !session.skipRequested) session.queue.unshift(ended);
      if (ended && session.loop === "queue" && !session.skipRequested) session.queue.push(ended);
      if (session.queue.length) {
        await this.startNext(session);
      } else {
        await this.returnToIdle(session);
      }
    })().finally(() => {
      session.transition = null;
    });
    return session.transition;
  }

  async returnToIdle(session) {
    if (session.returnTimer) clearTimeout(session.returnTimer);
    session.returnTimer = setTimeout(async () => {
      session.returnTimer = null;
      session.mode = "idle";
      session.activeChannelId = this.idleChannelId;
      session.returnChannelId = this.idleChannelId;
      try {
        await this.onReturnToIdle?.(session.guildId);
        session.connection = getVoiceConnection(session.guildId) || session.connection;
      } catch (error) {
        console.error(`[Música] Falha ao retornar ao canal de espera: ${error.message}`);
      }
    }, MUSIC_RETURN_DELAY_MS);
  }

  async updateNowPlaying(session, body = null) {
    if (!session.lastInteraction) return;
    try {
      await webhookEdit(session.lastInteraction, body || responseBody("", session));
    } catch (error) {
      console.warn(`[Música] Não foi possível atualizar o painel da música: ${error.message}`);
    }
  }

  async enqueue(interaction, session, track, channelId) {
    if (session.mode === "music" && session.activeChannelId !== channelId) {
      throw new Error(`Já estou tocando em <#${session.activeChannelId}>. Use o comando naquele canal para não interromper a fila atual.`);
    }
    if (session.returnTimer) {
      clearTimeout(session.returnTimer);
      session.returnTimer = null;
    }
    if (session.mode !== "music") {
      session.returnChannelId = session.activeChannelId || this.idleChannelId;
      session.activeChannelId = channelId;
      session.mode = "music";
    }
    track.requestedBy = userLabel(interaction);
    session.lastInteraction = interaction;
    session.queue.push(track);
    await this.ensureConnection(session, channelId);
    await this.startNext(session);
  }

  async handleCommand(interaction) {
    const guildId = interaction.guild_id;
    if (!guildId) throw new Error("Este comando só pode ser usado dentro de um servidor.");
    const session = this.getSession(guildId);
    session.lastInteraction = interaction;
    const memberId = userId(interaction);
    const command = interaction.data?.name;
    const { guild, channelId } = await this.getUserVoiceChannel(guildId, memberId);
    const needsVoice = new Set(["play", "pause", "resume", "avancar", "stop", "volume", "loop", "shuffle", "remove", "sair"]);
    if (needsVoice.has(command) && !channelId) throw new Error("Entre em um canal de voz antes de usar este comando.");

    if (command === "play") {
      const query = optionValue(interaction, "consulta");
      const track = await resolveTrack(query);
      await this.enqueue(interaction, session, track, channelId);
      return responseBody(session.current === track ? "✅ Música iniciada." : `✅ **${track.title}** adicionada à fila.`, session);
    }
    if (command === "pause") {
      if (!session.current) throw new Error("Não há música tocando.");
      session.player.pause(true);
      return responseBody("⏸️ Música pausada.", session);
    }
    if (command === "resume") {
      if (!session.current) throw new Error("Não há música pausada.");
      session.player.unpause();
      return responseBody("▶️ Música retomada.", session);
    }
    if (command === "avancar") {
      if (!session.current) throw new Error("Não há música tocando.");
      session.skipRequested = true;
      session.player.stop(true);
      return responseBody("⏭️ Avançando para a próxima música.", session);
    }
    if (command === "stop" || command === "sair") {
      session.queue = [];
      session.stopping = true;
      session.player.stop(true);
      this.cleanupAudio(session);
      session.current = null;
      await this.returnToIdle(session);
      return { content: "⏹️ Reprodução encerrada. Voltarei ao canal **Preparando Cidade...**.", embeds: [], components: [] };
    }
    if (command === "fila") {
      const rows = session.queue.slice(0, 15).map((track, index) => `${index + 1}. **${track.title}** — ${track.artist}`);
      return { content: rows.length ? `📋 **Fila atual**\n${rows.join("\n")}` : "📋 A fila está vazia.", embeds: [], components: [] };
    }
    if (command === "agora") return responseBody("🎶 Música atual", session);
    if (command === "shuffle") {
      for (let index = session.queue.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [session.queue[index], session.queue[other]] = [session.queue[other], session.queue[index]];
      }
      return responseBody("🔀 Fila embaralhada.", session);
    }
    if (command === "remove") {
      const position = Number(optionValue(interaction, "posicao")) - 1;
      if (!Number.isInteger(position) || position < 0 || position >= session.queue.length) throw new Error("Essa posição não existe na fila.");
      const [removed] = session.queue.splice(position, 1);
      return responseBody(`🗑️ **${removed.title}** removida da fila.`, session);
    }
    if (command === "loop") {
      const mode = String(optionValue(interaction, "modo") || "off");
      session.loop = ["off", "track", "queue"].includes(mode) ? mode : "off";
      return responseBody(`🔁 Repetição: **${session.loop === "off" ? "desligada" : session.loop === "track" ? "música atual" : "fila"}**.`, session);
    }
    if (command === "volume") {
      const level = Math.max(0, Math.min(100, Number(optionValue(interaction, "nivel"))));
      session.volume = level / 100;
      if (session.current && session.player.state.status !== AudioPlayerStatus.Idle) {
        session.restartRequested = true;
        session.restartPositionMs = Math.max(0, Date.now() - session.startedAt);
        session.player.stop(true);
      }
      return responseBody(`🔊 Volume ajustado para **${level}%**.`, session);
    }
    throw new Error("Comando de música não reconhecido.");
  }

  async handleButton(interaction) {
    const guildId = interaction.guild_id;
    const session = guildId ? this.getSession(guildId) : null;
    if (!session) throw new Error("Sessão de música não encontrada.");
    session.lastInteraction = interaction;
    const action = String(interaction.data?.custom_id || "").split(":")[1];
    const { channelId } = await this.getUserVoiceChannel(guildId, userId(interaction));
    if (session.activeChannelId && channelId !== session.activeChannelId) throw new Error(`Entre em <#${session.activeChannelId}> para controlar a música.`);
    if (action === "pause") session.player.pause(true);
    else if (action === "resume") session.player.unpause();
    else if (action === "skip") { session.skipRequested = true; session.player.stop(true); }
    else if (action === "shuffle") {
      for (let index = session.queue.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [session.queue[index], session.queue[other]] = [session.queue[other], session.queue[index]];
      }
    } else if (action === "stop") {
      session.queue = [];
      session.stopping = true;
      session.player.stop(true);
      this.cleanupAudio(session);
      session.current = null;
      await this.returnToIdle(session);
    } else throw new Error("Controle de música inválido.");
    return session.current ? responseBody("", session) : { content: "⏹️ Reprodução encerrada.", embeds: [], components: [] };
  }

  async processInteraction(interaction) {
    try {
      const body = interaction.type === 3 ? await this.handleButton(interaction) : await this.handleCommand(interaction);
      await webhookEdit(interaction, body);
    } catch (error) {
      console.warn(`[Música] Interação não concluída: ${error.message}`);
      await webhookEdit(interaction, { content: `⚠️ ${error.message}`, embeds: [], components: [] }).catch(() => {});
    }
  }
}
