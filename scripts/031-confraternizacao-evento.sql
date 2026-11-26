-- ============================================================
-- 031: Dados do evento da confraternização editáveis no painel
-- ============================================================
-- Antes vinham de variáveis de ambiente (CONFRA_EVENTO_*, CONFRA_INSCRICOES_ATE).
-- Agora ficam numa linha única, editada em /admin (aba Confraternização).
-- As variáveis de ambiente continuam valendo só como reserva enquanto esta
-- linha não existir.
--
-- RLS ligado e sem policies: só as rotas de API (service role) leem e escrevem.
-- Pode rodar de novo.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.confra_settings (
  -- Linha única
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  title text NOT NULL DEFAULT 'Confraternização de Fim de Ano',
  event_date date,
  event_time text,
  location text,
  map_url text,
  -- Último dia de inscrição (inclusive, horário de Brasília)
  registrations_until date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.confra_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.confra_settings IS
  'Dados do evento da confraternização (linha única), editados no painel de administração';

COMMIT;
