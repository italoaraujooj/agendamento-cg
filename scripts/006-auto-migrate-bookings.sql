-- Sistema de migração automática de reservas para usuários autenticados
-- Esta migração adiciona funções para migrar automaticamente reservas quando usuários fazem login

-- 1. Criar função para migrar reservas de um usuário específico
CREATE OR REPLACE FUNCTION public.migrate_user_bookings(user_email text)
RETURNS integer AS $$
DECLARE
    user_record RECORD;
    migrated_count integer := 0;
BEGIN
    -- Encontrar o usuário pelo email
    SELECT id, email INTO user_record
    FROM auth.users
    WHERE email = user_email;

    -- Verificar se o usuário existe
    IF user_record.id IS NULL THEN
        RAISE NOTICE 'Usuário com email % não encontrado', user_email;
        RETURN 0;
    END IF;

    -- Migrar reservas sem user_id que correspondam ao email
    UPDATE public.bookings
    SET user_id = user_record.id
    WHERE email = user_email
    AND user_id IS NULL;

    -- Retornar quantas reservas foram migradas
    GET DIAGNOSTICS migrated_count = ROW_COUNT;

    -- Log da migração
    IF migrated_count > 0 THEN
        RAISE NOTICE 'Migradas % reservas para o usuário % (email: %)',
            migrated_count, user_record.id, user_email;
    END IF;

    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar função que seja chamada quando um usuário faz login
CREATE OR REPLACE FUNCTION public.handle_user_login(user_email text)
RETURNS json AS $$
DECLARE
    migrated_count integer := 0;
    user_id uuid;
    result json;
BEGIN
    -- Migrar reservas automaticamente
    SELECT migrate_user_bookings(user_email) INTO migrated_count;

    -- Obter o ID do usuário
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;

    -- Retornar resultado da migração
    result := json_build_object(
        'user_id', user_id,
        'email', user_email,
        'reservas_migradas', migrated_count,
        'timestamp', now()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar função para verificar estatísticas de migração
CREATE OR REPLACE FUNCTION public.get_migration_stats()
RETURNS json AS $$
DECLARE
    stats json;
BEGIN
    SELECT json_build_object(
        'total_reservas', (SELECT COUNT(*) FROM public.bookings),
        'reservas_com_user_id', (SELECT COUNT(*) FROM public.bookings WHERE user_id IS NOT NULL),
        'reservas_sem_user_id', (SELECT COUNT(*) FROM public.bookings WHERE user_id IS NULL),
        'usuarios_ativos', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at IS NOT NULL),
        'ultima_migracao', now()
    ) INTO stats;

    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar trigger para migrar automaticamente quando um usuário acessa reservas
-- (Opcional - só se quiser migração automática em cada acesso)
-- CREATE OR REPLACE FUNCTION public.auto_migrate_on_access()
-- RETURNS trigger AS $$
-- BEGIN
--     -- Migrar reservas do usuário atual se ainda não foram migradas
--     PERFORM migrate_user_bookings((SELECT email FROM auth.users WHERE id = auth.uid()));
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo de uso das funções:

-- 1. Migrar reservas de um usuário específico:
-- SELECT migrate_user_bookings('matheus.ramalho1354@gmail.com');

-- 2. Simular login e migração automática:
-- SELECT handle_user_login('matheus.ramalho1354@gmail.com');

-- 3. Ver estatísticas:
-- SELECT get_migration_stats();

-- 4. Ver reservas de um usuário após migração:
-- SELECT b.* FROM public.bookings b
-- JOIN auth.users u ON b.user_id = u.id
-- WHERE u.email = 'matheus.ramalho1354@gmail.com';
