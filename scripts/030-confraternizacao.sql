-- ============================================================
-- 030: Inscrições da confraternização de fim de ano (temporário)
-- ============================================================
-- Página pública /confraternizacao: inscrição de participantes (R$ 15 por
-- pessoa, crianças até 9 anos não pagam), opção "não posso pagar" e doações
-- anônimas para custear quem não pode. O pagamento é conferido pelas
-- entradas de PIX lidas no Pluggy (lib/confraternizacao/reconcile.ts).
--
-- As tabelas ficam com RLS ligado e sem policies: só as rotas de API, com o
-- service role, leem e escrevem (a página é pública e não tem sessão).
--
-- Gestão: permissão manage_confraternizacao (além dos admins).
-- Pode rodar de novo. Tudo numa transação.
-- ============================================================

BEGIN;

-- 1. Permissão nova --------------------------------------------------------
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_permission_check;
ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission IN (
    'approve_bookings', 'manage_external_rentals', 'access_escalas',
    'manage_avisos', 'manage_confraternizacao'
  ));

INSERT INTO public.user_permissions (user_id, permission)
SELECT id, 'manage_confraternizacao'
FROM auth.users
WHERE lower(email) = 'matheus.ramalho1354@gmail.com'
ON CONFLICT (user_id, permission) DO NOTHING;

-- 2. Inscrições -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.confra_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link pessoal para a página de status/pagamento (sem login)
  access_token text NOT NULL UNIQUE,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  -- Quem vai fazer o PIX, se não for um dos participantes
  payer_name text,
  cannot_pay boolean NOT NULL DEFAULT false,
  payers_count integer NOT NULL CHECK (payers_count >= 0),
  free_count integer NOT NULL CHECK (free_count >= 0),
  amount_due numeric(10,2) NOT NULL CHECK (amount_due >= 0),
  donation_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (donation_amount >= 0),
  total_expected numeric(10,2) NOT NULL CHECK (total_expected >= 0),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'sponsored', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS confra_registrations_status_idx
  ON public.confra_registrations (status);

CREATE TABLE IF NOT EXISTS public.confra_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL
    REFERENCES public.confra_registrations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  age integer NOT NULL CHECK (age BETWEEN 0 AND 120),
  phone text,
  -- Crianças até 9 anos não pagam
  is_child boolean GENERATED ALWAYS AS (age <= 9) STORED
);

CREATE INDEX IF NOT EXISTS confra_participants_registration_idx
  ON public.confra_participants (registration_id);

-- 3. Doações avulsas ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.confra_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  -- Privado: serve só para conferir o PIX, nunca é exibido
  payer_name text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. PIX recebidos e já usados ------------------------------------------------
-- Só entram aqui os PIX ligados a uma inscrição/doação: as demais transações
-- da conta não são gravadas.
CREATE TABLE IF NOT EXISTS public.confra_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Um PIX nunca confirma duas inscrições. Nulo na baixa manual sem PIX.
  pluggy_tx_id text UNIQUE,
  amount numeric(10,2) NOT NULL,
  payer_name text,
  tx_date date,
  registration_id uuid REFERENCES public.confra_registrations(id) ON DELETE SET NULL,
  donation_id uuid REFERENCES public.confra_donations(id) ON DELETE SET NULL,
  match text NOT NULL CHECK (match IN ('auto', 'manual')),
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(registration_id, donation_id) <= 1)
);

ALTER TABLE public.confra_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confra_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confra_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confra_payments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.confra_registrations IS
  'Inscrições da confraternização de fim de ano (página pública /confraternizacao)';

COMMIT;
