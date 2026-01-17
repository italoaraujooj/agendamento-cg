-- Script simples para migrar reservas do usuário matheus.ramalho1354@gmail.com
-- Execute este script no Supabase SQL Editor

DO $$
DECLARE
    user_record RECORD;
    updated_count INTEGER;
BEGIN
    -- Encontrar o usuário
    SELECT id, email INTO user_record
    FROM auth.users
    WHERE email = 'matheus.ramalho1354@gmail.com';

    -- Verificar se o usuário existe
    IF user_record.id IS NULL THEN
        RAISE EXCEPTION 'Usuário com email matheus.ramalho1354@gmail.com não encontrado';
    END IF;

    -- Mostrar informações antes da migração
    RAISE NOTICE 'Usuário encontrado: ID=% Email=%', user_record.id, user_record.email;

    -- Contar reservas antes da migração
    SELECT COUNT(*) INTO updated_count
    FROM public.bookings
    WHERE email = 'matheus.ramalho1354@gmail.com' AND user_id IS NULL;

    RAISE NOTICE 'Reservas sem user_id encontradas: %', updated_count;

    -- Migrar as reservas
    UPDATE public.bookings
    SET user_id = user_record.id
    WHERE email = 'matheus.ramalho1354@gmail.com' AND user_id IS NULL;

    -- Verificar quantas foram atualizadas
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Reservas migradas com sucesso: %', updated_count;

    -- Verificar o resultado final
    SELECT COUNT(*) INTO updated_count
    FROM public.bookings
    WHERE user_id = user_record.id;

    RAISE NOTICE 'Total de reservas associadas ao usuário: %', updated_count;

END $$;

-- Verificar o resultado da migração
SELECT
    u.email,
    COUNT(b.id) as quantidade_reservas,
    MIN(b.booking_date) as primeira_reserva,
    MAX(b.booking_date) as ultima_reserva
FROM auth.users u
LEFT JOIN public.bookings b ON u.id = b.user_id
WHERE u.email = 'matheus.ramalho1354@gmail.com'
GROUP BY u.id, u.email;
