-- Migration 018: Módulo de Avisos no Culto

-- 1. Atualizar CHECK constraint de user_permissions para incluir manage_avisos
ALTER TABLE public.user_permissions
  DROP CONSTRAINT user_permissions_permission_check;
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission IN (
    'approve_bookings', 'manage_external_rentals', 'access_escalas', 'manage_avisos'
  ));

-- 2. Tabela principal
CREATE TABLE IF NOT EXISTS public.church_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(20) NOT NULL
    CHECK (type IN ('event', 'general', 'ministry')),
  title text NOT NULL,
  description text,

  -- Campos de evento
  location text,
  event_time text,
  event_date date,
  registration_type varchar(10) CHECK (registration_type IN ('free', 'paid')),
  registration_value numeric(10,2),
  registration_where text,

  -- Ministério responsável (texto livre)
  ministry_name text,

  -- Arte (Supabase Storage)
  has_art boolean NOT NULL DEFAULT false,
  art_url text,
  art_storage_path text,

  -- Agendamento de domingos
  first_sunday date NOT NULL,
  last_sunday  date NOT NULL,

  -- Status de aprovação
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,

  -- Auditoria
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.church_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own announcements"
  ON public.church_announcements FOR SELECT
  USING (
    auth.uid() = submitted_by
    OR public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_avisos')
  );

CREATE POLICY "Authenticated users can submit announcements"
  ON public.church_announcements FOR INSERT
  WITH CHECK (auth.uid() = submitted_by AND auth.uid() IS NOT NULL);

CREATE POLICY "Delete own pending or admin"
  ON public.church_announcements FOR DELETE
  USING (
    (auth.uid() = submitted_by AND status = 'pending')
    OR public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_avisos')
  );

CREATE POLICY "Admins manage announcements"
  ON public.church_announcements FOR UPDATE
  USING (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_avisos')
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'manage_avisos')
  );

-- 4. Índices
CREATE INDEX idx_church_announcements_status ON public.church_announcements(status);
CREATE INDEX idx_church_announcements_submitted_by ON public.church_announcements(submitted_by);
CREATE INDEX idx_church_announcements_sundays ON public.church_announcements(first_sunday, last_sunday);

COMMENT ON TABLE public.church_announcements IS 'Avisos solicitados para serem dados nos cultos de domingo';
