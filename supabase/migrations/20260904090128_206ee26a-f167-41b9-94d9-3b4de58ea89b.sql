CREATE TABLE public.welcome_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path text NOT NULL UNIQUE,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.welcome_banners TO authenticated;
GRANT ALL ON public.welcome_banners TO service_role;

ALTER TABLE public.welcome_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view welcome banners"
ON public.welcome_banners FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage welcome banners"
ON public.welcome_banners FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_welcome_banners_order ON public.welcome_banners (sort_order, created_at);