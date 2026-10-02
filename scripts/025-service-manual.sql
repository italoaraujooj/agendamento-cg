-- ============================================================
-- 025: Manual de Serviço (checklist, solução de problemas, vídeos)
-- ============================================================
-- Conteúdo por área (area_id nulo = vale para o ministério inteiro).
-- O servo marca os passos do checklist do dia (só ele vê) e pode sugerir
-- passos novos, que entram depois da aprovação de admin/líder.
-- manual_usage guarda só "quem usou em que dia" — base do painel do líder,
-- sem expor o progresso de cada um.
--
-- RLS ligada e sem policies: todo acesso passa pelas APIs (service role),
-- que aplicam a autorização (lib/escalas/auth.ts).
-- ============================================================

BEGIN;

-- ─── Passos do checklist ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  section text CHECK (section IS NULL OR char_length(section) <= 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  details text CHECK (details IS NULL OR char_length(details) <= 2000),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_checklist_scope
  ON public.manual_checklist_items (ministry_id, area_id, order_index);

-- ─── Solução de problemas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_troubleshooting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  problem text NOT NULL CHECK (char_length(problem) BETWEEN 1 AND 200),
  solution text NOT NULL CHECK (char_length(solution) BETWEEN 1 AND 4000),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_troubleshooting_scope
  ON public.manual_troubleshooting (ministry_id, area_id, order_index);

-- ─── Vídeos indicados ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  url text NOT NULL CHECK (url ~* '^https?://' AND char_length(url) <= 500),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_videos_scope
  ON public.manual_videos (ministry_id, area_id, order_index);

-- ─── Sugestões de passos (aprovação de admin/líder) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_checklist_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  section text CHECK (section IS NULL OR char_length(section) <= 60),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  details text CHECK (details IS NULL OR char_length(details) <= 2000),
  suggested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  created_item_id uuid REFERENCES public.manual_checklist_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manual_suggestions_pending
  ON public.manual_checklist_suggestions (ministry_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_manual_suggestions_user
  ON public.manual_checklist_suggestions (suggested_by, status);

-- ─── Marcações do dia (privadas de cada servo) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_checklist_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.manual_checklist_items(id) ON DELETE CASCADE,
  done_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id, done_on)
);

-- ─── Uso do manual (quem usou, em que dia) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  -- Sem área (manual geral do ministério) grava o próprio ministry_id como chave
  scope_id uuid NOT NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  used_on date NOT NULL,
  PRIMARY KEY (user_id, scope_id, used_on)
);
CREATE INDEX IF NOT EXISTS idx_manual_usage_ministry ON public.manual_usage (ministry_id, used_on);

ALTER TABLE public.manual_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_troubleshooting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_checklist_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_checklist_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_usage ENABLE ROW LEVEL SECURITY;

COMMIT;
