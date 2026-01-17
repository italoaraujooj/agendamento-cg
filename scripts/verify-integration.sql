-- Verificação Completa da Integração Google Calendar
-- Execute este script para verificar se tudo está configurado corretamente

-- 1. Verificar todas as colunas OAuth na tabela profiles
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
AND (column_name LIKE 'google_%' OR column_name LIKE 'calendar_%')
ORDER BY ordinal_position;

-- 2. Verificar se as funções existem
SELECT
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    obj_description(oid, 'pg_proc') as description
FROM pg_proc
WHERE proname LIKE '%google%'
ORDER BY proname;

-- 3. Verificar se a coluna calendar_integration_enabled existe
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name = 'calendar_integration_enabled'
        ) THEN '✅ calendar_integration_enabled existe'
        ELSE '❌ Faltando calendar_integration_enabled'
    END as calendar_integration_enabled,

    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name = 'last_calendar_sync'
        ) THEN '✅ last_calendar_sync existe'
        ELSE '❌ Faltando last_calendar_sync'
    END as last_calendar_sync;

-- 4. Verificar se índices foram criados
SELECT
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
AND (indexname LIKE '%google%' OR indexname LIKE '%calendar%')
ORDER BY indexname;

-- 5. Verificar se campos foram adicionados à tabela bookings
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings'
AND column_name IN ('google_event_id', 'synced_at')
ORDER BY column_name;

-- 6. Teste das funções (substitua pelo seu user_id se quiser testar)
-- SELECT has_calendar_integration();
-- SELECT * FROM get_google_oauth_token();

-- 7. Ver usuários com integração (se houver)
SELECT
    u.email,
    p.calendar_integration_enabled,
    CASE
        WHEN p.google_access_token IS NOT NULL THEN 'Tem token'
        ELSE 'Sem token'
    END as status_token,
    p.google_token_expires_at,
    p.last_calendar_sync
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 8. Verificar se Edge Functions estão ativas (execute no terminal)
-- supabase functions list
