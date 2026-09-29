-- ============================================================
-- 024: Endurece RLS das tabelas de servos + datas bloqueadas
-- ============================================================
-- Problema: com a chave pública (anon) do Supabase, que fica no navegador,
-- qualquer pessoa conseguia, sem login:
--   * ler nome, e-mail e telefone de todos os servos       (servants)
--   * ler/inserir/alterar a disponibilidade de qualquer um  (servant_availability)
--   * incluir/apagar áreas de qualquer servo               (servant_areas)
-- Todo o fluxo do sistema passa pelas APIs (service role, com autorização
-- própria), então essas policies abertas não são necessárias.
--
-- Mantido para o navegador:
--   * admin continua com acesso total (policies "Admins can manage ...")
--   * o usuário logado lê o PRÓPRIO registro de servo (completar cadastro)
-- ============================================================

BEGIN;

-- ─── servants ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view active servants" ON public.servants;
DROP POLICY IF EXISTS "Users can view own servant records" ON public.servants;
CREATE POLICY "Users can view own servant records" ON public.servants
  FOR SELECT USING (user_id = auth.uid());

-- ─── servant_availability ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view availability" ON public.servant_availability;
DROP POLICY IF EXISTS "Anyone can insert availability" ON public.servant_availability;
DROP POLICY IF EXISTS "Anyone can update own availability" ON public.servant_availability;

-- ─── servant_areas ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "servant_areas_all_admin" ON public.servant_areas;
DROP POLICY IF EXISTS "servant_areas_select" ON public.servant_areas;
DROP POLICY IF EXISTS "Admins can manage servant areas" ON public.servant_areas;
DROP POLICY IF EXISTS "Users can view own servant areas" ON public.servant_areas;
CREATE POLICY "Admins can manage servant areas" ON public.servant_areas
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users can view own servant areas" ON public.servant_areas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.servants s WHERE s.id = servant_areas.servant_id AND s.user_id = auth.uid())
  );

-- ─── Datas bloqueadas (férias, viagens) ─────────────────────────────────────
-- Da pessoa (não do ministério): identificada pelo e-mail, vale em todos os
-- ministérios. RLS sem policies: somente as APIs acessam.
CREATE TABLE IF NOT EXISTS public.servant_blockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servant_blockouts_range CHECK (ends_on >= starts_on AND ends_on - starts_on <= 366)
);
CREATE INDEX IF NOT EXISTS idx_servant_blockouts_email ON public.servant_blockouts (email, ends_on);
ALTER TABLE public.servant_blockouts ENABLE ROW LEVEL SECURITY;

COMMIT;
