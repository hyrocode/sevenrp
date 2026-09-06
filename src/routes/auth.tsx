import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso administrativo — SEVEN ROLEPLAY" },
      { name: "description", content: "Entre com sua conta da equipe para acessar o painel administrativo do SEVEN ROLEPLAY." },
      { property: "og:title", content: "Acesso administrativo — SEVEN ROLEPLAY" },
      { property: "og:description", content: "Área restrita da equipe administrativa do SEVEN ROLEPLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se a confirmação estiver ativa.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no login com Google.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-card/80 p-6 shadow-lg backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground shadow-primary">7</div>
          <div>
            <h1 className="font-semibold">SEVEN ROLEPLAY</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito da equipe</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Nome de exibição</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary" placeholder="Como a equipe te chama" />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary" placeholder="voce@seven.rp" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Senha</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary" placeholder="••••••••" />
          </label>
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Entrar no painel" : "Criar conta da equipe"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" className="w-full" onClick={handleGoogle}>Continuar com Google</Button>

        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-5 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
          {mode === "signin" ? "Não tem acesso? Criar conta da equipe" : "Já tem conta? Entrar"}
        </button>

        <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          O primeiro acesso recebe o papel de proprietário. Os demais entram como visualizador até que um administrador eleve o papel.
        </p>
      </div>
    </div>
  );
}
