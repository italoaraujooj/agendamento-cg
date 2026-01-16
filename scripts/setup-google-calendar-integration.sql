-- Configuração da Integração com Google Calendar
-- Este script demonstra como configurar a integração usando a tabela profiles existente

-- 1. Verificar estrutura atual da tabela profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Adicionar campos necessários (se não existirem)
-- ALTER TABLE public.profiles
-- ADD COLUMN IF NOT EXISTS google_access_token text,
-- ADD COLUMN IF NOT EXISTS google_refresh_token text,
-- ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone,
-- ADD COLUMN IF NOT EXISTS calendar_integration_enabled boolean DEFAULT false,
-- ADD COLUMN IF NOT EXISTS last_calendar_sync timestamp with time zone;

-- 3. Exemplo de como armazenar tokens OAuth para um usuário
-- Substitua 'USER_ID_REAL' pelo ID real do usuário e os tokens pelos valores reais
-- SELECT store_google_oauth_token(
--   'USER_ID_REAL',
--   'ACCESS_TOKEN_AQUI',
--   'REFRESH_TOKEN_AQUI',
--   3600 -- expira em 1 hora
-- );

-- 4. Verificar se a integração está funcionando
SELECT
    u.email,
    p.calendar_integration_enabled,
    CASE
        WHEN p.google_access_token IS NOT NULL AND
             (p.google_token_expires_at IS NULL OR p.google_token_expires_at > now())
        THEN 'Ativo'
        ELSE 'Inativo/Expirado'
    END as status_integracao,
    p.google_token_expires_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email LIKE '%gmail.com'
ORDER BY u.created_at DESC;

-- 5. Ver reservas com integração no Calendar
SELECT
    b.id,
    b.name,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.google_event_id,
    b.synced_at,
    CASE
        WHEN b.google_event_id IS NOT NULL THEN 'Sincronizado'
        ELSE 'Não sincronizado'
    END as status_calendar,
    u.email as usuario
FROM public.bookings b
JOIN auth.users u ON b.user_id = u.id
ORDER BY b.booking_date DESC, b.start_time DESC;

-- 6. Habilitar/desabilitar integração para um usuário
-- UPDATE public.profiles
-- SET calendar_integration_enabled = true
-- WHERE id = 'USER_ID_REAL';

-- 7. Limpar tokens OAuth (se necessário)
-- UPDATE public.profiles
-- SET
--   google_access_token = NULL,
--   google_refresh_token = NULL,
--   google_token_expires_at = NULL,
--   calendar_integration_enabled = false
-- WHERE id = 'USER_ID_REAL';

-- 8. Estatísticas de integração
SELECT
    COUNT(CASE WHEN calendar_integration_enabled = true THEN 1 END) as usuarios_com_integracao,
    COUNT(CASE WHEN google_access_token IS NOT NULL THEN 1 END) as usuarios_com_token,
    COUNT(CASE WHEN google_token_expires_at > now() THEN 1 END) as tokens_ativos,
    COUNT(CASE WHEN google_token_expires_at <= now() THEN 1 END) as tokens_expirados,
    COUNT(*) as total_perfis
FROM public.profiles;
