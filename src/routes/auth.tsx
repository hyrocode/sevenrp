import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, CheckCircle2, Lock, LogIn, Mail, MessageSquare, Shield,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso Administrativo — SEVEN CITY" },
      { name: "description", content: "Entre com sua conta da equipe para acessar o painel administrativo do SEVEN CITY." },
      { property: "og:title", content: "Acesso Administrativo — SEVEN CITY" },
      { property: "og:description", content: "Área restrita da equipe administrativa do SEVEN CITY." },
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
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0C10] p-4 sm:p-6 lg:p-8">
      {/* Container Principal em 2 Colunas */}
      <div className="relative z-10 grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131B] lg:grid-cols-12 animate-fade-up">
        {/* Coluna Esquerda: Apresentação */}
        <div className="flex flex-col justify-between border-b border-white/[0.06] bg-[#0E1118] p-6 lg:col-span-6 lg:border-b-0 lg:border-r lg:p-8">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-950/40 text-xs font-semibold text-purple-300">
                7
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-100">Seven City</h1>
                <p className="text-[11px] text-zinc-500">Gestão & Operações Discord</p>
              </div>
            </div>

            {/* Lista de Recursos */}
            <div className="my-6 space-y-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#12151E] p-3">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-medium text-zinc-200">Worker Discord 24/7</h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Gateway contínuo para eventos, comandos e moderação.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#12151E] p-3">
                <MessageSquare className="size-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-medium text-zinc-200">Boas-Vindas Rotativas</h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Alternância automática de artes para cada novo membro.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-[#12151E] p-3">
                <ShieldCheck className="size-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-medium text-zinc-200">Auditoria Operacional</h4>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Registro centralizado de tickets, punições e configurações.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Informativo */}
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Shield className="size-3 text-emerald-400" />
              Acesso Seguro
            </span>
            <span className="font-mono text-zinc-500">SevenRP v2.0</span>
          </div>
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="flex flex-col justify-center p-6 lg:col-span-6 lg:p-8">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-zinc-100">
              Acessar o Painel
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Informe seu e-mail e senha de administrador.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <span className="size-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="input pl-9"
                  autoComplete="email"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
              </div>
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9"
                  autoComplete="current-password"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary mt-2 w-full h-9 text-xs"
            >
              {loading ? (
                <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn className="size-3.5" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Activity className="size-3 text-purple-400" />
              Gateway Discord
            </span>
            <span className="font-mono text-zinc-400">Operacional</span>
          </div>
        </div>
      </div>
    </div>
  );
}
