import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageUp, Loader2, Pin, RefreshCw, Send, Trash2, Sparkles } from "lucide-react";
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
      { title: "Inicialização — SEVEN ROLEPLAY" },
      { name: "description", content: "Mapeie canais reais, publique templates institucionais e configure as boas-vindas do SEVEN ROLEPLAY." },
      { property: "og:title", content: "Inicialização — SEVEN ROLEPLAY" },
      { property: "og:description", content: "Canais, templates oficiais e boas-vindas com banner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

const TEXT_CHANNEL_TYPES = [0, 5, 15, 16];
const channelKind = (type: number) => (type === 15 || type === 16 ? "fórum" : type === 5 ? "anúncios" : "texto");
const field = "h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:border-primary";

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

  // Canais criados agora no Discord aparecem aqui sozinhos: re-sincroniza a cada 45s
  // e sempre que a aba volta ao foco.
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
      toast.success(result.mode === "created" ? "Template publicado no Discord." : "Mensagem existente atualizada (sem duplicar).");
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
    mutationFn: () => runWelcomeTest({ data: {} }),
    onSuccess: (result) => {
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(result.banner ? "Boas-vindas enviada com banner." : "Boas-vindas enviada.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha no teste."),
  });

  const connected = connectedGuild;
  const syncing = autoSync.isFetching;

  return (
    <>
      <PageHeader
        eyebrow="Inicialização do servidor"
        title="Canais, templates e boas-vindas"
        description="Tudo aponta para IDs reais do Discord. A lista de canais é re-sincronizada automaticamente, então canais novos aparecem aqui sozinhos."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={syncing}
            onClick={() => {
              void autoSync.refetch().then(() => void setup.refetch());
            }}
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {syncing ? "Sincronizando" : "Sincronizar canais"}
          </Button>
        }
      />

      {!connected ? (
        <EmptyState
          title="Não conectado"
          description="Sincronize o servidor em Configurações para carregar canais, cargos e membros reais."
          action={<Button size="sm" variant="primary" onClick={() => (window.location.href = "/configuracoes")}>Ir para Configurações</Button>}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel title="Canais funcionais" description="Selecione o canal real para cada finalidade">
            <div className="space-y-3">
              {CHANNEL_PURPOSES.map((purpose) => {
                const current = settingFor(purpose.key);
                return (
                  <div key={purpose.key} className="grid gap-2 sm:grid-cols-[150px_1fr] sm:items-center">
                    <div>
                      <p className="text-sm font-medium">{purpose.label}</p>
                      <p className="text-[11px] text-muted-foreground">{purpose.hint}</p>
                    </div>
                    <select
                      className={field}
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
                          #{channel.name} · {channelKind(channel.type)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Panel>

          <WelcomePanel
            data={data}
            channels={channels}
            onSave={(payload) =>
              runSaveWelcome({ data: payload })
                .then(() => {
                  toast.success("Boas-vindas salvas.");
                  invalidate();
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Falha ao salvar."))
            }
            onTest={(payload) => {
              // Salva o que está na tela antes de testar: nunca mais "configuração necessária"
              // por causa de uma seleção ainda não salva.
              void runSaveWelcome({ data: payload })
                .then(() => {
                  invalidate();
                  welcomeTest.mutate();
                })
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Falha ao salvar."));
            }}
            testing={welcomeTest.isPending}
          />

          <div className="xl:col-span-2">
            <Panel title="Templates institucionais" description="Publicação idempotente: republicar atualiza a mesma mensagem">
              <div className="grid gap-3 md:grid-cols-2">
                {(data?.templates ?? []).map((template) => {
                  const item = template as unknown as Template;
                  return (
                    <div key={item.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                        </div>
                        <StatusBadge tone={item.message_id ? "success" : "muted"}>{item.message_id ? "Publicado" : "Não publicado"}</StatusBadge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.description || "Sem conteúdo definido."}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {item.published_at && <span>Publicado em {formatDate(item.published_at)}</span>}
                        {item.pinned && <span className="inline-flex items-center gap-1"><Pin className="size-3" />Fixado</span>}
                        {item.last_error && <span className="text-danger">{item.last_error}</span>}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>Editar</Button>
                        <Button size="sm" variant="primary" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(item.id)}>
                          {publishMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                          <Send className="size-3.5" />
                          {item.message_id ? "Atualizar" : "Publicar"}
                        </Button>
                        {item.message_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Remover a mensagem publicada de "${item.name}" no Discord?`)) unpublishMutation.mutate(item.id);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="xl:col-span-2">
            <Panel title="Boas-vindas enviadas" description="Histórico real de entregas">
              {(data?.welcomeEvents ?? []).length === 0 ? (
                <EmptyState title="Sem dados" description="Nenhuma boas-vindas registrada até agora." />
              ) : (
                <div className="space-y-2">
                  {(data?.welcomeEvents ?? []).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
                      <span className="truncate">{event.username}</span>
                      <span className="text-muted-foreground">{formatDate(event.created_at)}</span>
                      <StatusBadge tone={event.status === "error" ? "danger" : "success"}>{event.status}</StatusBadge>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-card p-6">
            <p className="text-sm font-semibold">Editar template</p>
            <div className="mt-4 space-y-3">
              <input className={field} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome" />
              <input className={field} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Título do embed" />
              <textarea
                className="min-h-40 w-full rounded-md border border-border bg-secondary p-3 text-sm outline-none focus:border-primary"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Conteúdo (markdown do Discord)"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={field} value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} placeholder="#7c5cff" />
                <input className={field} value={editing.footer ?? ""} onChange={(e) => setEditing({ ...editing, footer: e.target.value })} placeholder="Rodapé" />
                <input className={field} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value || null })} placeholder="URL da imagem" />
                <input className={field} value={editing.thumbnail_url ?? ""} onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value || null })} placeholder="URL da miniatura" />
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={editing.pin_message} onChange={(e) => setEditing({ ...editing, pin_message: e.target.checked })} />
                Fixar a mensagem após publicar
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button size="sm" variant="primary" disabled={templateMutation.isPending} onClick={() => templateMutation.mutate(editing)}>
                {templateMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
    message: "Bem-vindo, {user}! Leia as regras e aproveite o SEVEN ROLEPLAY.",
    mentionUser: true,
    autoRoleId: "",
    bannerTitle: "BEM-VINDO",
    bannerSubtitle: "SEVEN ROLEPLAY",
    bannerUrl: "",
    bannerPath: "",
    accentColor: "#7c5cff",
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
      toast.error(`Limite de ${BANNER_LIMIT} banners atingido. Remova algum antes de enviar novos.`);
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
        toast.success(`${result.added} banner(s) na rotação automática.`);
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
      bannerSubtitle: welcome.banner_subtitle ?? "SEVEN ROLEPLAY",
      bannerUrl: welcome.banner_url ?? "",
      bannerPath: welcome.banner_path ?? "",
      accentColor: welcome.accent_color ?? "#7c5cff",
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

  return (
    <Panel
      title="Boas-vindas"
      description="Mensagem + banner enviados automaticamente a cada novo membro (rotação entre os banners da galeria)"
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Ativar boas-vindas automáticas
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <select className={field} value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
            <option value="">Selecione o canal de boas-vindas</option>
            {channels.map((channel) => (
              <option key={channel.channel_id} value={channel.channel_id}>#{channel.name}</option>
            ))}
          </select>
          <select className={field} value={form.autoRoleId} onChange={(e) => setForm({ ...form, autoRoleId: e.target.value })}>
            <option value="">Sem auto-role</option>
            {(data?.roles ?? []).map((role) => (
              <option key={role.role_id} value={role.role_id}>{role.name}</option>
            ))}
          </select>
        </div>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-secondary p-3 text-sm outline-none focus:border-primary"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Use {user}, {username} e {server}"
        />
        <div className="rounded-md border border-border bg-secondary/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Galeria de banners horizontais</p>
              <p className="text-[11px] text-muted-foreground">
                {banners.length}/{BANNER_LIMIT} enviados · cada novo membro recebe um banner diferente (recomendado 1200x400).
              </p>
            </div>
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs font-medium transition-colors hover:bg-accent">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}
              {uploading ? "Enviando..." : "Enviar banners"}
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
            <p className="mt-3 rounded-md border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
              Sem banners. Envie até {BANNER_LIMIT} imagens horizontais — o sistema alterna sozinho a cada entrada.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={form.mentionUser} onChange={(e) => setForm({ ...form, mentionUser: e.target.checked })} />
          Mencionar o membro na mensagem
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => onSave(payload())}
          >
            Salvar boas-vindas
          </Button>
          <Button size="sm" variant="secondary" disabled={testing} onClick={() => onTest(payload())}>
            {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Enviar teste real
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Prévia de um banner do storage privado, com remoção. */
function BannerThumb({ path, onRemove }: { path: string; onRemove: () => Promise<void> }) {
  const signAsset = useServerFn(getSignedAssetUrl);
  const [removing, setRemoving] = useState(false);
  const preview = useQuery({
    queryKey: ["welcome-banner", path],
    queryFn: () => signAsset({ data: { path } }),
    staleTime: 30 * 60_000,
  });

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-background">
      {preview.data?.url ? (
        <img src={preview.data.url} alt="Banner de boas-vindas" className="aspect-[3/1] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
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
        className="absolute right-1.5 top-1.5 rounded-md border border-border bg-background/85 p-1.5 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
      >
        {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}

