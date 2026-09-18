-- Canais funcionais mapeados por finalidade (IDs reais do Discord)
CREATE TABLE public.channel_settings (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_settings TO authenticated;
GRANT ALL ON public.channel_settings TO service_role;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read channel_settings" ON public.channel_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write channel_settings" ON public.channel_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_channel_settings_updated BEFORE UPDATE ON public.channel_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Templates institucionais publicáveis
CREATE TABLE public.server_templates (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_templates TO authenticated;
GRANT ALL ON public.server_templates TO service_role;
ALTER TABLE public.server_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read server_templates" ON public.server_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write server_templates" ON public.server_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_server_templates_updated BEFORE UPDATE ON public.server_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registro real de boas-vindas enviadas
CREATE TABLE public.welcome_events (
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
CREATE INDEX idx_welcome_events_created ON public.welcome_events (created_at DESC);
GRANT SELECT ON public.welcome_events TO authenticated;
GRANT ALL ON public.welcome_events TO service_role;
ALTER TABLE public.welcome_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read welcome_events" ON public.welcome_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Campos de personalização do banner de boas-vindas
ALTER TABLE public.welcome_config
  ADD COLUMN IF NOT EXISTS banner_title text NOT NULL DEFAULT 'BEM-VINDO',
  ADD COLUMN IF NOT EXISTS banner_subtitle text NOT NULL DEFAULT 'SEVEN ROLEPLAY',
  ADD COLUMN IF NOT EXISTS show_avatar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_member_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#7c5cff',
  ADD COLUMN IF NOT EXISTS dm_message text;

-- Templates padrão (conteúdo institucional editável, sem dados fictícios de operação)
INSERT INTO public.server_templates (key, name, purpose, title, description, footer) VALUES
  ('regras', 'Regras', 'regras', 'Regras do SEVEN ROLEPLAY', 'Edite este conteúdo no painel antes de publicar.', 'SEVEN ROLEPLAY'),
  ('boas_vindas', 'Boas-vindas', 'boas_vindas', 'Bem-vindo ao SEVEN ROLEPLAY', 'Edite este conteúdo no painel antes de publicar.', 'SEVEN ROLEPLAY'),
  ('avisos', 'Avisos', 'avisos', 'Avisos oficiais', 'Edite este conteúdo no painel antes de publicar.', 'SEVEN ROLEPLAY'),
  ('suporte', 'Suporte', 'suporte', 'Central de suporte', 'Edite este conteúdo no painel antes de publicar.', 'SEVEN ROLEPLAY'),
  ('sugestoes', 'Sugestões', 'sugestoes', 'Envie sua sugestão', 'Edite este conteúdo no painel antes de publicar.', 'SEVEN ROLEPLAY')
ON CONFLICT (key) DO NOTHING;