
-- =============================================================================
-- SEVEN ROLEPLAY - SCHEMA COMPLETO DO BANCO DE DADOS (SUPABASE POSTGRESQL)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ENUM DE CARGOS DO PAINEL
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'moderator', 'support', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. FUNÇÃO DE ATUALIZAÇÃO DE DATA (updated_at)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. TABELA DE PERFIS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. TABELA DE CARGOS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. FUNÇÕES DE VERIFICAÇÃO DE SEGURANÇA (RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_moderator(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin', 'moderator', 'support')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- POLÍTICAS DE PROFILES E USER_ROLES
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
  DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
  DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
END $$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "user_roles_all" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- TRIGGER PARA NOVO USUÁRIO DO AUTH CRIAR PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. CONFIGURAÇÃO DO SERVIDOR DISCORD
CREATE TABLE IF NOT EXISTS public.guild_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text UNIQUE,
  guild_name text,
  guild_icon text,
  application_id text,
  bot_username text,
  bot_avatar text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  is_active boolean NOT NULL DEFAULT true,
  token_configured boolean NOT NULL DEFAULT false,
  member_count integer DEFAULT 0,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guild_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guild_config_staff" ON public.guild_config FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 7. CANAIS DISCORD SINCRONIZADOS
CREATE TABLE IF NOT EXISTS public.discord_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL UNIQUE,
  guild_id text NOT NULL,
  name text NOT NULL,
  type integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  nsfw boolean NOT NULL DEFAULT false,
  parent_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discord_channels_staff" ON public.discord_channels FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 8. CARGOS DISCORD SINCRONIZADOS
CREATE TABLE IF NOT EXISTS public.discord_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id text NOT NULL UNIQUE,
  guild_id text NOT NULL,
  name text NOT NULL,
  color integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  permissions text,
  managed boolean NOT NULL DEFAULT false,
  member_count integer DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discord_roles_staff" ON public.discord_roles FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 9. MEMBROS DISCORD SINCRONIZADOS
CREATE TABLE IF NOT EXISTS public.discord_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL UNIQUE,
  guild_id text NOT NULL,
  username text NOT NULL,
  display_name text,
  avatar_url text,
  is_bot boolean NOT NULL DEFAULT false,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  joined_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discord_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discord_members_staff" ON public.discord_members FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 10. CANAIS FUNCIONAIS MAPEADOS
CREATE TABLE IF NOT EXISTS public.channel_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  purpose text NOT NULL,
  channel_id text,
  channel_name text,
  channel_type integer,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, purpose)
);
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_settings_staff" ON public.channel_settings FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 11. TEMPLATES INSTITUCIONAIS
CREATE TABLE IF NOT EXISTS public.server_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  purpose text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#7c5cff',
  image_url text,
  thumbnail_url text,
  footer text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  pin_message boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  channel_id text,
  message_id text,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.server_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_templates_staff" ON public.server_templates FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 12. CONFIGURAÇÃO DE BOAS-VINDAS
CREATE TABLE IF NOT EXISTS public.welcome_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  channel_id text,
  auto_role_id text,
  mention_user boolean NOT NULL DEFAULT true,
  message text NOT NULL DEFAULT 'Olá {user}! Seja muito bem-vindo ao {server}!',
  banner_title text NOT NULL DEFAULT 'BEM-VINDO',
  banner_subtitle text NOT NULL DEFAULT 'SEVEN ROLEPLAY',
  accent_color text NOT NULL DEFAULT '#7c5cff',
  show_avatar boolean NOT NULL DEFAULT true,
  show_member_number boolean NOT NULL DEFAULT true,
  banner_path text,
  banner_url text,
  dm_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.welcome_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "welcome_config_staff" ON public.welcome_config FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 13. BANNERS DE BOAS-VINDAS
CREATE TABLE IF NOT EXISTS public.welcome_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.welcome_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "welcome_banners_staff" ON public.welcome_banners FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 14. REGISTRO DE EVENTOS DE BOAS-VINDAS
CREATE TABLE IF NOT EXISTS public.welcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text,
  member_id text NOT NULL,
  username text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  message_id text,
  channel_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.welcome_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "welcome_events_staff" ON public.welcome_events FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 15. SISTEMA DE TICKETS
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('TKT-' || upper(substr(md5(random()::text), 1, 6))),
  title text NOT NULL,
  description text,
  requester text NOT NULL,
  requester_discord_id text,
  assignee_id uuid REFERENCES auth.users(id),
  category text NOT NULL DEFAULT 'geral',
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'open',
  channel_id text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_staff" ON public.tickets FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 16. MENSAGENS DE TICKETS
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id text,
  author_label text NOT NULL,
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket_messages_staff" ON public.ticket_messages FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 17. CASOS DE MODERAÇÃO
CREATE TABLE IF NOT EXISTS public.moderation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('MOD-' || upper(substr(md5(random()::text), 1, 6))),
  target_label text NOT NULL,
  target_discord_id text,
  moderator_id text,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'manual',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moderation_cases_staff" ON public.moderation_cases FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 18. PUNIÇÕES
