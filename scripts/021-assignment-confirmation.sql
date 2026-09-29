-- ============================================================
-- 021: Confirmação de escala (aceitar / recusar) e avisos de mudança
-- ============================================================
-- schedule_assignments ganha:
--   status        pending | accepted | declined
--   responded_at  quando o servo respondeu
--   notified_at   quando o servo foi avisado desta atribuição (e-mail ao publicar)
--
-- O motivo da recusa fica em tabela própria: schedule_assignments tem leitura
-- pública nas escalas publicadas (policy "Anyone can view assignments of
-- published schedules"), e o motivo pode ser pessoal (ex.: saúde).
--
-- schedule_assignment_removals registra quem foi removido de uma escala já
-- comunicada, para avisar no próximo "Publicar/Atualizar".
--
-- Legado: atribuições existentes são de escalas publicadas antes deste fluxo;
-- ficam como aceitas e já avisadas, para não disparar pedidos de confirmação
-- retroativos.
-- ============================================================

BEGIN;

ALTER TABLE public.schedule_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE public.schedule_assignments
  DROP CONSTRAINT IF EXISTS schedule_assignments_status_check;
ALTER TABLE public.schedule_assignments
  ADD CONSTRAINT schedule_assignments_status_check
  CHECK (status IN ('pending', 'accepted', 'declined'));

UPDATE public.schedule_assignments
SET status = 'accepted',
    responded_at = COALESCE(confirmed_at, updated_at, created_at),
    notified_at = now();

CREATE TABLE IF NOT EXISTS public.schedule_assignment_declines (
  assignment_id uuid PRIMARY KEY REFERENCES public.schedule_assignments(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS sem policies: somente o service role (APIs do servidor) acessa
ALTER TABLE public.schedule_assignment_declines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.schedule_assignment_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servant_id uuid NOT NULL REFERENCES public.servants(id) ON DELETE CASCADE,
  schedule_event_id uuid NOT NULL REFERENCES public.schedule_events(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
ALTER TABLE public.schedule_assignment_removals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assignments_pending_notification
  ON public.schedule_assignments (schedule_event_id)
  WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignment_removals_pending
  ON public.schedule_assignment_removals (schedule_event_id)
  WHERE notified_at IS NULL;

COMMIT;
