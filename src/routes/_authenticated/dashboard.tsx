import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ArrowUpRight, Bot, Command, Server, ShieldCheck, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard-ui";
import { EmptyState, ErrorState, LoadingRows, formatDate } from "@/components/record-table";
import { getDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SEVEN ROLEPLAY" }, { name: "description", content: "Visão geral da operação do SEVEN ROLEPLAY." }, { property: "og:title", content: "Dashboard — SEVEN ROLEPLAY" }, { property: "og:description", content: "Métricas, alertas e atividade administrativa." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard(), refetchInterval: 30_000 });
  const data = query.data;
  const counts = data?.counts;
  const value = (input: number | undefined) => (query.isLoading ? "…" : String(input ?? 0));
  const activity = data?.activity ?? [];
  const peak = Math.max(1, ...activity);

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Seven City"
        description={data?.configured ? `Servidor ${data.guild?.name ?? ""} conectado via API oficial do Discord.` : "Nenhum servidor do Discord conectado. Conclua a configuração para começar a sincronizar dados reais."}
        actions={<>
          <Button asChild size="sm" variant="secondary"><Link to="/configuracoes">Configurações</Link></Button>
          <Button variant="primary" size="sm" onClick={() => void query.refetch()}><Activity className="size-3.5" />Atualizar painel</Button>
        </>}
      />

      {query.isError && <div className="mb-6"><ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao carregar o painel."} onRetry={() => void query.refetch()} /></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Membros sincronizados" value={value(counts?.members)} detail={data?.guild?.lastSyncAt ? `Sincronizado em ${formatDate(data.guild.lastSyncAt)}` : "Aguardando sincronização"} icon={Users} tone="success" />
        <StatCard label="Casos de moderação" value={value(counts?.openCases)} detail="Abertos e aguardando decisão" icon={ShieldCheck} tone="warning" />
        <StatCard label="Tickets abertos" value={value(counts?.openTickets)} detail="Atendimentos em andamento" icon={Ticket} />
        <StatCard label="Execuções de comandos" value={value(counts?.commandUses)} detail={`${counts?.commandFailures ?? 0} falhas registradas`} icon={Command} tone="info" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
        <Panel title="Atividade administrativa" description="Eventos registrados nas últimas 12 horas">
          {activity.every((item) => item === 0) ? (
            <EmptyState title="Sem dados" description="Nenhum evento nas últimas 12 horas. O gráfico é preenchido conforme o painel e o bot operam." />
          ) : (
            <>
              <div className="flex h-64 items-end gap-2 pt-6">
                {activity.map((item, index) => (
                  <div key={index} className="group flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-sm bg-primary/25 transition-colors hover:bg-primary" style={{ height: `${Math.max(4, Math.round((item / peak) * 100))}%` }} title={`${item} eventos`} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>-12h</span><span>-9h</span><span>-6h</span><span>-3h</span><span>agora</span></div>
            </>
          )}
        </Panel>

        <Panel title="Saúde do sistema" description="Estado real da integração">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className={`flex size-12 items-center justify-center rounded-md ${data?.worker.online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}><Bot className="size-6" /></div>
              <div>
                <p className="font-medium">{data?.worker.online ? "Worker conectado" : "Bot offline"}</p>
                <p className="text-xs text-muted-foreground">{data?.worker.lastSeenAt ? `Último sinal em ${formatDate(data.worker.lastSeenAt)}` : "Nenhum worker persistente conectado."}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">API REST do Discord</span><StatusBadge tone={data?.configured ? "success" : "muted"}>{data?.configured ? "Conectada" : "Não conectada"}</StatusBadge></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Latência do gateway</span><span>{data?.worker.latencyMs != null ? `${data.worker.latencyMs} ms` : "—"}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Ações na fila</span><span>{counts?.pendingActions ?? 0}</span></div>
            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Revisões NSFW</span><span>{counts?.pendingNsfw ?? 0}</span></div>
            <p className="rounded-md border border-warning/20 bg-warning/8 p-3 text-xs leading-5 text-warning">
              Este ambiente é serverless e não mantém uma conexão Gateway 24/7. Eventos em tempo real exigem um worker externo conectado às rotas <code>/api/public/worker/*</code>.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <Panel title="Últimos eventos" description="Auditoria do painel" action={<Button asChild size="sm" variant="ghost"><Link to="/logs">Ver todos <ArrowUpRight className="size-3.5" /></Link></Button>}>
          {!query.isLoading && (data?.recentAudit.length ?? 0) === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma ação administrativa registrada até agora." />
          ) : (
            <DataTable headers={["Horário", "Responsável", "Ação", "Alvo", "Status"]}>
              {query.isLoading ? <LoadingRows columns={5} /> : (data?.recentAudit ?? []).map((log) => (
                <tr key={log.id} className="border-b border-border/70 hover:bg-accent/40">
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-3 text-sm">{log.actor}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{log.action}</td>
                  <td className="px-3 py-3 text-sm text-muted-foreground">{log.target ?? log.entity}</td>
                  <td className="px-3 py-3"><StatusBadge tone={log.status === "error" ? "danger" : log.status === "warning" ? "warning" : "success"}>{log.status}</StatusBadge></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title="Ações rápidas">
          <div className="grid grid-cols-2 gap-3">
            {([[ShieldCheck, "Moderação", "/moderacao"], [Ticket, "Tickets", "/tickets"], [Command, "Comandos", "/comandos"], [Server, "Servidor", "/servidor"]] as const).map(([Icon, label, to]) => (
              <Link key={to} to={to} className="flex min-h-24 flex-col items-start justify-between rounded-md border border-border bg-secondary p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
                <Icon className="size-5 text-primary" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