CREATE TABLE IF NOT EXISTS public.punishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.moderation_cases(id) ON DELETE SET NULL,
  target_label text NOT NULL,
  target_discord_id text,
  applied_by text,
  kind text NOT NULL,
  reason text NOT NULL,
  duration_minutes integer,
  active boolean NOT NULL DEFAULT true,
  dispatch_status text NOT NULL DEFAULT 'completed',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "punishments_staff" ON public.punishments FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 19. TERMOS BLOQUEADOS (AUTOMOD)
CREATE TABLE IF NOT EXISTS public.blocked_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  match_mode text NOT NULL DEFAULT 'exact',
  severity text NOT NULL DEFAULT 'medium',
  action text NOT NULL DEFAULT 'warn',
  min_confidence numeric NOT NULL DEFAULT 0.8,
  hits integer NOT NULL DEFAULT 0,
  false_positives integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ignore_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_terms_staff" ON public.blocked_terms FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 20. REGRAS DE AUTOMAÇÃO
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_staff" ON public.automation_rules FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 21. REVISÃO DE NSFW
CREATE TABLE IF NOT EXISTS public.nsfw_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text,
  channel_name text,
  author_label text,
  author_discord_id text,
  message_id text,
  message_link text,
  content_type text NOT NULL DEFAULT 'image',
  confidence numeric NOT NULL DEFAULT 0.0,
  detector text NOT NULL DEFAULT 'worker',
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nsfw_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nsfw_reviews_staff" ON public.nsfw_reviews FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 22. EVENTOS DE RAID
CREATE TABLE IF NOT EXISTS public.raid_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  joins_detected integer,
  window_seconds integer,
  action_taken text,
  severity text NOT NULL DEFAULT 'high',
  status text NOT NULL DEFAULT 'active',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raid_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raid_events_staff" ON public.raid_events FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 23. SUGESTÕES DA COMUNIDADE
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  author_label text NOT NULL,
  author_discord_id text,
  forum_thread_id text,
  status text NOT NULL DEFAULT 'pending',
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestions_staff" ON public.suggestions FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 24. VOTOS EM SUGESTÕES
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  voter_user_id uuid REFERENCES auth.users(id),
  voter_discord_id text,
  value integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, voter_discord_id)
);
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestion_votes_staff" ON public.suggestion_votes FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 25. EMBEDS INSTITUCIONAIS
CREATE TABLE IF NOT EXISTS public.embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  title text,
  description text,
  color text NOT NULL DEFAULT '#7c5cff',
  footer text,
  image_url text,
  thumbnail_url text,
  target_channel_id text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_published_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.embeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "embeds_staff" ON public.embeds FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 26. TRANSAÇÕES DE ECONOMIA DO RP
CREATE TABLE IF NOT EXISTS public.economy_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('ECO-' || upper(substr(md5(random()::text), 1, 6))),
  member_label text NOT NULL,
  member_discord_id text,
  kind text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  risk text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'approved',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "economy_transactions_staff" ON public.economy_transactions FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 27. COMANDOS DO BOT (SLASH COMMANDS)
CREATE TABLE IF NOT EXISTS public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  enabled boolean NOT NULL DEFAULT true,
  registered boolean NOT NULL DEFAULT false,
  discord_command_id text,
  required_role public.app_role,
  uses integer NOT NULL DEFAULT 0,
  failures integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_commands_staff" ON public.bot_commands FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 28. LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text,
  actor_label text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  target_label text,
  status text NOT NULL DEFAULT 'ok',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_staff" ON public.audit_logs FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 29. HEARTBEATS DO WORKER 24/7
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  status text NOT NULL DEFAULT 'online',
  gateway_latency_ms integer,
  shard_count integer DEFAULT 1,
  version text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker_heartbeats_staff" ON public.worker_heartbeats FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- 30. FILA DE AÇÕES DO WORKER
CREATE TABLE IF NOT EXISTS public.worker_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  requested_by text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker_actions_staff" ON public.worker_actions FOR ALL TO authenticated USING (public.is_staff(auth.uid()));

