import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, BookOpen, Check, FileText, Hash, Headphones, ImageUp,
  Lightbulb, Loader2, Pin, Plus, RefreshCw, Send, SlidersHorizontal,
  Sparkles, Trash2, X
} from "lucide-react";
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
const BANNER_LIMIT = 50;

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

type WelcomePayload = Parameters<typeof saveWelcomeConfig>[0] extends { data: infer D } ? D : never;

function getPurposeIcon(key: string) {
  switch (key) {
    case "regras": return BookOpen;
    case "boas_vindas": return Sparkles;
    case "avisos": return Bell;
    case "suporte": return Headphones;
    case "sugestoes": return Lightbulb;
    case "logs": return FileText;
    default: return Hash;
  }
}

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

  const [channelsModalOpen, setChannelsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const configuredChannelsCount = CHANNEL_PURPOSES.filter((p) => Boolean(settingFor(p.key)?.channel_id)).length;

  // Boas-vindas Form State
  const welcome = data?.welcome ?? null;
  const purposeWelcomeChannel = data?.channelSettings.find((s) => s.purpose === "boas_vindas")?.channel_id ?? "";
  const [welcomeForm, setWelcomeForm] = useState({
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

  useEffect(() => {
    if (!welcome) return;
    setWelcomeForm({
      enabled: welcome.enabled,
      channelId: welcome.channel_id ?? purposeWelcomeChannel,
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
  }, [welcome, purposeWelcomeChannel]);

  const welcomePayload = (): WelcomePayload => ({
    enabled: welcomeForm.enabled,
    channelId: welcomeForm.channelId || null,
    message: welcomeForm.message,
    mentionUser: welcomeForm.mentionUser,
    autoRoleId: welcomeForm.autoRoleId || null,
    bannerTitle: welcomeForm.bannerTitle,
    bannerSubtitle: welcomeForm.bannerSubtitle,
    bannerUrl: welcomeForm.bannerUrl || null,
    bannerPath: welcomeForm.bannerPath || null,
    accentColor: welcomeForm.accentColor,
    showAvatar: welcomeForm.showAvatar,
    showMemberNumber: welcomeForm.showMemberNumber,
  });

  const insertVariable = (variable: string) => {
    setWelcomeForm((prev) => ({
      ...prev,
      message: prev.message + " " + variable,
    }));
  };

  const channelMutation = useMutation({
    mutationFn: (input: { purpose: string; channelId: string }) => runSaveChannel({ data: input }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      if (result.missing.length) toast.warning(`Canal salvo, mas faltam permissões: ${result.missing.join(", ")}`);
      else toast.success(`Canal #${result.channelName} configurado com sucesso.`);
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
      toast.success("Template salvo com sucesso.");
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar o template."),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => runPublish({ data: { templateId: id } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Template publicado com sucesso no Discord (ID: ${result.messageId.slice(0, 8)}...).`);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao publicar template."),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => runUnpublish({ data: { templateId: id } }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Mensagem do template removida no Discord.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao despublicar."),
  });

  const saveWelcomeMutation = useMutation({
    mutationFn: (payload: WelcomePayload) => runSaveWelcome({ data: payload }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Configuração de boas-vindas salva com sucesso.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar boas-vindas."),
  });

  const testWelcomeMutation = useMutation({
    mutationFn: (payload: WelcomePayload) => runWelcomeTest({ data: payload }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success("Mensagem de boas-vindas enviada no canal com banner da galeria!");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao disparar teste."),
  });

  const banners = data?.welcomeBanners ?? [];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Executivo da Página */}
      <PageHeader
        eyebrow="SISTEMA • SERVIDOR DISCORD"
        title="Inicialização & Boas-Vindas"
        description="Configure o fluxo de recepção de novos membros, galeria de banners rotativos e mensagens institucionais."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChannelsModalOpen(true)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="size-3 text-purple-400" />
              <span>Canais Funcionais</span>
              <span className="ml-0.5 rounded bg-purple-500/15 px-1.5 py-0.2 text-[10px] font-mono text-purple-300">
                {configuredChannelsCount}/{CHANNEL_PURPOSES.length}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={autoSync.isFetching}
              onClick={() => void autoSync.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3 ${autoSync.isFetching ? "animate-spin text-purple-400" : ""}`} />
              <span>Sincronizar</span>
            </Button>
          </>
        }
      />

      {/* Alerta se Servidor Não Conectado */}
      {!connectedGuild ? (
        <Panel
          title="Servidor Discord Não Vinculado"
          description="Conecte o bot ao servidor principal para habilitar mapeamento e automações"
        >
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-300">
            Nenhum servidor Discord configurado. Conclua a autorização do bot nas configurações gerais antes de iniciar o mapeamento.
          </div>
        </Panel>
      ) : (
        /* Layout Profissional em 2 Colunas Equilibradas (7 cols Esquerda / 5 cols Direita) */
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          
          {/* COLUNA ESQUERDA (7 Colunas): Formulário de Boas-Vindas & Templates Oficiais */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Card 1: Configuração de Boas-Vindas */}
            <Panel
              title="Automação de Boas-Vindas"
              description="Envio automático de mensagem e imagem alternada da galeria para novos membros"
              action={
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className={`text-xs font-medium ${welcomeForm.enabled ? "text-emerald-400" : "text-zinc-400"}`}>
                    {welcomeForm.enabled ? "Envio Ativo" : "Desativado"}
                  </span>
                  <div
                    role="switch"
                    aria-checked={welcomeForm.enabled}
                    onClick={() => setWelcomeForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${welcomeForm.enabled ? "bg-purple-600" : "bg-zinc-700"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${welcomeForm.enabled ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </div>
                </label>
              }
            >
              <div className="space-y-4">
                {/* Linha 1: Canal de Chegada & Cargo Inicial */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Canal de Chegada</label>
                      <button
                        type="button"
                        onClick={() => setChannelsModalOpen(true)}
                        className="text-[10px] text-purple-400 hover:underline"
                      >
                        Mapear Canais
                      </button>
                    </div>
                    <select
                      className={field}
                      value={welcomeForm.channelId}
                      onChange={(e) => setWelcomeForm({ ...welcomeForm, channelId: e.target.value })}
                    >
                      <option value="">Selecione o canal...</option>
                      {channels.map((channel) => (
                        <option key={channel.channel_id} value={channel.channel_id}>
                          #{channel.name} ({channelKind(channel.type)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label mb-1">Cargo Inicial (Auto-Role)</label>
                    <select
                      className={field}
                      value={welcomeForm.autoRoleId}
                      onChange={(e) => setWelcomeForm({ ...welcomeForm, autoRoleId: e.target.value })}
                    >
                      <option value="">Sem cargo automático</option>
                      {(data?.roles ?? []).map((role) => (
                        <option key={role.role_id} value={role.role_id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Linha 2: Mensagem de Recepção */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="label mb-0">Mensagem de Recepção no Canal</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">Variáveis:</span>
                      {["{user}", "{username}", "{server}"].map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => insertVariable(token)}
                          className="rounded border border-purple-500/25 bg-purple-950/30 px-2 py-0.5 text-[10px] font-mono text-purple-300 transition-colors hover:bg-purple-900/40"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    className="min-h-24 w-full rounded-md border border-white/[0.08] bg-[#0A0C10] p-3 text-xs text-zinc-200 outline-none focus:border-purple-500/70 leading-relaxed transition-colors"
                    value={welcomeForm.message}
                    onChange={(e) => setWelcomeForm({ ...welcomeForm, message: e.target.value })}
                    placeholder="Digite a mensagem de boas-vindas..."
                  />

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={welcomeForm.mentionUser}
                      onChange={(e) => setWelcomeForm({ ...welcomeForm, mentionUser: e.target.checked })}
                      className="size-3.5 rounded accent-purple-600 cursor-pointer"
                    />
                    <span>Mencionar o usuário (@) no canal para gerar notificação direta</span>
                  </label>
                </div>

                {/* Linha 3: Rodapé de Ações */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.05]">
                  <span className="text-[11px] text-zinc-500">
                    {welcomeForm.channelId ? "Canal vinculado e pronto para recepção." : "Selecione o canal de chegada acima antes de salvar."}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={testWelcomeMutation.isPending}
                      onClick={() => testWelcomeMutation.mutate(welcomePayload())}
                      className="gap-1.5"
                    >
                      {testWelcomeMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-purple-400" />}
                      <span>Enviar Teste Real</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={saveWelcomeMutation.isPending}
                      onClick={() => saveWelcomeMutation.mutate(welcomePayload())}
                      className="gap-1.5"
                    >
                      {saveWelcomeMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      <span>Salvar Configurações</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Card 2: Templates Oficiais do Servidor */}
            <Panel
              title="Templates Oficiais do Servidor"
              description="Mensagens institucionais formatadas para canais estáticos (republicação sem duplicidade)"
            >
              <div className="grid gap-3 sm:grid-cols-2">
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
                                if (window.confirm(`Remover a mensagem de "${item.name}" no Discord?`)) {
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

          {/* COLUNA DIREITA (5 Colunas): Galeria de Banners & Histórico de Chegadas */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Card 1: Galeria de Banners Rotativos (Grid 2 Colunas Perfeito) */}
            <BannersPanel
              banners={banners}
              onRefresh={invalidate}
            />

            {/* Card 2: Histórico Recente de Entregas */}
            <Panel
              title="Histórico de Boas-Vindas"
              description="Últimos membros recebidos no servidor"
            >
              {(data?.welcomeEvents ?? []).length === 0 ? (
                <EmptyState
                  title="Sem histórico recente"
                  description="Nenhuma entrada de membro registrada até o momento."
                />
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {(data?.welcomeEvents ?? []).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-medium text-zinc-200 truncate">{event.username}</span>
                      <span className="text-zinc-500 font-mono text-[11px]">{formatDate(event.created_at)}</span>
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

      {/* MODAL DE CANAIS FUNCIONAIS (100% Responsivo, Limpo e Moderno) */}
      {channelsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-xl flex flex-col rounded-xl border border-white/[0.10] bg-[#10131B] shadow-2xl overflow-hidden animate-fade-up">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-md border border-purple-500/30 bg-purple-950/30 text-purple-300">
                  <SlidersHorizontal className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Canais Funcionais do Discord</h3>
                  <p className="text-[11px] text-zinc-400">Vincule os canais reais do servidor para cada rotina do bot.</p>
                </div>
              </div>
              <button
                onClick={() => setChannelsModalOpen(false)}
                className="flex size-7 items-center justify-center rounded border border-white/[0.06] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="flex-1 overflow-y-auto p-5 divide-y divide-white/[0.04]">
              {CHANNEL_PURPOSES.map((purpose) => {
                const current = settingFor(purpose.key);
                const Icon = getPurposeIcon(purpose.key);
                const isConfigured = Boolean(current?.channel_id);

                return (
                  <div
                    key={purpose.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border ${isConfigured ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-white/[0.06] bg-white/[0.02] text-zinc-500"}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-zinc-100">{purpose.label}</p>
                          {isConfigured && (
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400">{purpose.hint}</p>
                      </div>
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

            {/* Footer Modal */}
            <div className="flex items-center justify-between border-t border-white/[0.07] bg-[#0E1118] px-5 py-3">
              <span className="text-xs text-zinc-400">
                {configuredChannelsCount} de {CHANNEL_PURPOSES.length} canais ativos
              </span>
              <Button size="sm" variant="primary" onClick={() => setChannelsModalOpen(false)}>
                Concluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Template */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/[0.10] bg-[#11141D] p-5 shadow-2xl animate-fade-up">
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

function BannersPanel({
  banners,
  onRefresh,
}: {
  banners: Array<{ id: string; path: string; created_at: string }>;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const registerBanners = useServerFn(addWelcomeBanners);
  const deleteBanner = useServerFn(removeWelcomeBanner);

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
        onRefresh();
      } else {
        toast.error(result.message);
      }
    }
    if (rejected > 0) toast.error(`${rejected} arquivo(s) ignorado(s): use imagens horizontais de até 8 MB.`);
    if (files.length > remaining) toast.error(`Só cabiam ${remaining} banner(s) — o limite é ${BANNER_LIMIT}.`);
    setUploading(false);
  }

  return (
    <Panel
      title="Banners Rotativos"
      description="O bot alterna automaticamente entre estas artes a cada novo membro"
      action={
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {banners.length}/{BANNER_LIMIT} artes
          </span>
          <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.05] px-2.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]">
            {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImageUp className="size-3 text-purple-400" />}
            <span>{uploading ? "..." : "Adicionar"}</span>
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
      }
    >
      {banners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] p-6 text-center text-xs text-zinc-500">
          Nenhum banner cadastrado. Adicione artes horizontais para ativar a alternância visual automática.
        </div>
      ) : (
        /* Grid 2 colunas proporcional e harmonioso */
        <div className="grid grid-cols-2 gap-2.5">
          {banners.map((banner) => (
            <BannerThumb
              key={banner.id}
              path={banner.path}
              onRemove={async () => {
                const result = await deleteBanner({ data: { id: banner.id } });
                if (result.ok) {
                  toast.success("Banner removido.");
                  onRefresh();
                } else {
                  toast.error(result.message);
                }
              }}
            />
          ))}
          {banners.length % 2 !== 0 && (
            <label className="flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/[0.12] bg-white/[0.02] p-2 text-center transition-colors hover:border-purple-500/40 hover:bg-purple-950/10">
              <ImageUp className="size-4 text-purple-400 mb-1" />
              <span className="text-[11px] font-medium text-zinc-300">Nova Arte</span>
              <span className="text-[9px] text-zinc-500">1200x400</span>
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
          )}
        </div>
      )}
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
    <div className="group relative overflow-hidden rounded-md border border-white/[0.08] bg-[#0A0C10] shadow-sm">
      {preview.data?.url ? (
        <img src={preview.data.url} alt="Banner de boas-vindas" className="aspect-[16/9] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-[#07090E]">
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
        className="absolute right-1 top-1 rounded border border-white/[0.10] bg-black/80 p-1 text-zinc-400 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100 cursor-pointer"
      >
        {removing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}
