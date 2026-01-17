-- Script automatizado para migrar reservas existentes
-- Este script encontra o user_id automaticamente baseado no email

-- 1. Migrar reservas automaticamente baseado no email
UPDATE public.bookings
SET user_id = auth_users.id
FROM auth.users AS auth_users
WHERE public.bookings.email = auth_users.email
AND public.bookings.user_id IS NULL;

-- 2. Verificar o resultado da migração
SELECT
    'Migração concluída' as status,
    COUNT(*) as total_reservas_migradas
FROM public.bookings
WHERE user_id IS NOT NULL;

-- 3. Verificar reservas por usuário
SELECT
    u.email,
    COUNT(b.id) as quantidade_reservas,
    MIN(b.booking_date) as primeira_reserva,
    MAX(b.booking_date) as ultima_reserva
FROM auth.users u
LEFT JOIN public.bookings b ON u.id = b.user_id
GROUP BY u.id, u.email
HAVING COUNT(b.id) > 0
ORDER BY quantidade_reservas DESC;

-- 4. Verificar se ainda há reservas sem user_id
SELECT
    COUNT(*) as reservas_sem_user_id,
    COUNT(CASE WHEN email LIKE '%gmail.com' THEN 1 END) as reservas_gmail_sem_user_id
FROM public.bookings
WHERE user_id IS NULL;

-- 5. Detalhes das reservas que ainda precisam de migração
SELECT
    email,
    COUNT(*) as quantidade_reservas,
    MIN(booking_date) as reserva_mais_antiga,
    MAX(booking_date) as reserva_mais_recente
FROM public.bookings
WHERE user_id IS NULL
GROUP BY email
ORDER BY quantidade_reservas DESC;
