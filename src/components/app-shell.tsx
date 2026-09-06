import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, ChevronLeft, CircleDollarSign, Command, FileClock, Gauge, LogOut, Menu,
  Search, Server, Settings, ShieldCheck, Ticket, Wand2, X, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getDashboard } from "@/lib/dashboard.functions";

interface NavItem {
  id: string;
  label: string;
  to: "/dashboard" | "/inicializacao" | "/servidor" | "/moderacao" | "/tickets" | "/economia" | "/logs" | "/comandos" | "/configuracoes";
  icon: typeof Gauge;
  color: string;
  badgeKey?: "openCases" | "openTickets";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { id: "dashboard", label: "Visão Geral", to: "/dashboard", icon: Gauge, color: "#A5B4FC" },
      { id: "inicializacao", label: "Inicialização", to: "/inicializacao", icon: Wand2, color: "#C4B5FD" }, // Roxo secundário
      { id: "servidor", label: "Servidor & Cargos", to: "/servidor", icon: Server, color: "#6EE7B7" },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "moderacao", label: "Moderação", to: "/moderacao", icon: ShieldCheck, color: "#F87171", badgeKey: "openCases" },
      { id: "tickets", label: "Tickets de Suporte", to: "/tickets", icon: Ticket, color: "#FCD34D", badgeKey: "openTickets" },
      { id: "economia", label: "Economia & Transações", to: "/economia", icon: CircleDollarSign, color: "#34D399" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { id: "logs", label: "Logs & Auditoria", to: "/logs", icon: FileClock, color: "#94A3B8" },
      { id: "comandos", label: "Comandos Slash", to: "/comandos", icon: Command, color: "#60A5FA" },
      { id: "configuracoes", label: "Configurações", to: "/configuracoes", icon: Settings, color: "#C4B5FD" }, // Roxo secundário
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // Descobre título ativo
  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => item.to === pathname);
  const activeTitle = activeItem?.label ?? "Painel Administrativo";

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const fetchDashboard = useServerFn(getDashboard);
  const overview = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 30_000,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const alerts = (overview.data?.counts.pendingNsfw ?? 0) + (overview.data?.counts.openCases ?? 0);
  const isWorkerOnline = Boolean(overview.data?.worker.online);
  const initials = (session.data?.displayName ?? "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "7R";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = search.trim();
    if (!term) return;
    navigate({ to: "/logs", search: { q: term } });
    setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-white/[0.05] px-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              boxShadow: "0 0 14px rgba(99, 102, 241, 0.35)",
            }}
          >
            <span className="font-bold text-white text-xs">7</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold tracking-tight text-white">Seven City</p>
              <p className="text-[10px] font-medium text-slate-400">Central Administrativa</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden size-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white lg:flex"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex size-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-400 lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="section-title mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.to === pathname;
                const badgeValue = item.badgeKey ? overview.data?.counts[item.badgeKey] ?? 0 : 0;

                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                      isActive
                        ? "border-indigo-500/25 bg-indigo-500/10 text-white"
                        : "border-transparent text-slate-400 hover:border-white/[0.04] hover:bg-white/[0.04] hover:text-slate-200",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                      style={
                        isActive
                          ? {
                              background: `${item.color}20`,
                              color: item.color,
                              border: `1px solid ${item.color}35`,
                            }
                          : {
                              background: "rgba(255, 255, 255, 0.03)",
                              color: "#64748B",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                            }
                      }
                    >
                      <Icon className="size-3.5" />
                    </div>

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeValue > 0 ? (
                          <span className="shrink-0 rounded-md border border-rose-500/25 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                            {badgeValue}
                          </span>
                        ) : isActive ? (
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                          />
                        ) : null}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Status Card */}
      {!collapsed ? (
        <div className="mt-auto shrink-0 border-t border-white/[0.05] p-3">
          <div className="rounded-xl border border-white/[0.06] bg-[#121824] p-3">
            <div className="mb-1 flex items-center gap-2.5">
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: isWorkerOnline ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)",
                  color: isWorkerOnline ? "#34D399" : "#64748B",
                  border: isWorkerOnline ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <Server className="size-3" />
              </div>
              <span className="text-[11px] font-semibold text-slate-200">
                {isWorkerOnline ? "Servidor Ativo" : "Worker Offline"}
              </span>
              <span
                className={cn("status-dot ml-auto", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")}
              />
            </div>
            <p className="pl-8 text-[10px] text-slate-500">
              Supabase • Render • Gateway
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex shrink-0 justify-center border-t border-white/[0.05] p-3">
          <span className={cn("status-dot", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")} />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-[#0F141F] transition-[width] duration-200 lg:block",
          collapsed ? "w-20" : "w-60"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-72 flex-col border-r border-white/[0.06] bg-[#0F141F]">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn("min-h-screen transition-[margin] duration-200", collapsed ? "lg:ml-20" : "lg:ml-60")}>
        {/* Fixed Header (Glassmorphic) */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] px-4 backdrop-blur-xl sm:px-6"
          style={{ background: "rgba(8, 12, 20, 0.9)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-300 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4" />
            </button>
            <div>
              <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:block">
                Painel Administrativo
              </span>
              <h1 className="text-xs font-bold text-white sm:text-sm">{activeTitle}</h1>
            </div>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={submitSearch}
            className="hidden max-w-xs flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-1.5 md:flex"
          >
            <Search className="size-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar logs e registros..."
              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </form>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#121824] px-2.5 py-1.5">
              <span className={cn("status-dot", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")} />
              <span
                className="hidden text-[11px] font-semibold sm:block"
                style={{ color: isWorkerOnline ? "var(--success)" : "var(--text-muted)" }}
              >
                {isWorkerOnline ? "Bot Conectado" : "Bot Offline"}
              </span>
              <span className="rounded-md border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-purple-300">
                Gateway 24/7
              </span>
            </div>

            {/* Alerts */}
            <Link
              to="/moderacao"
              title="Alertas pendentes"
              className="btn btn-ghost relative p-2"
            >
              <Bell className="size-4" />
              {alerts > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 shadow-[0_0_6px_#EF4444]" />
              )}
            </Link>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-2 pl-1 border-l border-white/[0.06]">
              <div
                className="flex size-7 items-center justify-center rounded-lg text-xs font-bold text-purple-200"
                style={{
                  background: "rgba(139, 92, 246, 0.15)",
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                }}
              >
                {initials}
              </div>
              <button
                onClick={handleSignOut}
                className="btn btn-danger p-1.5"
                title="Sair do painel"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-7">{children}</main>
      </div>
    </div>
  );
}
