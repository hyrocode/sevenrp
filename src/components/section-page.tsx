import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CircleDollarSign, Clock3, Command, FileClock, Server, ShieldCheck, Ticket, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard, StatusBadge } from "@/components/dashboard-ui";
import { RecordPanel, formatDate, type Column } from "@/components/record-table";
import { getDashboard } from "@/lib/dashboard.functions";
import type { Json } from "@/lib/json";

type Section = "servidor" | "moderacao" | "tickets" | "economia" | "logs" | "comandos";

const copy: Record<Section, [string, string, string]> = {
  servidor: ["Infraestrutura da comunidade", "Servidor", "Canais, cargos e membros sincronizados diretamente do Discord."],
  moderacao: ["Segurança e conduta", "Moderação", "Ocorrências, sanções e revisões registradas pela equipe."],
  tickets: ["Central de atendimento", "Tickets", "Prioridades, responsáveis e tempos de resposta reais."],
  economia: ["Monitoramento financeiro", "Economia", "Fluxo econômico e transações sinalizadas para revisão."],
  logs: ["Auditoria operacional", "Logs", "Todos os eventos administrativos e automações do sistema."],
  comandos: ["Ferramentas do bot", "Comandos", "Catálogo, uso e registro dos slash commands."],
};

const tone = (value: string | null | undefined): "success" | "warning" | "danger" | "info" | "muted" => {
  const key = String(value ?? "").toLowerCase();
  if (["open", "pending", "aberto", "pendente", "review", "revisar"].includes(key)) return "warning";
  if (["closed", "resolved", "approved", "success", "ok", "concluido", "aprovado"].includes(key)) return "success";
  if (["error", "critical", "high", "alto", "banned", "denied", "rejeitado"].includes(key)) return "danger";
  if (["info", "automation", "synced"].includes(key)) return "info";
  return "muted";
};

const text = (row: Record<string, Json>, key: string) => {
  const value = row[key];
  return value === null || value === undefined || value === "" ? "—" : String(value);
};

