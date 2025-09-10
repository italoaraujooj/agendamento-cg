-- Script para adicionar colunas que podem estar faltando
-- Execute apenas se as verificações mostrarem colunas faltando

-- Adicionar colunas faltantes na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calendar_integration_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_calendar_sync timestamp with time zone;

-- Verificar se índices existem, se não, criar
CREATE INDEX IF NOT EXISTS idx_profiles_google_tokens ON public.profiles(id, google_access_token);
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_enabled ON public.profiles(calendar_integration_enabled);

-- Adicionar comentários às colunas
COMMENT ON COLUMN public.profiles.google_access_token IS 'Token de acesso do Google OAuth';
COMMENT ON COLUMN public.profiles.google_refresh_token IS 'Token de refresh do Google OAuth';
COMMENT ON COLUMN public.profiles.google_token_expires_at IS 'Data de expiração do token de acesso';
COMMENT ON COLUMN public.profiles.calendar_integration_enabled IS 'Se o usuário habilitou integração com Google Calendar';
COMMENT ON COLUMN public.profiles.last_calendar_sync IS 'Última sincronização com Google Calendar';

-- Verificar novamente após correção
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('calendar_integration_enabled', 'last_calendar_sync')
ORDER BY column_name;
