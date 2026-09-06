import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-card/80 p-6 shadow-lg backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground shadow-primary">7</div>
          <div>
            <h1 className="font-semibold text-foreground">SEVEN ROLEPLAY</h1>
            <p className="text-xs text-muted-foreground">Acesso restrito da equipe</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary text-foreground"
              placeholder="admin@gmail.com"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:border-primary text-foreground"
              placeholder="••••••••"
            />
          </label>
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Entrar no painel
          </Button>
        </form>

        <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          Acesso exclusivo para administradores e equipe autorizada do SEVEN ROLEPLAY.
        </p>
      </div>
    </div>
  );
}
