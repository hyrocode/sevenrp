import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldAlert, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge } from "@/components/dashboard-ui";
import { RecordPanel, ErrorState, formatDate, type Column } from "@/components/record-table";
import { autoConnectGuild, getIntegrationStatus, getOAuthUrl, registerSlashCommands, syncGuild, testBotToken } from "@/lib/discord.functions";
import type { Json } from "@/lib/json";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — SEVEN ROLEPLAY" }, { name: "description", content: "Conecte o servidor do Discord e configure o bot oficial do SEVEN ROLEPLAY." }, { property: "og:title", content: "Configurações — SEVEN ROLEPLAY" }, { property: "og:description", content: "Token, permissões, sincronização e slash commands." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SettingsPage,
});

const PERMISSIONS = [
  { key: "VIEW_CHANNEL", label: "Ver canais" },
  { key: "SEND_MESSAGES", label: "Enviar mensagens" },
  { key: "EMBED_LINKS", label: "Enviar embeds" },
  { key: "ATTACH_FILES", label: "Anexar arquivos" },
  { key: "READ_MESSAGE_HISTORY", label: "Ler histórico" },
  { key: "MANAGE_MESSAGES", label: "Gerenciar mensagens" },
  { key: "MODERATE_MEMBERS", label: "Silenciar membros" },
  { key: "KICK_MEMBERS", label: "Expulsar membros" },
  { key: "BAN_MEMBERS", label: "Banir membros" },
  { key: "MANAGE_ROLES", label: "Gerenciar cargos" },
] as const;

const termColumns: Column[] = [
  { key: "term", label: "Termo" },
  { key: "match_mode", label: "Correspondência" },
  { key: "severity", label: "Severidade" },
  { key: "action", label: "Ação" },
  { key: "hits", label: "Ocorrências" },
  { key: "enabled", label: "Estado", render: (row) => <StatusBadge tone={row["enabled"] ? "success" : "muted"}>{row["enabled"] ? "Ativo" : "Inativo"}</StatusBadge> },
];

const embedColumns: Column[] = [
  { key: "name", label: "Embed" },
  { key: "key", label: "Chave" },
  { key: "target_channel_id", label: "Canal" },
  { key: "last_published_at", label: "Publicado", render: (row: Record<string, Json>) => formatDate(row["last_published_at"]) },
];

