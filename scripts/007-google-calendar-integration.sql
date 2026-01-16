-- Integração com Google Calendar
-- Este script configura a tabela de tokens OAuth e funções auxiliares

-- 1. Adicionar campos OAuth à tabela profiles existente
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS calendar_integration_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_calendar_sync timestamp with time zone;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_google_tokens ON public.profiles(id, google_access_token);
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_enabled ON public.profiles(calendar_integration_enabled);

-- 5. Função para armazenar tokens OAuth na tabela profiles
CREATE OR REPLACE FUNCTION public.store_google_oauth_token(
  p_user_id uuid,
  p_access_token text,
  p_refresh_token text DEFAULT NULL,
  p_expires_in integer DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  expires_at timestamp with time zone;
BEGIN
  -- Calcular data de expiração
  IF p_expires_in IS NOT NULL THEN
    expires_at := now() + interval '1 second' * p_expires_in;
  END IF;

  -- Atualizar ou inserir na tabela profiles
  UPDATE public.profiles
  SET
    google_access_token = p_access_token,
    google_refresh_token = COALESCE(p_refresh_token, google_refresh_token),
    google_token_expires_at = expires_at,
    calendar_integration_enabled = true,
    updated_at = now()
  WHERE id = p_user_id;

  -- Se não encontrou o perfil, criar
  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      id,
      google_access_token,
      google_refresh_token,
      google_token_expires_at,
      calendar_integration_enabled,
      updated_at
    ) VALUES (
      p_user_id,
      p_access_token,
      p_refresh_token,
      expires_at,
      true,
      now()
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para obter tokens válidos do usuário atual
CREATE OR REPLACE FUNCTION public.get_google_oauth_token()
RETURNS TABLE (
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  is_expired boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.google_access_token,
    p.google_refresh_token,
    p.google_token_expires_at,
    (p.google_token_expires_at IS NOT NULL AND p.google_token_expires_at <= now()) as is_expired
  FROM public.profiles p
  WHERE p.id = auth.uid()
  AND p.google_access_token IS NOT NULL
  AND p.calendar_integration_enabled = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para verificar se usuário tem integração ativa
CREATE OR REPLACE FUNCTION public.has_calendar_integration()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND google_access_token IS NOT NULL
    AND calendar_integration_enabled = true
    AND (google_token_expires_at IS NULL OR google_token_expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para atualizar updated_at automaticamente (já existe para profiles)

-- 9. Comentários explicativos
COMMENT ON COLUMN public.profiles.google_access_token IS 'Token de acesso do Google OAuth';
COMMENT ON COLUMN public.profiles.google_refresh_token IS 'Token de refresh do Google OAuth';
COMMENT ON COLUMN public.profiles.google_token_expires_at IS 'Data de expiração do token de acesso';
COMMENT ON COLUMN public.profiles.calendar_integration_enabled IS 'Se o usuário habilitou integração com Google Calendar';
COMMENT ON COLUMN public.profiles.last_calendar_sync IS 'Última sincronização com Google Calendar';
COMMENT ON COLUMN public.bookings.google_event_id IS 'ID do evento correspondente no Google Calendar';
COMMENT ON COLUMN public.bookings.synced_at IS 'Última sincronização com Google Calendar';

-- 10. Exemplo de uso das funções:
-- SELECT store_google_oauth_token('user-uuid-aqui', 'access_token_aqui', 'refresh_token_aqui', 3600);
-- SELECT * FROM get_google_oauth_token();
-- SELECT has_calendar_integration();
