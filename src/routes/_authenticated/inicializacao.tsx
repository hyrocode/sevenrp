import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageUp, Loader2, Pin, RefreshCw, Send, Trash2, Sparkles, Check, Hash, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge } from "@/components/dashboard-ui";
import { EmptyState, formatDate } from "@/components/record-table";
import { CHANNEL_PURPOSES } from "@/lib/purposes";
import { supabase } from "@/integrations/supabase/client";
import { getSignedAssetUrl } from "@/lib/storage.functions";
import {
  addWelcomeBanners,
  getServerSetup,
  removeWelcomeBanner,
  publishTemplate,
  refreshChannels,
  saveChannelSetting,
  saveTemplate,
  saveWelcomeConfig,
  sendWelcomeTest,
  unpublishTemplate,
} from "@/lib/setup.functions";

export const Route = createFileRoute("/_authenticated/inicializacao")({
  head: () => ({
    meta: [
      { title: "Inicialização — SEVEN CITY" },
      { name: "description", content: "Mapeie canais reais, publique templates institucionais e configure as boas-vindas do SEVEN CITY." },
      { property: "og:title", content: "Inicialização — SEVEN CITY" },
      { property: "og:description", content: "Canais, templates oficiais e boas-vindas com banner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

const TEXT_CHANNEL_TYPES = [0, 5, 15, 16];
const channelKind = (type: number) => (type === 15 || type === 16 ? "fórum" : type === 5 ? "anúncios" : "texto");
const field = "h-8.5 w-full rounded-md border border-white/[0.08] bg-[#0A0C10] px-3 text-xs text-zinc-200 outline-none focus:border-purple-500/70 transition-colors";

type Template = {
  id: string;
  key: string;
  name: string;
  purpose: string;
  title: string;
  description: string;
  color: string;
  footer: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  pin_message: boolean;
  enabled: boolean;
  message_id: string | null;
  pinned: boolean;
  published_at: string | null;
  last_error: string | null;
};

function SetupPage() {
  const queryClient = useQueryClient();
  const fetchSetup = useServerFn(getServerSetup);
  const runSaveChannel = useServerFn(saveChannelSetting);
  const runSaveTemplate = useServerFn(saveTemplate);
  const runPublish = useServerFn(publishTemplate);
  const runUnpublish = useServerFn(unpublishTemplate);
  const runSaveWelcome = useServerFn(saveWelcomeConfig);
  const runWelcomeTest = useServerFn(sendWelcomeTest);
  const runRefresh = useServerFn(refreshChannels);

  const setup = useQuery({
    queryKey: ["setup"],
    queryFn: () => fetchSetup(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["setup"] });

  const data = setup.data;
  const connectedGuild = Boolean(data?.guild?.guildId);

  const autoSync = useQuery({
    queryKey: ["setup", "auto-sync"],
    queryFn: async () => {
      const result = await runRefresh();
      if (result.ok) invalidate();
      return result;
    },
    enabled: connectedGuild,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 30_000,
  });

  const channels = useMemo(() => (data?.channels ?? []).filter((c) => TEXT_CHANNEL_TYPES.includes(c.type)), [data]);
  const settingFor = (purpose: string) => data?.channelSettings.find((s) => s.purpose === purpose) ?? null;

  const [editing, setEditing] = useState<Template | null>(null);

  const channelMutation = useMutation({
    mutationFn: (input: { purpose: string; channelId: string }) => runSaveChannel({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      if (result.missing.length) toast.warning(`Canal salvo, mas faltam permissões: ${result.missing.join(", ")}`);
      else toast.success(`Canal #${result.channelName} configurado.`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar o canal."),
  });

  const templateMutation = useMutation({
    mutationFn: (input: Template) =>
      runSaveTemplate({
        data: {
          id: input.id,
          name: input.name,
          title: input.title,
          description: input.description,
          color: input.color,
          footer: input.footer,
          imageUrl: input.image_url,
          thumbnailUrl: input.thumbnail_url,
          pinMessage: input.pin_message,
          enabled: input.enabled,
          purpose: input.purpose,
        },
      }),
    onSuccess: () => {
      toast.success("Template salvo.");
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar o template."),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => runPublish({ data: { id } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.mode === "created" ? "Template publicado no Discord." : "Mensagem existente atualizada no Discord.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao publicar."),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => runUnpublish({ data: { id } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Mensagem removida do Discord.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao remover."),
  });

  const welcomeTest = useMutation({
    mutationFn: () => runWelcomeTest(),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Boas-vindas enviada para #${result.channelName}!`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha no teste."),
  });

  const connected = connectedGuild;
  const syncing = autoSync.isFetching;

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        eyebrow="INICIALIZAÇÃO DO SERVIDOR"
        title="Canais & Boas-Vindas"
        description="Mapeamento de canais funcionais, automação de boas-vindas com rotação de banners e templates institucionais."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={syncing}
            onClick={() => {
              void autoSync.refetch().then(() => void setup.refetch());
            }}
            className="gap-1.5"
          >
            {syncing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            <span>{syncing ? "Sincronizando..." : "Sincronizar Canais"}</span>
          </Button>
        }
      />

      {!connected ? (
        <EmptyState
          title="Servidor Discord Não Conectado"
          description="Acesse as Configurações para validar o token do bot e sincronizar canais, cargos e membros reais."
          action={
            <Button size="sm" variant="primary" onClick={() => (window.location.href = "/configuracoes")}>
              Ir para Configurações
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          {/* Painel de Canais Funcionais */}
          <Panel
            title="Canais Funcionais"
            description="Mapeie a finalidade de cada canal do Discord para o funcionamento do bot"
          >
            <div className="divide-y divide-white/[0.04]">
              {CHANNEL_PURPOSES.map((purpose) => {
                const current = settingFor(purpose.key);
                return (
                  <div key={purpose.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 first:pt-1 last:pb-1">
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-medium text-zinc-200">{purpose.label}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{purpose.hint}</p>
                    </div>
                    <select
                      className="h-8.5 w-full sm:w-60 shrink-0 rounded-md border border-white/[0.08] bg-[#0A0C10] px-2.5 text-xs text-zinc-200 outline-none focus:border-purple-500/70"
                      value={current?.channel_id ?? ""}
                      disabled={channelMutation.isPending}
                      onChange={(event) => {
                        const channelId = event.target.value;
                        if (channelId) channelMutation.mutate({ purpose: purpose.key, channelId });
                      }}
                    >
                      <option value="">Não configurado</option>
                      {channels.map((channel) => (
                        <option key={channel.channel_id} value={channel.channel_id}>
                          #{channel.name} ({channelKind(channel.type)})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Painel de Boas-Vindas */}
          <WelcomePanel
            data={data}
            channels={channels}
            onSave={(payload) =>
              runSaveWelcome({ data: payload })
                .then(() => {
                  toast.success("Configuração de boas-vindas salva com sucesso.");
                  invalidate();
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Falha ao salvar."))
            }
            onTest={(payload) => {
              void runSaveWelcome({ data: payload })
                .then(() => {
                  invalidate();
                  welcomeTest.mutate();
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Falha ao salvar."));
            }}
            testing={welcomeTest.isPending}
          />

          {/* Templates Institucionais */}
          <div className="xl:col-span-2">
            <Panel
              title="Templates Oficiais do Servidor"
              description="Mensagens institucionais fixadas e formatadas (republicação idempotente sem duplicidade)"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {(data?.templates ?? []).map((template) => {
                  const item = template as unknown as Template;
                  return (
                    <div key={item.id} className="rounded-lg border border-white/[0.07] bg-[#0E1118] p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{item.name}</p>
                          <StatusBadge tone={item.message_id ? "success" : "muted"}>
                            {item.message_id ? "Publicado" : "Rascunho"}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-400 font-medium truncate">{item.title}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500">{item.description || "Sem conteúdo configurado."}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                          {item.pinned && <span className="inline-flex items-center gap-1"><Pin className="size-2.5" />Fixado</span>}
                          {item.published_at && <span>{formatDate(item.published_at)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant={item.message_id ? "secondary" : "primary"}
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(item.id)}
                            className="gap-1"
                          >
                            {publishMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                            <span>{item.message_id ? "Atualizar" : "Publicar"}</span>
                          </Button>
                          {item.message_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-zinc-500 hover:text-rose-300"
                              onClick={() => {
                                if (window.confirm(`Remover a mensagem publicada de "${item.name}" no Discord?`)) {
                                  unpublishMutation.mutate(item.id);
                                }
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* Histórico de Entregas */}
          <div className="xl:col-span-2">
            <Panel
              title="Histórico de Boas-Vindas Enviadas"
              description="Registro recente de novos membros recebidos no servidor"
            >
              {(data?.welcomeEvents ?? []).length === 0 ? (
                <EmptyState
                  title="Sem histórico recente"
                  description="Nenhuma entrada de membro registrada nas últimas horas."
                />
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {(data?.welcomeEvents ?? []).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <span className="font-medium text-zinc-200 truncate">{event.username}</span>
                      <span className="text-zinc-500 font-mono">{formatDate(event.created_at)}</span>
                      <StatusBadge tone={event.status === "error" ? "danger" : "success"}>
                        {event.status === "delivered" ? "Entregue" : event.status}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* Modal de Edição de Template */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.10] bg-[#11141D] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <p className="text-sm font-semibold text-zinc-100">Editar Template Institucional</p>
              <button onClick={() => setEditing(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Fechar</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Nome Interno</label>
                <input className={field} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Regras da Comunidade" />
              </div>
              <div>
                <label className="label">Título do Embed</label>
                <input className={field} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex: Regras Oficiais Seven City" />
              </div>
              <div>
                <label className="label">Conteúdo (Markdown Discord)</label>
                <textarea
                  className="min-h-36 w-full rounded-md border border-white/[0.08] bg-[#0A0C10] p-3 text-xs text-zinc-200 outline-none focus:border-purple-500/70"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Digite o texto formatado do embed..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Cor Hex</label>
                  <input className={field} value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} placeholder="#7C3AED" />
                </div>
                <div>
                  <label className="label">Texto de Rodapé</label>
                  <input className={field} value={editing.footer ?? ""} onChange={(e) => setEditing({ ...editing, footer: e.target.value })} placeholder="Ex: Seven City RP" />
                </div>
                <div>
                  <label className="label">URL da Imagem</label>
                  <input className={field} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value || null })} placeholder="https://..." />
                </div>
                <div>
                  <label className="label">URL do Thumbnail</label>
                  <input className={field} value={editing.thumbnail_url ?? ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value || null })} placeholder="https://..." />
                </div>
              </div>
              <label className="flex items-center gap-2 pt-2 text-xs text-zinc-300 cursor-pointer">
                <input type="checkbox" checked={editing.pin_message} onChange={(e) => setEditing({ ...editing, pin_message: e.target.checked })} className="rounded accent-purple-600" />
                <span>Fixar mensagem no canal automaticamente após publicação</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" variant="primary" disabled={templateMutation.isPending} onClick={() => templateMutation.mutate(editing)}>
                {templateMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                <span>Salvar Alterações</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BANNER_LIMIT = 50;

type WelcomePayload = Parameters<typeof saveWelcomeConfig>[0] extends { data: infer D } ? D : never;

function WelcomePanel({
  data,
  channels,
  onSave,
  onTest,
  testing,
}: {
  data: Awaited<ReturnType<typeof getServerSetup>> | undefined;
  channels: Array<{ channel_id: string; name: string }>;
  onSave: (payload: WelcomePayload) => void;
  onTest: (payload: WelcomePayload) => void;
  testing: boolean;
}) {
  const welcome = data?.welcome ?? null;
  const purposeChannel = data?.channelSettings.find((s) => s.purpose === "boas_vindas")?.channel_id ?? "";
  const banners = data?.welcomeBanners ?? [];
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    enabled: false,
    channelId: "",
    message: "Bem-vindo(a) ao Seven City, {user}!",
    mentionUser: true,
    autoRoleId: "",
    bannerTitle: "BEM-VINDO",
    bannerSubtitle: "SEVEN CITY",
    bannerUrl: "",
    bannerPath: "",
    accentColor: "#7C3AED",
    showAvatar: true,
    showMemberNumber: true,
  });
  const [uploading, setUploading] = useState(false);

  const registerBanners = useServerFn(addWelcomeBanners);
  const deleteBanner = useServerFn(removeWelcomeBanner);
  const refreshBanners = () => void queryClient.invalidateQueries({ queryKey: ["setup"] });

  async function isHorizontal(file: File) {
    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
    return !dimensions || dimensions.width > dimensions.height;
  }

  async function uploadBanners(files: File[]) {
    const remaining = BANNER_LIMIT - banners.length;
    if (remaining <= 0) {
      toast.error(`Limite de ${BANNER_LIMIT} banners atingido.`);
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    let rejected = 0;
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024 || !(await isHorizontal(file))) {
        rejected += 1;
        continue;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `welcome/banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { contentType: file.type });
      if (error) {
        rejected += 1;
        continue;
      }
      uploaded.push(path);
    }

    if (uploaded.length > 0) {
      const result = await registerBanners({ data: { paths: uploaded } });
      if (result.ok) {
        toast.success(`${result.added} banner(s) adicionados à rotação.`);
        refreshBanners();
      } else {
        toast.error(result.message);
      }
    }
    if (rejected > 0) toast.error(`${rejected} arquivo(s) ignorado(s): use imagens horizontais de até 8 MB.`);
    if (files.length > remaining) toast.error(`Só cabiam ${remaining} banner(s) — o limite é ${BANNER_LIMIT}.`);
    setUploading(false);
  }

  useEffect(() => {
    if (!welcome) return;
    setForm({
      enabled: welcome.enabled,
      channelId: welcome.channel_id ?? purposeChannel,
      message: welcome.message,
      mentionUser: welcome.mention_user,
      autoRoleId: welcome.auto_role_id ?? "",
      bannerTitle: welcome.banner_title ?? "BEM-VINDO",
      bannerSubtitle: welcome.banner_subtitle ?? "SEVEN CITY",
      bannerUrl: welcome.banner_url ?? "",
      bannerPath: welcome.banner_path ?? "",
      accentColor: welcome.accent_color ?? "#7C3AED",
      showAvatar: welcome.show_avatar ?? true,
      showMemberNumber: welcome.show_member_number ?? true,
    });
  }, [welcome, purposeChannel]);

  const payload = (): WelcomePayload => ({
    enabled: form.enabled,
    channelId: form.channelId || null,
    message: form.message,
    mentionUser: form.mentionUser,
    autoRoleId: form.autoRoleId || null,
    bannerTitle: form.bannerTitle,
    bannerSubtitle: form.bannerSubtitle,
    bannerUrl: form.bannerUrl || null,
    bannerPath: form.bannerPath || null,
    accentColor: form.accentColor,
    showAvatar: form.showAvatar,
    showMemberNumber: form.showMemberNumber,
  });

  const insertVariable = (variable: string) => {
    setForm((prev) => ({
      ...prev,
      message: prev.message + " " + variable,
    }));
  };

  return (
    <Panel
      title="Boas-Vindas Automáticas"
      description="Mensagem e banner rotativo enviados a cada novo membro que entrar no servidor"
    >
      <div className="space-y-4">
        {/* Toggle Ativação */}
        <label className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-[#0A0C10] p-3 cursor-pointer">
          <div>
            <p className="text-xs font-semibold text-zinc-200">Ativar Boas-Vindas Automáticas</p>
            <p className="text-[11px] text-zinc-500">Dispara mensagem com imagem alternada ao entrar novo membro</p>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="size-4 rounded accent-purple-600 cursor-pointer"
          />
        </label>

        {/* Seleção de Canal e Cargo */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Canal de Chegada</label>
            <select className={field} value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
              <option value="">Selecione o canal...</option>
              {channels.map((channel) => (
                <option key={channel.channel_id} value={channel.channel_id}>#{channel.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cargo Inicial (Auto-Role)</label>
            <select className={field} value={form.autoRoleId} onChange={(e) => setForm({ ...form, autoRoleId: e.target.value })}>
              <option value="">Sem cargo automático</option>
              {(data?.roles ?? []).map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mensagem com Variáveis */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">Mensagem de Boas-Vindas</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500">Variáveis:</span>
              {["{user}", "{username}", "{server}"].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertVariable(token)}
                  className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-purple-300 hover:bg-white/[0.08]"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="min-h-24 w-full rounded-md border border-white/[0.08] bg-[#0A0C10] p-3 text-xs text-zinc-200 outline-none focus:border-purple-500/70"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Digite a mensagem..."
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.mentionUser}
            onChange={(e) => setForm({ ...form, mentionUser: e.target.checked })}
            className="size-3.5 rounded accent-purple-600"
          />
          <span>Mencionar (@) o membro no canal para notificação imediata</span>
        </label>

        {/* Galeria de Banners */}
        <div className="rounded-lg border border-white/[0.07] bg-[#0A0C10] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.05]">
            <div>
              <p className="text-xs font-semibold text-zinc-200">Galeria de Banners Rotativos</p>
              <p className="text-[11px] text-zinc-500">
                {banners.length} de {BANNER_LIMIT} banners cadastrados (recomendado 1200x400)
              </p>
            </div>
            <label className="inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.05] px-2.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]">
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImageUp className="size-3" />}
              <span>{uploading ? "Enviando..." : "Enviar Banners"}</span>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) void uploadBanners(files);
                }}
              />
            </label>
          </div>

          {banners.length === 0 ? (
            <p className="mt-3 rounded border border-dashed border-white/[0.08] p-4 text-center text-xs text-zinc-500">
              Nenhum banner enviado. O sistema pode alternar automaticamente entre até {BANNER_LIMIT} imagens.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {banners.map((banner) => (
                <BannerThumb
                  key={banner.id}
                  path={banner.path}
                  onRemove={async () => {
                    const result = await deleteBanner({ data: { id: banner.id } });
                    if (result.ok) {
                      toast.success("Banner removido.");
                      refreshBanners();
                    } else {
                      toast.error(result.message);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onSave(payload())}
          >
            Salvar Boas-Vindas
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={testing}
            onClick={() => onTest(payload())}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-purple-400" />}
            <span>Enviar Teste Real</span>
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function BannerThumb({ path, onRemove }: { path: string; onRemove: () => Promise<void> }) {
  const signAsset = useServerFn(getSignedAssetUrl);
  const [removing, setRemoving] = useState(false);
  const preview = useQuery({
    queryKey: ["welcome-banner", path],
    queryFn: () => signAsset({ data: { path } }),
    staleTime: 30 * 60_000,
  });

  return (
    <div className="group relative overflow-hidden rounded-md border border-white/[0.08] bg-[#0A0C10]">
      {preview.data?.url ? (
        <img src={preview.data.url} alt="Banner de boas-vindas" className="aspect-[3/1] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center">
          <Loader2 className="size-3.5 animate-spin text-zinc-500" />
        </div>
      )}
      <button
        type="button"
        aria-label="Remover banner"
        disabled={removing}
        onClick={() => {
          setRemoving(true);
          void onRemove().finally(() => setRemoving(false));
        }}
        className="absolute right-1.5 top-1.5 rounded border border-white/[0.10] bg-black/80 p-1 text-zinc-400 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
      >
        {removing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}
