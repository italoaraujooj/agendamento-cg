-- Verificar conexão com Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se estamos conectados
SELECT 'Conexão estabelecida com sucesso!' as status;

-- 2. Verificar tabelas existentes
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. Verificar se a tabela profiles existe
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'profiles'
        ) THEN '✅ Tabela profiles existe'
        ELSE '❌ Tabela profiles não existe'
    END as profiles_table,

    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'bookings'
        ) THEN '✅ Tabela bookings existe'
        ELSE '❌ Tabela bookings não existe'
    END as bookings_table;

-- 4. Verificar RLS (Row Level Security)
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'bookings', 'environments');

-- 5. Verificar se há dados nas tabelas
SELECT
    'profiles' as table_name,
    COUNT(*) as record_count
FROM public.profiles

UNION ALL

SELECT
    'bookings' as table_name,
    COUNT(*) as record_count
FROM public.bookings

UNION ALL

SELECT
    'environments' as table_name,
    COUNT(*) as record_count
FROM public.environments;

-- 6. Verificar usuários autenticados (se houver)
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN last_sign_in_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_today
FROM auth.users;
