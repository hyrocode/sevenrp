import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, CheckCircle2, Lock, LogIn, Mail, MessageSquare, Shield,
  ShieldCheck, Sparkles, Zap
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso Administrativo — SEVEN ROLEPLAY" },
      { name: "description", content: "Entre com sua conta da equipe para acessar o painel administrativo do SEVEN ROLEPLAY." },
      { property: "og:title", content: "Acesso Administrativo — SEVEN ROLEPLAY" },
      { property: "og:description", content: "Área restrita da equipe administrativa do SEVEN ROLEPLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        toast.success("Autenticado com sucesso!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Credenciais inválidas. Verifique seu e-mail e senha.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0F17] p-4 sm:p-6 lg:p-8">
      {/* Background Ambient Glows (Inspirado no LoginView de referência) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -right-32 -top-32 size-[520px] rounded-full opacity-20 blur-[110px]"
          style={{ background: "radial-gradient(circle, #6366F1 0%, #8B5CF6 60%, transparent 80%)" }}
        />
        <div
          className="absolute -bottom-32 -left-32 size-[480px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "#3B82F6" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Main Container Card (2 Colunas) */}
      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0B0F17]/90 shadow-[0_32px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl lg:grid-cols-12 animate-fade-up">
        {/* Coluna Esquerda: Vitrine e Destaques */}
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-indigo-950/30 via-purple-950/20 to-transparent p-8 lg:col-span-6 lg:border-b-0 lg:border-r lg:p-10">
          <div className="relative z-10">
            {/* Header Brand */}
            <div className="mb-8 flex items-center gap-3.5">
              <div className="relative">
                <div
                  className="flex size-12 items-center justify-center rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                    boxShadow: "0 0 25px rgba(99,102,241,0.45)",
                  }}
                >
                  <span className="text-xl font-black text-white tracking-tight">7</span>
                </div>
                <span className="absolute -right-1 -top-1 size-3.5 rounded-full border-2 border-[#0B0F17] bg-emerald-400 shadow-[0_0_8px_#10B981]" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                  Seven City
                </h1>
                <p className="text-xs font-semibold text-purple-300/80">
                  SEVEN ROLEPLAY • Central Administrativa
                </p>
              </div>
            </div>

            {/* Feature Bullets */}
            <div className="my-6 space-y-3.5">
              <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#121824]/60 p-3.5">
                <div className="mt-0.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Bot Persistente 24/7 & Gateway
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    Conexão direta com o Discord para comandos, cargos automáticos e moderação.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#121824]/60 p-3.5">
                <div className="mt-0.5 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2 text-purple-300 shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Boas-Vindas com Banners Rotativos
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    Disparo instantâneo no canal configurado com alternância de artes da cidade.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#121824]/60 p-3.5">
                <div className="mt-0.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400 shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    Segurança & Auditoria Completa
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    Registro de todas as ações administrativas, tickets, economia e punições.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Shield className="size-3.5 text-emerald-400" />
              Criptografia de Ponta a Ponta
            </span>
            <span className="font-mono text-purple-300/60">SevenRP v2.0</span>
          </div>
        </div>

        {/* Coluna Direita: Formulário de Autenticação */}
        <div className="flex flex-col justify-center bg-[#0F141F]/80 p-8 lg:col-span-6 lg:p-10">
          <div className="mb-6">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Acessar Painel
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Informe suas credenciais de administrador para continuar.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-300">
              <span className="size-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5 shadow-[0_0_6px_#EF4444]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                E-mail Administrativo
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#060911]/70 px-3.5 py-2.5 pl-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  autoComplete="email"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#060911]/70 px-3.5 py-2.5 pl-10 text-xs text-white placeholder-slate-500 transition-colors focus:border-indigo-500 focus:outline-none"
                  autoComplete="current-password"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-150 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3.5 text-indigo-400" />
              Servidor Operacional
            </span>
            <span className="font-mono text-slate-400">Seven City Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