-- PERMISSÕES TOTAIS PARA SERVICE_ROLE (BACKEND SERVERLESS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- STORAGE BUCKET PARA BANNERS E ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "brand_assets_public_select" ON storage.objects;
  DROP POLICY IF EXISTS "brand_assets_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "brand_assets_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "brand_assets_auth_delete" ON storage.objects;
END $$;

CREATE POLICY "brand_assets_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY "brand_assets_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets');
CREATE POLICY "brand_assets_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets');
CREATE POLICY "brand_assets_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets');

-- DADOS INICIAIS (SEEDS)
-- Atribuir perfil e cargo de Owner/Admin para admin@gmail.com
INSERT INTO public.profiles (id, display_name)
VALUES ('781cf89e-c0e8-4c26-9477-bc02d305297f', 'Administrador SEVEN')
ON CONFLICT (id) DO UPDATE SET display_name = 'Administrador SEVEN';

INSERT INTO public.user_roles (user_id, role)
VALUES ('781cf89e-c0e8-4c26-9477-bc02d305297f', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('781cf89e-c0e8-4c26-9477-bc02d305297f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Servidor Discord SEVEN STATE
INSERT INTO public.guild_config (
  guild_id, guild_name, bot_username, connection_status, is_active, token_configured
) VALUES (
  '1544533708848234496', 'SEVEN STATE', 'ꜱᴇᴠᴇɴᴄɪᴛʏ', 'connected', true, true
) ON CONFLICT (guild_id) DO UPDATE SET
  guild_name = 'SEVEN STATE',
  bot_username = 'ꜱᴇᴠᴇɴᴄɪᴛʏ',
  connection_status = 'connected',
  is_active = true,
  token_configured = true;

-- Boas-vindas
INSERT INTO public.welcome_config (
  enabled, mention_user, banner_title, banner_subtitle, accent_color, message
) VALUES (
  true, true, 'BEM-VINDO', 'SEVEN ROLEPLAY', '#7c5cff', 'Olá, {user}! Seja muito bem-vindo ao {server}! 💜'
) ON CONFLICT (id) DO NOTHING;

-- Templates Oficiais
INSERT INTO public.server_templates (key, name, purpose, title, description, color, pin_message, enabled) VALUES
('regras', 'Regras Oficiais', 'regras', '📜 REGRAS | SEVEN ROLEPLAY', 'Mantenha o bom convívio e siga as diretrizes de Roleplay do servidor.', '#7c5cff', true, true),
('boas_vindas', 'Canal de Boas-Vindas', 'boas_vindas', '👋 BEM-VINDO | SEVEN ROLEPLAY', 'Seja muito bem-vindo ao nosso servidor oficial.', '#7c5cff', true, true),
('avisos', 'Avisos da Administração', 'avisos', '📢 AVISOS | SEVEN ROLEPLAY', 'Fique atento aos anúncios e atualizações da equipe.', '#7c5cff', true, true),
('suporte', 'Central de Suporte', 'suporte', '🎫 SUPORTE | SEVEN ROLEPLAY', 'Abra um chamado caso precise de auxílio de nossa equipe.', '#7c5cff', true, true),
('sugestoes_intro', 'Sugestões | SEVEN ROLEPLAY', 'sugestoes', '💡 SUGESTÕES | SEVEN ROLEPLAY', 'O Seven Roleplay está em desenvolvimento, e queremos construir uma comunidade que também participe dessa evolução.

Este espaço é destinado às suas ideias e sugestões para o projeto. Você pode sugerir sistemas, mecânicas, veículos, empregos, organizações, economia, mapa, interface, recursos de Roleplay e muito mais.

Antes de publicar, tente explicar de forma clara:
• O que você está sugerindo?
• Como funcionaria?
• O que isso acrescentaria ao jogo?

Todas as sugestões serão avaliadas pela equipe. Uma ideia enviada aqui pode, futuramente, fazer parte do Seven Roleplay. 💜

*Sua ideia também pode ajudar a construir esse mundo.*', '#7c5cff', true, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- Slash Commands padrão
INSERT INTO public.bot_commands (name, description, category, enabled, registered) VALUES
('ticket', 'Abre um novo ticket de suporte com a administração', 'suporte', true, true),
('sugerir', 'Envia uma sugestão de melhoria para o servidor', 'comunidade', true, true),
('ajuda', 'Exibe os comandos disponíveis e links úteis', 'geral', true, true),
('perfil', 'Consulta seus dados de cidadão e histórico no servidor', 'economia', true, true),
('limpar', 'Limpa mensagens do canal (apenas equipe)', 'moderacao', true, true)
ON CONFLICT (name) DO NOTHING;