function Step({ index, title, done, children }: { index: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border py-5 first:pt-0 last:border-none last:pb-0">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${done ? "bg-success/12 text-success" : "bg-primary/10 text-primary"}`}>{done ? <CheckCircle2 className="size-4" /> : index}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-3 space-y-3 text-xs text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getIntegrationStatus);
  const runTest = useServerFn(testBotToken);
  const runSync = useServerFn(syncGuild);
  const buildUrl = useServerFn(getOAuthUrl);
  const runRegister = useServerFn(registerSlashCommands);

  const status = useQuery({ queryKey: ["integration"], queryFn: () => fetchStatus(), refetchInterval: 60_000 });
  const [guilds, setGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [guildId, setGuildId] = useState("");
  const [permissions, setPermissions] = useState<string[]>(PERMISSIONS.map((item) => item.key));
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["integration"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["records"] });
  };

  const test = useMutation({
    mutationFn: () => runTest(),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      setGuilds(result.guilds.map((g) => ({ id: g.id, name: g.name })));
      if (!guildId && result.guilds[0]) setGuildId(result.guilds[0].id);
      toast.success(`Token válido — conectado como ${result.bot.username}`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao testar o token."),
  });

  const sync = useMutation({
    mutationFn: (id: string) => runSync({ data: { guildId: id } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`${result.guildName}: ${result.channels} canais, ${result.roles} cargos, ${result.members} membros sincronizados.`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao sincronizar."),
  });

  const oauth = useMutation({
    mutationFn: () => buildUrl({ data: { permissions, guildId: guildId || null } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      setOauthUrl(result.url);
      toast.success("URL de convite gerada com permissões mínimas.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao gerar a URL."),
  });

  const register = useMutation({
    mutationFn: () => runRegister(),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`${result.total} slash commands registrados no servidor.`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao registrar comandos."),
  });

  const data = status.data;
  const tokenOk = Boolean(data?.tokenConfigured);
  const synced = Boolean(data?.guild?.guildId);

  // Conexão direta: enquanto o bot não estiver vinculado a um servidor, o painel
  // consulta o Discord e sincroniza sozinho assim que o bot entra na guild.
  const autoConnect = useServerFn(autoConnectGuild);
  const auto = useQuery({
    queryKey: ["integration", "auto-connect"],
    queryFn: () => autoConnect(),
    enabled: tokenOk && !synced,
    refetchInterval: tokenOk && !synced ? 10_000 : false,
    retry: false,
  });

  useEffect(() => {
    if (!auto.data) return;
    if (auto.data.guilds.length) setGuilds(auto.data.guilds.map((g) => ({ id: g.id, name: g.name })));
    if (auto.data.state === "connected" && !synced) {
      toast.success("Servidor detectado — canais, cargos e membros sincronizados automaticamente.");
      invalidate();
    }
  }, [auto.data, synced]);

  return (
    <>
      <PageHeader
        eyebrow="Integração e plataforma"
        title="Configurações"
        description="Conecte o bot oficial ao servidor do Discord. O token vive apenas como segredo do backend e nunca é exibido no painel."
        actions={<Button variant="secondary" size="sm" onClick={() => void status.refetch()}><RefreshCw className="size-3.5" />Atualizar estado</Button>}
      />

      {status.isError && <div className="mb-6"><ErrorState message={status.error instanceof Error ? status.error.message : "Falha ao ler o estado da integração."} onRetry={() => void status.refetch()} /></div>}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Panel title="Conexão com o Discord" description="Assistente em etapas">
          <div>
            <Step index={1} title="Token do bot no backend" done={tokenOk}>
              <p>O token é lido do segredo <code>DISCORD_BOT_TOKEN</code> no backend. Ele nunca é retornado, registrado em log ou exibido aqui.</p>
              <StatusBadge tone={tokenOk ? "success" : "warning"}>{tokenOk ? "Segredo configurado" : "Configuração necessária"}</StatusBadge>
            </Step>

            <Step index={2} title="Teste real do token" done={guilds.length > 0}>
              <p>Autentica na API oficial do Discord e devolve apenas a identidade pública do bot e os servidores disponíveis.</p>
              <Button size="sm" variant="primary" disabled={test.isPending} onClick={() => test.mutate()}>
                {test.isPending && <Loader2 className="size-3.5 animate-spin" />}Testar token
              </Button>
            </Step>

            <Step index={3} title="Selecionar o servidor" done={synced}>
              {guilds.length === 0 ? (
                <p>Execute o teste do token para listar os servidores em que o bot já está presente, ou informe o ID manualmente.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {guilds.map((guild) => (
                    <Button key={guild.id} size="sm" variant={guildId === guild.id ? "primary" : "secondary"} onClick={() => setGuildId(guild.id)}>{guild.name}</Button>
                  ))}
                </div>
              )}
              <input value={guildId} onChange={(event) => setGuildId(event.target.value.trim())} placeholder="ID do servidor (guild ID)" className="h-10 w-full max-w-sm rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:border-primary" />
            </Step>

            <Step index={4} title="Sincronizar canais, cargos e membros" done={synced}>
              <p>Ao conectar, o painel puxa a estrutura real do servidor e atualiza automaticamente todas as listas.</p>
              <Button size="sm" variant="primary" disabled={!guildId || sync.isPending} onClick={() => sync.mutate(guildId)}>
                {sync.isPending && <Loader2 className="size-3.5 animate-spin" />}Conectar e sincronizar
              </Button>
              {data?.guild?.lastSyncAt && <p>Última sincronização: {formatDate(data.guild.lastSyncAt)}</p>}
              {data?.guild?.lastError && <p className="text-danger">{data.guild.lastError}</p>}
            </Step>

            <Step index={5} title="Permissões mínimas e convite oficial">
              <div className="flex flex-wrap gap-2">
                {PERMISSIONS.map((permission) => {
                  const active = permissions.includes(permission.key);
                  return (
                    <button key={permission.key} type="button" onClick={() => setPermissions((current) => active ? current.filter((item) => item !== permission.key) : [...current, permission.key])} className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      {permission.label}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" variant="secondary" disabled={oauth.isPending} onClick={() => oauth.mutate()}>
                {oauth.isPending && <Loader2 className="size-3.5 animate-spin" />}Gerar URL de convite
              </Button>
              {oauthUrl && <a href={oauthUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all text-primary hover:underline">{oauthUrl}<ExternalLink className="size-3" /></a>}
            </Step>

            <Step index={6} title="Registrar slash commands" done={Boolean(data?.guild?.guildId)}>
              <p>Os comandos são registrados via REST e funcionam pelo endpoint de interações, sem gateway persistente.</p>
              <Button size="sm" variant="primary" disabled={!synced || register.isPending} onClick={() => register.mutate()}>
                {register.isPending && <Loader2 className="size-3.5 animate-spin" />}<Terminal className="size-3.5" />Registrar comandos
              </Button>
            </Step>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Estado da integração">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Token do bot</span><StatusBadge tone={tokenOk ? "success" : "warning"}>{tokenOk ? "Configurado" : "Necessário"}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Servidor</span><StatusBadge tone={synced ? "success" : "muted"}>{data?.guild?.guildName ?? "Não conectado"}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Chave pública (interações)</span><StatusBadge tone={data?.publicKeyConfigured ? "success" : "muted"}>{data?.publicKeyConfigured ? "Configurada" : "Pendente"}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Segredo do worker</span><StatusBadge tone={data?.workerSecretConfigured ? "success" : "muted"}>{data?.workerSecretConfigured ? "Configurado" : "Pendente"}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Worker persistente</span><StatusBadge tone={data?.worker.online ? "success" : "muted"}>{data?.worker.online ? "Conectado" : "Bot offline"}</StatusBadge></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Membros</span><span>{data?.guild?.memberCount ?? "—"}</span></div>
            </div>
          </Panel>

          <Panel title="Limitação de infraestrutura">
            <div className="flex gap-3 text-xs leading-5 text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                Este backend é serverless: não existe processo residente para manter uma conexão Discord Gateway 24/7.
                Tudo que a API REST e as interações HTTP permitem já funciona de verdade (token, sincronização, embeds, slash commands, punições).
                Eventos em tempo real (anti-spam, termos bloqueados, NSFW, anti-raid) dependem de um worker externo que consome
                <code> /api/public/worker/events</code>, <code> /heartbeat</code> e <code> /actions</code>. Enquanto nenhum worker enviar heartbeat, o painel mostra “Bot offline”.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <RecordPanel table="blocked_terms" title="Termos bloqueados" description="Regras de linguagem aplicadas pelo worker" columns={termColumns} emptyTitle="Sem dados" emptyDescription="Nenhum termo cadastrado. As regras criadas aqui são entregues ao worker externo." />
        <RecordPanel table="embeds" title="Embeds institucionais" description="Conteúdo publicável nos canais reais" columns={embedColumns} emptyTitle="Sem dados" emptyDescription="Nenhum embed cadastrado até agora." />
      </div>
    </>
  );
}
