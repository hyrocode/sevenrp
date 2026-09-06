import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, ChevronLeft, CircleDollarSign, Command, FileClock, Gauge, LogOut, Menu,
  Search, Server, Settings, ShieldCheck, Ticket, Wand2, X
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
  badgeKey?: "openCases" | "openTickets";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [
      { id: "dashboard", label: "Visão Geral", to: "/dashboard", icon: Gauge },
      { id: "inicializacao", label: "Inicialização", to: "/inicializacao", icon: Wand2 },
      { id: "servidor", label: "Servidor & Cargos", to: "/servidor", icon: Server },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "moderacao", label: "Moderação", to: "/moderacao", icon: ShieldCheck, badgeKey: "openCases" },
      { id: "tickets", label: "Tickets de Suporte", to: "/tickets", icon: Ticket, badgeKey: "openTickets" },
      { id: "economia", label: "Economia", to: "/economia", icon: CircleDollarSign },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "logs", label: "Auditoria & Logs", to: "/logs", icon: FileClock },
      { id: "comandos", label: "Comandos Slash", to: "/comandos", icon: Command },
      { id: "configuracoes", label: "Configurações", to: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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
      <div className="flex h-13 items-center justify-between border-b border-white/[0.07] px-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-950/40 text-xs font-semibold text-purple-300">
            7
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-100">Seven City</p>
              <p className="text-[10px] text-zinc-500">Gestão Discord</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden size-6 items-center justify-center rounded border border-white/[0.06] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 lg:flex"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex size-7 items-center justify-center rounded border border-white/[0.06] text-zinc-400 lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {group.label}
              </div>
            )}
            <div className="mt-0.5 space-y-0.5">
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
                      "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border",
                      isActive
                        ? "border-purple-500/25 bg-purple-600/10 text-purple-200"
                        : "border-transparent text-zinc-400 hover:border-white/[0.04] hover:bg-white/[0.03] hover:text-zinc-200",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0 transition-colors", isActive ? "text-purple-300" : "text-zinc-500 group-hover:text-zinc-300")} />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {badgeValue > 0 && (
                          <span className="shrink-0 rounded border border-rose-500/25 bg-rose-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-rose-300">
                            {badgeValue}
                          </span>
                        )}
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
        <div className="mt-auto shrink-0 border-t border-white/[0.06] p-2.5">
          <div className="rounded-lg border border-white/[0.06] bg-[#11141D] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-300">Gateway Discord</span>
              <span className={cn("status-dot", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")} />
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {isWorkerOnline ? "Worker ativo • Render" : "Worker desconectado"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex shrink-0 justify-center border-t border-white/[0.06] p-2.5">
          <span className={cn("status-dot", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")} />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.07] bg-[#0E1118] transition-[width] duration-150 lg:block",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/75"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-white/[0.07] bg-[#0E1118]">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn("min-h-screen transition-[margin] duration-150", collapsed ? "lg:ml-16" : "lg:ml-60")}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0A0C10]/95 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex size-7 items-center justify-center rounded border border-white/[0.07] text-zinc-300 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">Seven City</span>
              <span className="text-zinc-600">/</span>
              <h1 className="font-semibold text-zinc-200">{activeTitle}</h1>
            </div>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={submitSearch}
            className="hidden max-w-xs flex-1 items-center gap-2 rounded-md border border-white/[0.07] bg-[#0E1118] px-2.5 py-1.5 md:flex"
          >
            <Search className="size-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar logs e registros..."
              className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
            />
          </form>

          {/* Right Section */}
          <div className="flex items-center gap-2.5">
            {/* Status Pill */}
            <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-[#0E1118] px-2.5 py-1 text-[11px]">
              <span className={cn("status-dot", isWorkerOnline ? "status-dot-connected" : "status-dot-neutral")} />
              <span className="text-zinc-300 font-medium">
                {isWorkerOnline ? "Gateway Ativo" : "Offline"}
              </span>
            </div>

            {/* Alerts */}
            <Link
              to="/moderacao"
              title="Alertas pendentes"
              className="btn btn-ghost p-1.5"
            >
              <Bell className="size-4" />
              {alerts > 0 && (
                <span className="size-1.5 rounded-full bg-rose-500" />
              )}
            </Link>

            {/* User Profile / Logout */}
            <div className="flex items-center gap-2 border-l border-white/[0.07] pl-2.5">
              <div className="flex size-7 items-center justify-center rounded-md border border-purple-500/30 bg-purple-950/40 text-xs font-semibold text-purple-300">
                {initials}
              </div>
              <button
                onClick={handleSignOut}
                className="btn btn-ghost p-1.5 text-zinc-400 hover:text-rose-300"
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
