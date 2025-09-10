-- Script específico para migrar reservas do usuário matheus.ramalho1354@gmail.com
-- Execute este script no Supabase SQL Editor

-- 1. Primeiro, vamos encontrar o ID do usuário autenticado
SELECT id, email, created_at
FROM auth.users
WHERE email = 'matheus.ramalho1354@gmail.com';

-- 2. Ver reservas existentes deste email que ainda não têm user_id
SELECT
    id,
    name,
    email,
    booking_date,
    start_time,
    end_time,
    user_id
FROM public.bookings
WHERE email = 'matheus.ramalho1354@gmail.com'
AND user_id IS NULL
ORDER BY booking_date DESC, start_time DESC;

-- 3. Migrar as reservas (IMPORTANTE: substitua USER_ID_REAL pelo ID encontrado na query acima)
-- ⚠️ Execute APENAS após confirmar o ID correto na query anterior

-- UPDATE public.bookings
-- SET user_id = 'USER_ID_REAL'  -- ← Substitua pelo ID real do usuário
-- WHERE email = 'matheus.ramalho1354@gmail.com'
-- AND user_id IS NULL;

-- 4. Verificar se a migração foi bem-sucedida
-- Execute esta query APÓS a migração:
-- SELECT
--     id,
--     name,
--     email,
--     booking_date,
--     start_time,
--     end_time,
--     user_id
-- FROM public.bookings
-- WHERE user_id = 'USER_ID_REAL'
-- ORDER BY booking_date DESC, start_time DESC;
