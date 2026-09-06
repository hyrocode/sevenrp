import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, ArrowUpRight, Bot, Command, RefreshCw, Server, Settings, ShieldCheck, Ticket, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard-ui";
import { EmptyState, ErrorState, LoadingRows, formatDate } from "@/components/record-table";
import { ActivityLineChart } from "@/components/activity-line-chart";
import { getDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SEVEN CITY" },
      { name: "description", content: "Visão geral da operação do SEVEN CITY." },
      { property: "og:title", content: "Dashboard — SEVEN CITY" },
      { property: "og:description", content: "Métricas, alertas e atividade administrativa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard(), refetchInterval: 30_000 });
  const data = query.data;
  const counts = data?.counts;
  const value = (input: number | undefined) => (query.isLoading ? "…" : String(input ?? 0));
  const activity = data?.activity ?? [];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Executive Header */}
      <PageHeader
        eyebrow="SEVEN CITY • PAINEL OPERACIONAL"
        title="Visão Geral"
        description="Métricas consolidadas, integridade de serviços e atividade recente do servidor Discord."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void query.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="size-3" />
              <span>Atualizar</span>
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link to="/configuracoes">
                <Settings className="size-3" />
                <span>Configurações</span>
              </Link>
            </Button>
          </>
        }
      />

      {query.isError && (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Falha ao carregar o painel."}
          onRetry={() => void query.refetch()}
        />
      )}

      {/* Grid de Métricas Principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Membros Sincronizados"
          value={value(counts?.members)}
          detail={data?.guild?.lastSyncAt ? `Última sincronização: ${formatDate(data.guild.lastSyncAt)}` : "Aguardando sincronização"}
          icon={Users}
          tone="purple"
        />
        <StatCard
          label="Casos de Moderação"
          value={value(counts?.openCases)}
          detail="Ocorrências abertas"
          icon={ShieldCheck}
          tone="danger"
        />
        <StatCard
          label="Tickets de Atendimento"
          value={value(counts?.openTickets)}
          detail="Atendimentos ativos na fila"
          icon={Ticket}
          tone="warning"
        />
        <StatCard
          label="Execuções de Comandos"
          value={value(counts?.commandUses)}
          detail={`${counts?.commandFailures ?? 0} falhas registradas`}
          icon={Command}
          tone="secondary"
        />
      </div>

      {/* Atividade Operacional (Gráfico em Linhas Monotônico) & Saúde da Integração */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr] items-stretch">
        <Panel
          title="Atividade Operacional"
          description="Fluxo contínuo de eventos registrados nas últimas 12 horas"
          className="flex flex-col justify-between h-full"
        >
          <ActivityLineChart data={activity} />
        </Panel>

        <Panel
          title="Saúde da Integração"
          description="Status dos conectores e do gateway"
          className="flex flex-col justify-between h-full"
        >
          <div className="space-y-3 flex-1">
            {/* Status Worker */}
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0B0D14] p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded border border-white/[0.07] bg-white/[0.03] text-zinc-400">
                  <Bot className="size-3.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">
                    {data?.worker.online ? "Worker Conectado" : "Worker Offline"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {data?.worker.lastSeenAt ? `Heartbeat: ${formatDate(data.worker.lastSeenAt)}` : "Aguardando sinal"}
                  </p>
                </div>
              </div>
              <span className={data?.worker.online ? "status-dot status-dot-connected" : "status-dot status-dot-neutral"} />
            </div>

            {/* Linhas de Diagnóstico */}
            <div className="divide-y divide-white/[0.04] text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-400">API REST Discord</span>
                <StatusBadge tone={data?.configured ? "success" : "muted"}>
                  {data?.configured ? "Conectado" : "Pendente"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-400">Latência do Gateway</span>
                <span className="font-mono text-zinc-300">
                  {data?.worker.latencyMs != null ? `${data.worker.latencyMs} ms` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-400">Fila de Ações</span>
                <span className="font-medium text-zinc-300">{counts?.pendingActions ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-400">Revisões NSFW</span>
                <span className="font-medium text-zinc-300">{counts?.pendingNsfw ?? 0}</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Auditoria Recente & Módulos */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr] items-stretch">
        <Panel
          title="Últimas Ações Administrativas"
          description="Auditoria operacional de eventos registrados"
          className="flex flex-col justify-between h-full"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/logs" className="gap-1">
                <span>Ver todos</span>
                <ArrowUpRight className="size-3" />
              </Link>
            </Button>
          }
        >
          {!query.isLoading && (data?.recentAudit.length ?? 0) === 0 ? (
            <EmptyState
              title="Sem histórico recente"
              description="Nenhuma ação administrativa foi registrada nas últimas horas."
            />
          ) : (
            <DataTable headers={["Horário", "Responsável", "Ação", "Alvo", "Status"]}>
              {query.isLoading ? (
                <LoadingRows columns={5} />
              ) : (
                (data?.recentAudit ?? []).map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="px-3 py-2.5 text-xs text-zinc-400 font-mono">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-zinc-200">
                      {log.actor}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-300">
                      {log.action}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400">
                      {log.target ?? log.entity}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge
                        tone={
                          log.status === "error"
                            ? "danger"
                            : log.status === "warning"
                            ? "warning"
                            : "success"
                        }
                      >
                        {log.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          )}
        </Panel>

        <Panel
          title="Acessos Rápidos"
          description="Navegação direta para as seções"
          className="flex flex-col justify-between h-full"
        >
          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {[
              [ShieldCheck, "Moderação", "/moderacao"],
              [Ticket, "Tickets", "/tickets"],
              [Command, "Comandos", "/comandos"],
              [Server, "Servidor", "/servidor"],
            ].map(([Icon, label, to]) => {
              const LucideIcon = Icon as typeof ShieldCheck;
              return (
                <Link
                  key={to as string}
                  to={to as string}
                  className="group flex flex-col justify-between rounded-lg border border-white/[0.07] bg-[#0E1118] p-3 transition-colors hover:border-purple-500/30 hover:bg-[#131722]"
                >
                  <div className="flex size-7 items-center justify-center rounded border border-white/[0.06] bg-white/[0.03] text-zinc-400 group-hover:text-purple-300">
                    <LucideIcon className="size-3.5" />
                  </div>
                  <span className="mt-4 text-xs font-medium text-zinc-300 group-hover:text-zinc-100">
                    {label as string}
                  </span>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
