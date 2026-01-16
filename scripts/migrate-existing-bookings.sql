-- Script para migrar reservas existentes para usuários autenticados
-- Este script associa reservas existentes ao usuário baseado no email

-- IMPORTANTE: Substitua 'USER_ID_AQUI' pelo ID real do usuário autenticado
-- Você pode encontrar o ID do usuário no Supabase Dashboard > Authentication > Users
-- Ou executar uma query para encontrar pelo email

-- Exemplo: Para encontrar o ID do usuário pelo email
-- SELECT id, email FROM auth.users WHERE email = 'matheus.ramalho1354@gmail.com';

-- 1. Primeiro, vamos ver as reservas existentes sem user_id
SELECT
    id,
    name,
    email,
    booking_date,
    start_time,
    end_time,
    user_id
FROM public.bookings
WHERE user_id IS NULL
ORDER BY booking_date DESC, start_time DESC;

-- 2. Atualizar reservas do usuário específico
-- ⚠️ IMPORTANTE: Substitua 'USER_ID_REAL' pelo ID real do usuário
-- UPDATE public.bookings
-- SET user_id = 'USER_ID_REAL'
-- WHERE email = 'matheus.ramalho1354@gmail.com'
-- AND user_id IS NULL;

-- 3. Verificar se a atualização foi bem-sucedida
-- SELECT
--     id,
--     name,
--     email,
--     booking_date,
--     start_time,
--     end_time,
--     user_id
-- FROM public.bookings
-- WHERE email = 'matheus.ramalho1354@gmail.com'
-- ORDER BY booking_date DESC, start_time DESC;

-- 4. Script genérico para múltiplos usuários (opcional)
-- Este script pode ser usado para migrar reservas de múltiplos usuários
-- baseado em uma tabela de mapeamento email->user_id

-- Criar tabela temporária de mapeamento (se necessário)
-- CREATE TEMP TABLE user_email_mapping (
--     user_id uuid,
--     email text
-- );

-- Inserir mapeamentos
-- INSERT INTO user_email_mapping (user_id, email) VALUES
-- ('USER_ID_1', 'email1@gmail.com'),
-- ('USER_ID_2', 'email2@gmail.com');

-- Atualizar reservas baseado no mapeamento
-- UPDATE public.bookings
-- SET user_id = uem.user_id
-- FROM user_email_mapping uem
-- WHERE public.bookings.email = uem.email
-- AND public.bookings.user_id IS NULL;

-- 5. Limpeza (opcional)
-- DROP TABLE IF EXISTS user_email_mapping;

-- 6. Verificação final
SELECT
    COUNT(*) as total_reservas,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as reservas_com_user_id,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as reservas_sem_user_id
FROM public.bookings;

-- 7. Verificar reservas por usuário
SELECT
    u.email,
    COUNT(b.id) as quantidade_reservas,
    MIN(b.booking_date) as primeira_reserva,
    MAX(b.booking_date) as ultima_reserva
FROM auth.users u
LEFT JOIN public.bookings b ON u.id = b.user_id
WHERE u.email LIKE '%gmail.com'  -- Ajuste conforme necessário
GROUP BY u.id, u.email
ORDER BY quantidade_reservas DESC;
