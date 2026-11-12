-- ============================================================
-- 028: RLS em bookings e limpeza da integração antiga do Google Calendar
-- ============================================================
-- 1) bookings estava com RLS desligado: qualquer pessoa com a chave pública
--    conseguia criar, alterar e apagar reservas. Liga o RLS com políticas
--    que refletem o uso do app:
--    - ver: todo mundo (agenda pública de reservas)
--    - criar: pessoa logada, só em nome próprio e só como pendente
--    - alterar (aprovar/recusar): admin ou quem tem approve_bookings
--      (antes o dono também podia, inclusive aprovar a própria reserva)
--    - apagar: admin, quem tem approve_bookings, ou o dono (cancelar a
--      própria reserva, enquanto não foi recusada)
--    As rotas do servidor usam a service role e não passam pelo RLS.
-- 2) A agenda agora é por link de assinatura (ICS). Remove os tokens do
--    Google guardados em profiles (acesso à agenda das pessoas, legível por
--    admins), as funções que os gravavam e as colunas de sincronização.
-- Pode rodar de novo.
-- ============================================================

-- 1) RLS em bookings ----------------------------------------------------------

DROP POLICY IF EXISTS "Permission holders can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Reviewers can update bookings" ON public.bookings;
CREATE POLICY "Reviewers can update bookings" ON public.bookings
  FOR UPDATE
  USING (is_admin(auth.uid()) OR has_permission(auth.uid(), 'approve_bookings'))
  WITH CHECK (is_admin(auth.uid()) OR has_permission(auth.uid(), 'approve_bookings'));

DROP POLICY IF EXISTS "Users can create own pending bookings" ON public.bookings;
CREATE POLICY "Users can create own pending bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND coalesce(status, 'pending') = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "Owners and reviewers can delete bookings" ON public.bookings;
CREATE POLICY "Owners and reviewers can delete bookings" ON public.bookings
  FOR DELETE
  USING (
    is_admin(auth.uid())
    OR has_permission(auth.uid(), 'approve_bookings')
    OR (auth.uid() = user_id AND coalesce(status, 'pending') <> 'rejected')
  );

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 2) Integração antiga do Google Calendar ------------------------------------

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('store_google_oauth_token', 'get_google_oauth_token')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', f.sig);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS google_access_token,
  DROP COLUMN IF EXISTS google_refresh_token,
  DROP COLUMN IF EXISTS google_token_expires_at;

ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS google_event_id,
  DROP COLUMN IF EXISTS synced_at;
