-- Script para testar as funções de migração automática
-- Execute no Supabase SQL Editor

-- 1. Testar função de migração específica
SELECT migrate_user_bookings('matheus.ramalho1354@gmail.com');

-- 2. Testar função de login (simula login do usuário)
SELECT handle_user_login('matheus.ramalho1354@gmail.com');

-- 3. Ver estatísticas de migração
SELECT get_migration_stats();

-- 4. Verificar reservas migradas
SELECT
    b.id,
    b.name,
    b.email,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.user_id,
    u.email as user_email
FROM public.bookings b
LEFT JOIN auth.users u ON b.user_id = u.id
WHERE u.email = 'matheus.ramalho1354@gmail.com'
ORDER BY b.booking_date DESC, b.start_time DESC;

-- 5. Verificar se ainda há reservas sem user_id
SELECT
    COUNT(*) as reservas_sem_user_id,
    array_agg(DISTINCT email) as emails_sem_migracao
FROM public.bookings
WHERE user_id IS NULL;

-- 6. Testar migração para múltiplos usuários (exemplo)
-- SELECT migrate_user_bookings(email) FROM auth.users WHERE email LIKE '%gmail.com%';
