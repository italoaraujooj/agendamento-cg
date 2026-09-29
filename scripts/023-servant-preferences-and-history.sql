-- ============================================================
-- 023: Preferências de escala do servo + histórico da escala
-- ============================================================
-- servants (participação da pessoa no ministério) ganha:
--   max_per_month          limite de escalas no mês (null = sem limite)
--   serve_with_servant_id  servir junto com outra pessoa do mesmo ministério
--
-- schedule_assignment_log: quem entrou, saiu, confirmou ou recusou em cada
-- evento, por quem e quando. Gravado pelas APIs (que sabem quem agiu).
-- RLS sem policies: somente o servidor acessa.
-- ============================================================

BEGIN;

ALTER TABLE public.servants
  ADD COLUMN IF NOT EXISTS max_per_month smallint,
  ADD COLUMN IF NOT EXISTS serve_with_servant_id uuid REFERENCES public.servants(id) ON DELETE SET NULL;

ALTER TABLE public.servants DROP CONSTRAINT IF EXISTS servants_max_per_month_check;
ALTER TABLE public.servants
  ADD CONSTRAINT servants_max_per_month_check CHECK (max_per_month IS NULL OR max_per_month BETWEEN 1 AND 31);

ALTER TABLE public.servants DROP CONSTRAINT IF EXISTS servants_serve_with_not_self;
ALTER TABLE public.servants
  ADD CONSTRAINT servants_serve_with_not_self CHECK (serve_with_servant_id IS NULL OR serve_with_servant_id <> id);

CREATE TABLE IF NOT EXISTS public.schedule_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  schedule_event_id uuid REFERENCES public.schedule_events(id) ON DELETE CASCADE,
  servant_id uuid REFERENCES public.servants(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('added', 'removed', 'accepted', 'declined')),
  -- Quem fez: usuário logado (líder/admin) ou o próprio servo pelo link pessoal
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  -- Nomes no momento do registro (o histórico continua legível se o servo/área for removido)
  servant_name text,
  area_name text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_log_period ON public.schedule_assignment_log (period_id, created_at DESC);

ALTER TABLE public.schedule_assignment_log ENABLE ROW LEVEL SECURITY;

COMMIT;
