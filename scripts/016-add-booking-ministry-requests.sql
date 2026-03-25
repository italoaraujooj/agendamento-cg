-- =====================================================
-- INTEGRAÇÃO AGENDAMENTOS ↔ ESCALAS
-- Tabela para rastrear solicitações de apoio de ministérios em reservas do Salão Principal
-- =====================================================

CREATE TABLE IF NOT EXISTS public.booking_ministry_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id bigint NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now(),

  UNIQUE(booking_id, ministry_id)
);

CREATE INDEX IF NOT EXISTS idx_bmr_booking ON public.booking_ministry_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_bmr_ministry ON public.booking_ministry_requests(ministry_id);

COMMENT ON TABLE public.booking_ministry_requests IS
  'Solicitações de apoio de ministérios para reservas do Salão Principal. notified_at registra quando o email foi enviado ao líder.';

-- RLS
ALTER TABLE public.booking_ministry_requests ENABLE ROW LEVEL SECURITY;

-- Admins podem ler e escrever tudo
CREATE POLICY "Admins gerenciam booking_ministry_requests"
  ON public.booking_ministry_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Usuários autenticados podem inserir (para o formulário de reserva)
CREATE POLICY "Usuários inserem suas solicitações"
  ON public.booking_ministry_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND user_id = auth.uid())
  );

-- Usuários podem ler suas próprias solicitações
CREATE POLICY "Usuários leem suas solicitações"
  ON public.booking_ministry_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND user_id = auth.uid())
  );
