ALTER TABLE public.welcome_banners
  ADD COLUMN used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_used_at timestamp with time zone;