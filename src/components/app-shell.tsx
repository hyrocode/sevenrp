import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, ChevronLeft, CircleDollarSign, Command, FileClock, Gauge, LogOut, Menu,
  Search, Server, Settings, ShieldCheck, Ticket, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getDashboard } from "@/lib/dashboard.functions";

const navigation: ReadonlyArray<{
  label: string;
  to: "/dashboard" | "/inicializacao" | "/servidor" | "/moderacao" | "/tickets" | "/economia" | "/logs" | "/comandos" | "/configuracoes";
  icon: typeof Gauge;
  badgeKey?: "openCases" | "openTickets";
}> = [
  { label: "Dashboard", to: "/dashboard", icon: Gauge },
  { label: "Inicialização", to: "/inicializacao", icon: Wand2 },
  { label: "Servidor", to: "/servidor", icon: Server },
  { label: "Moderação", to: "/moderacao", icon: ShieldCheck, badgeKey: "openCases" },
  { label: "Tickets", to: "/tickets", icon: Ticket, badgeKey: "openTickets" },
  { label: "Economia", to: "/economia", icon: CircleDollarSign },
  { label: "Logs", to: "/logs", icon: FileClock },
  { label: "Comandos", to: "/comandos", icon: Command },
  { label: "Configurações", to: "/configuracoes", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = navigation.find((item) => item.to === pathname)?.label ?? "Dashboard";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const fetchDashboard = useServerFn(getDashboard);
  const overview = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard(), refetchInterval: 60_000, staleTime: 30_000, refetchOnWindowFocus: false });

  const alerts = (overview.data?.counts.pendingNsfw ?? 0) + (overview.data?.counts.openCases ?? 0);
  const initials = (session.data?.displayName ?? "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SR";

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

  const sidebar = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground shadow-primary"><span>7</span></div>
        {!collapsed && <div className="min-w-0"><p className="truncate font-semibold text-sidebar-foreground">SEVEN ROLEPLAY</p><p className="text-[11px] text-muted-foreground">Central administrativa</p></div>}
        <Button variant="ghost" size="icon" className="ml-auto hidden lg:inline-flex" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}><ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} /></Button>
        <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-5" /></Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navegação principal">
        {!collapsed && <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase text-muted-foreground">Operação</p>}
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === pathname;
          const badgeValue = item.badgeKey ? overview.data?.counts[item.badgeKey] ?? 0 : 0;
          return <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} className={cn("flex h-11 items-center gap-3 rounded-md border px-3 text-sm transition-colors", isActive ? "border-primary/25 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-0")}><Icon className="size-[18px] shrink-0" />{!collapsed && <><span className="flex-1">{item.label}</span>{badgeValue > 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{badgeValue}</span>}</>}</Link>;
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials}<span className={cn("absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-sidebar", overview.data?.worker.online ? "bg-success" : "bg-muted-foreground")} /></div>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{session.isLoading ? "Carregando..." : session.data?.displayName ?? "Sem sessão"}</p><p className="truncate text-xs capitalize text-muted-foreground">{session.data?.roles.join(", ") ?? "—"}</p></div>}
          {!collapsed && <Button variant="ghost" size="icon" aria-label="Sair do painel" onClick={handleSignOut}><LogOut className="size-4" /></Button>}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-[width] lg:flex lg:flex-col", collapsed ? "w-20" : "w-64")}>{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-overlay" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" /><aside className="relative flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar">{sidebar}</aside></div>}
      <div className={cn("min-h-screen transition-[margin]", collapsed ? "lg:ml-20" : "lg:ml-64")}>
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></Button>
          <div><p className="text-xs text-muted-foreground">Painel administrativo</p><h1 className="font-semibold">{active}</h1></div>
          <form onSubmit={submitSearch} className="ml-auto hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-secondary px-3 md:flex"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar no painel" placeholder="Buscar em logs e auditoria..." className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></form>
          <Link to="/moderacao" aria-label="Alertas pendentes" className="relative inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><Bell className="size-5" />{alerts > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />}</Link>
          <Button variant="ghost" size="icon" aria-label="Sair do painel" className="md:hidden" onClick={handleSignOut}><LogOut className="size-5" /></Button>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
