import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, ArrowUpRight, Bot, Command, Server, ShieldCheck, Ticket, Users,
  Zap, Settings, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Panel, StatCard, StatusBadge } from "@/components/dashboard-ui";
import { EmptyState, ErrorState, LoadingRows, formatDate } from "@/components/record-table";
import { getDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SEVEN ROLEPLAY" },
      { name: "description", content: "Visão geral da operação do SEVEN ROLEPLAY." },
      { property: "og:title", content: "Dashboard — SEVEN ROLEPLAY" },
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
  const peak = Math.max(1, ...activity);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Welcome Banner com Gradiente e Orb Radial (Estilo WhatsApp Automação) */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 sm:p-7"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 50%, rgba(15,20,31,0.95) 100%)",
          border: "1px solid rgba(99,102,241,0.22)",
          boxShadow: "0 0 40px -10px rgba(99,102,241,0.15)",
        }}
      >
        {/* Glow Radial Orb */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Activity className="size-3.5 text-[#A5B4FC]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A5B4FC]">
                Painel de Controle • Seven City
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Central de Operações & Gestão Discord
            </h2>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              {data?.configured
                ? `Servidor ${data.guild?.name ?? "SEVEN CITY"} sincronizado com sucesso via Discord Gateway.`
                : "Monitore membros, moderação, tickets, automações de boas-vindas e economia em tempo real."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void query.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span>Atualizar</span>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/configuracoes">
                <Settings className="size-3.5" />
                <span>Configurações</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {query.isError && (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Falha ao carregar o painel."}
          onRetry={() => void query.refetch()}
        />
      )}

      {/* Grid de Métricas Principais (MetricCards com roxo como secundária) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Membros Sincronizados"
          value={value(counts?.members)}
          detail={data?.guild?.lastSyncAt ? `Sincronizado em ${formatDate(data.guild.lastSyncAt)}` : "Aguardando sincronização"}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="Casos de Moderação"
          value={value(counts?.openCases)}
          detail="Abertos aguardando decisão"
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
          tone="purple"
        />
      </div>

      {/* Seção Central: Atividade Administrativa & Saúde do Sistema */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_.9fr]">
        <Panel
          title="Atividade Administrativa"
          description="Volume de eventos registrados nas últimas 12 horas"
        >
          {activity.every((item) => item === 0) ? (
            <EmptyState
              title="Sem dados de atividade"
              description="Nenhum evento nas últimas 12 horas. O gráfico é preenchido conforme a comunidade interage."
            />
          ) : (
            <>
              <div className="flex h-56 items-end gap-2.5 pt-4">
                {activity.map((item, index) => (
                  <div key={index} className="group relative flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md transition-all duration-200"
                      style={{
                        height: `${Math.max(6, Math.round((item / peak) * 100))}%`,
                        background:
                          item > 0
                            ? "linear-gradient(180deg, #818CF8 0%, rgba(99, 102, 241, 0.3) 100%)"
                            : "rgba(255, 255, 255, 0.05)",
                      }}
                      title={`${item} eventos`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>-12h</span>
                <span>-9h</span>
                <span>-6h</span>
                <span>-3h</span>
                <span>Agora</span>
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Saúde da Integração"
          description="Monitoramento da API e Gateway"
        >
          <div className="space-y-4">
            {/* Bot Status Banner */}
            <div className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
              <div
                className="flex size-10 items-center justify-center rounded-xl"
                style={{
                  background: data?.worker.online ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)",
                  color: data?.worker.online ? "#34D399" : "#64748B",
                  border: data?.worker.online ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <Bot className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  {data?.worker.online ? "Worker Persistente Online" : "Bot Desconectado"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {data?.worker.lastSeenAt ? `Último pulso em ${formatDate(data.worker.lastSeenAt)}` : "Aguardando conexão com o worker."}
                </p>
              </div>
              <span
                className={`status-dot ml-auto ${data?.worker.online ? "status-dot-connected" : "status-dot-neutral"}`}
              />
            </div>

            {/* Health Rows */}
            <div className="divide-y divide-white/[0.04] text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-400">API REST do Discord</span>
                <StatusBadge tone={data?.configured ? "success" : "muted"}>
                  {data?.configured ? "Conectada" : "Pendente"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-400">Latência do Gateway</span>
                <span className="font-mono text-slate-200">
                  {data?.worker.latencyMs != null ? `${data.worker.latencyMs} ms` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-400">Ações na Fila</span>
                <span className="font-semibold text-slate-200">{counts?.pendingActions ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-400">Revisões NSFW Pendentes</span>
                <span className="font-semibold text-slate-200">{counts?.pendingNsfw ?? 0}</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200/90">
              ⚡ O worker 24/7 garante o monitoramento instantâneo do Discord e as mensagens de boas-vindas com rotação de banners.
            </div>
          </div>
        </Panel>
      </div>

      {/* Seção Inferior: Últimos Eventos & Ações Rápidas */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <Panel
          title="Últimas Ações Administrativas"
          description="Auditoria em tempo real das alterações feitas no servidor"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/logs" className="gap-1">
                <span>Ver todos</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {!query.isLoading && (data?.recentAudit.length ?? 0) === 0 ? (
            <EmptyState
              title="Sem histórico recente"
              description="Nenhuma ação administrativa foi executada nas últimas horas."
            />
          ) : (
            <DataTable headers={["Horário", "Responsável", "Ação", "Alvo", "Status"]}>
              {query.isLoading ? (
                <LoadingRows columns={5} />
              ) : (
                (data?.recentAudit ?? []).map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="px-3.5 py-3 text-xs text-slate-400 font-mono">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-3.5 py-3 text-xs font-semibold text-white">
                      {log.actor}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-slate-300">
                      {log.action}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-slate-400">
                      {log.target ?? log.entity}
                    </td>
                    <td className="px-3.5 py-3">
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
          title="Ações Rápidas"
          description="Acesso direto aos módulos de gerenciamento"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              [ShieldCheck, "Moderação", "/moderacao", "#F87171"],
              [Ticket, "Tickets", "/tickets", "#FCD34D"],
              [Command, "Comandos", "/comandos", "#60A5FA"],
              [Server, "Servidor", "/servidor", "#C4B5FD"], // Roxo secundário
            ].map(([Icon, label, to, color]) => {
              const LucideIcon = Icon as typeof ShieldCheck;
              return (
                <Link
                  key={to as string}
                  to={to as string}
                  className="group flex min-h-[96px] flex-col justify-between rounded-xl border border-white/[0.06] bg-[#121824] p-3.5 transition-all duration-150 hover:border-indigo-500/30 hover:bg-white/[0.04]"
                >
                  <div
                    className="flex size-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                    style={{
                      background: `${color as string}18`,
                      border: `1px solid ${color as string}30`,
                      color: color as string,
                    }}
                  >
                    <LucideIcon className="size-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white">
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
