-- ============================================================
-- 022: Notificações push (PWA)
-- ============================================================
-- Uma linha por dispositivo/navegador que autorizou notificações.
-- A pessoa é identificada pelo e-mail (normalizado), o mesmo usado pelos
-- servos em todos os ministérios; user_id é preenchido quando a inscrição
-- foi feita logado.
--
-- RLS sem policies: somente as APIs do servidor (service role) acessam.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email ON public.push_subscriptions (email);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

COMMIT;