const columnsFor: Record<string, Column[]> = {
  discord_channels: [
    { key: "name", label: "Canal", render: (row) => <span className="text-foreground">{text(row, "name")}</span> },
    { key: "type", label: "Tipo", render: (row) => (row["type"] === 2 ? "Voz" : row["type"] === 4 ? "Categoria" : "Texto") },
    { key: "position", label: "Posição" },
    { key: "nsfw", label: "NSFW", render: (row) => <StatusBadge tone={row["nsfw"] ? "warning" : "muted"}>{row["nsfw"] ? "Sim" : "Não"}</StatusBadge> },
    { key: "synced_at", label: "Sincronizado", render: (row) => formatDate(row["synced_at"]) },
  ],
  discord_roles: [
    { key: "name", label: "Cargo", render: (row) => <span className="text-foreground">{text(row, "name")}</span> },
    { key: "position", label: "Posição" },
    { key: "managed", label: "Gerenciado", render: (row) => <StatusBadge tone={row["managed"] ? "info" : "muted"}>{row["managed"] ? "Bot" : "Manual"}</StatusBadge> },
    { key: "member_count", label: "Membros" },
    { key: "synced_at", label: "Sincronizado", render: (row) => formatDate(row["synced_at"]) },
  ],
  discord_members: [
    { key: "username", label: "Membro", render: (row) => <span className="text-foreground">{text(row, "display_name") !== "—" ? text(row, "display_name") : text(row, "username")}</span> },
    { key: "username", label: "Usuário" },
    { key: "is_bot", label: "Tipo", render: (row) => <StatusBadge tone={row["is_bot"] ? "info" : "muted"}>{row["is_bot"] ? "Bot" : "Membro"}</StatusBadge> },
    { key: "joined_at", label: "Entrou", render: (row) => formatDate(row["joined_at"]) },
    { key: "synced_at", label: "Sincronizado", render: (row) => formatDate(row["synced_at"]) },
  ],
  moderation_cases: [
    { key: "reference", label: "Caso", render: (row) => <span className="text-foreground">{text(row, "reference")}</span> },
    { key: "target_label", label: "Alvo" },
    { key: "reason", label: "Motivo" },
    { key: "severity", label: "Severidade", tone: (row) => tone(row["severity"] as string) },
    { key: "status", label: "Status", tone: (row) => tone(row["status"] as string) },
    { key: "created_at", label: "Registro", render: (row) => formatDate(row["created_at"]) },
  ],
  tickets: [
    { key: "reference", label: "Ticket", render: (row) => <span className="text-foreground">{text(row, "reference")}</span> },
    { key: "title", label: "Assunto" },
    { key: "category", label: "Categoria" },
    { key: "priority", label: "Prioridade", tone: (row) => tone(row["priority"] as string) },
    { key: "status", label: "Status", tone: (row) => tone(row["status"] as string) },
    { key: "created_at", label: "Abertura", render: (row) => formatDate(row["created_at"]) },
  ],
  economy_transactions: [
    { key: "reference", label: "Transação", render: (row) => <span className="text-foreground">{text(row, "reference")}</span> },
    { key: "member_label", label: "Membro" },
    { key: "kind", label: "Tipo" },
    { key: "amount", label: "Valor", render: (row) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(row["amount"] ?? 0)) },
    { key: "risk", label: "Risco", tone: (row) => tone(row["risk"] as string) },
    { key: "created_at", label: "Data", render: (row) => formatDate(row["created_at"]) },
  ],
  audit_logs: [
    { key: "created_at", label: "Horário", render: (row) => formatDate(row["created_at"]) },
    { key: "actor_label", label: "Responsável", render: (row) => <span className="text-foreground">{text(row, "actor_label")}</span> },
    { key: "action", label: "Ação" },
    { key: "entity", label: "Entidade" },
    { key: "target_label", label: "Alvo" },
    { key: "status", label: "Status", tone: (row) => tone(row["status"] as string) },
  ],
  bot_commands: [
    { key: "name", label: "Comando", render: (row) => <span className="text-foreground">/{text(row, "name")}</span> },
    { key: "category", label: "Categoria" },
    { key: "uses", label: "Execuções" },
    { key: "failures", label: "Falhas" },
    { key: "registered", label: "Registro", render: (row) => <StatusBadge tone={row["registered"] ? "success" : "muted"}>{row["registered"] ? "Registrado" : "Não registrado"}</StatusBadge> },
    { key: "enabled", label: "Estado", render: (row) => <StatusBadge tone={row["enabled"] ? "success" : "warning"}>{row["enabled"] ? "Ativo" : "Desativado"}</StatusBadge> },
  ],
};

const serverTabs = [
  { table: "discord_channels", label: "Canais" },
  { table: "discord_roles", label: "Cargos" },
  { table: "discord_members", label: "Membros" },
] as const;

const configAction = (
  <Button asChild variant="primary" size="sm"><Link to="/configuracoes">Abrir Configurações</Link></Button>
);

export function SectionPage({ section, initialSearch = "" }: { section: Section; initialSearch?: string }) {
  const [eyebrow, title, description] = copy[section];
  const [tab, setTab] = useState<(typeof serverTabs)[number]["table"]>("discord_channels");
  const fetchDashboard = useServerFn(getDashboard);
  const overview = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard(), staleTime: 20_000 });
  const counts = overview.data?.counts;
  const configured = overview.data?.configured ?? false;
  const na = (value: number | undefined) => (overview.isLoading ? "…" : String(value ?? 0));

  type Metric = [string, string, string, typeof Activity, "primary" | "success" | "warning" | "info"];
  const metrics: Metric[] = ({
    servidor: [
      ["Membros sincronizados", na(counts?.members), configured ? "Última sincronização no painel" : "Servidor não conectado", Users, "primary"],
      ["Comandos registrados", na(counts?.commandsRegistered), "Slash commands ativos", Command, "info"],
      ["Ações na fila", na(counts?.pendingActions), "Aguardando worker externo", Server, "warning"],
    ],
    moderacao: [
      ["Casos abertos", na(counts?.openCases), "Aguardando decisão da equipe", ShieldCheck, "warning"],
      ["Revisões NSFW", na(counts?.pendingNsfw), "Fila de revisão por metadados", Clock3, "info"],
      ["Ações na fila", na(counts?.pendingActions), "Punições aguardando execução", Activity, "primary"],
    ],
    tickets: [
      ["Tickets abertos", na(counts?.openTickets), "Atendimentos em andamento", Ticket, "warning"],
      ["Casos abertos", na(counts?.openCases), "Relacionados à moderação", ShieldCheck, "primary"],
      ["Membros", na(counts?.members), "Base sincronizada", Users, "info"],
    ],
    economia: [
      ["Membros", na(counts?.members), "Base elegível", Users, "primary"],
      ["Revisões pendentes", na(counts?.pendingNsfw), "Fila de revisão", Clock3, "info"],
      ["Ações na fila", na(counts?.pendingActions), "Execuções pendentes", CircleDollarSign, "warning"],
    ],
    logs: [
      ["Execuções de comandos", na(counts?.commandUses), "Total acumulado", Activity, "primary"],
      ["Falhas de comandos", na(counts?.commandFailures), "Erros registrados", ShieldCheck, "warning"],
      ["Casos abertos", na(counts?.openCases), "Moderação pendente", FileClock, "info"],
    ],
    comandos: [
      ["Execuções", na(counts?.commandUses), "Total acumulado", Activity, "primary"],
      ["Registrados no Discord", na(counts?.commandsRegistered), "Via REST, sem gateway", Command, "info"],
      ["Falhas", na(counts?.commandFailures), "Monitoramento contínuo", ShieldCheck, "warning"],
    ],
  } as Record<Section, Metric[]>)[section];

  const table =
    section === "servidor" ? tab
      : section === "moderacao" ? "moderation_cases"
      : section === "tickets" ? "tickets"
      : section === "economia" ? "economy_transactions"
      : section === "comandos" ? "bot_commands"
      : "audit_logs";

  const emptyDescription = section === "servidor" && !configured
    ? "Conecte o servidor do Discord em Configurações para sincronizar automaticamente canais, cargos e membros."
    : "Nenhum registro real foi criado ainda. Os dados aparecem aqui assim que o sistema começar a operar.";

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<Button variant="secondary" size="sm" onClick={() => void overview.refetch()}><Activity className="size-3.5" />Atualizar</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {metrics.map(([label, value, detail, icon, cardTone]) => (
          <StatCard key={label} label={label} value={value} detail={detail} icon={icon} tone={cardTone} />
        ))}
      </div>

      {section === "servidor" && (
        <div className="mb-4 flex flex-wrap gap-2">
          {serverTabs.map((item) => (
            <Button key={item.table} size="sm" variant={tab === item.table ? "primary" : "secondary"} onClick={() => setTab(item.table)}>{item.label}</Button>
          ))}
        </div>
      )}

      <RecordPanel
        key={table}
        table={table}
        title={section === "comandos" ? "Catálogo de comandos" : section === "servidor" ? "Estrutura do servidor" : "Registros"}
        {...(section === "logs" ? { description: "Auditoria completa das ações do painel" } : {})}
        columns={columnsFor[table] ?? []}
        emptyTitle={section === "servidor" && !configured ? "Não conectado" : "Sem dados"}
        emptyDescription={emptyDescription}
        initialSearch={initialSearch}
        {...(section === "servidor" && !configured ? { emptyAction: configAction } : {})}
      />
    </>
  );
}
