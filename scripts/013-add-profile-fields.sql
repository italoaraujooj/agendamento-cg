-- =====================================================
-- Migração 013: Campos adicionais no perfil de usuário
-- =====================================================
-- Adiciona campos para um perfil mais completo

-- 1. Adicionar campos extras na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone varchar(20),
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_login_at timestamp with time zone;

-- 2. Índice para buscar perfis incompletos
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete ON public.profiles(profile_completed) WHERE profile_completed = false;

-- 3. Atualizar trigger para capturar dados do Google
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    first_login_at,
    profile_completed,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    now(),
    false, -- Perfil começa como incompleto
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para marcar perfil como completo
CREATE OR REPLACE FUNCTION public.mark_profile_complete(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    profile_completed = true,
    updated_at = now()
  WHERE id = user_uuid;
  RETURN FOUND;
END;
$$;

-- 5. Função para verificar se perfil está completo
CREATE OR REPLACE FUNCTION public.is_profile_complete(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT profile_completed FROM public.profiles WHERE id = user_uuid),
    false
  );
$$;

-- 6. Atualizar perfis existentes com dados do Google (se disponível)
-- Isso atualiza usuários que já fizeram login mas não têm full_name no perfil
UPDATE public.profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  avatar_url = COALESCE(p.avatar_url, u.raw_user_meta_data->>'avatar_url'),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.full_name IS NULL
  AND (u.raw_user_meta_data->>'full_name' IS NOT NULL OR u.raw_user_meta_data->>'name' IS NOT NULL);

-- 7. Comentários
COMMENT ON COLUMN public.profiles.phone IS 'Telefone de contato do usuário';
COMMENT ON COLUMN public.profiles.profile_completed IS 'Indica se o usuário completou seu perfil após o primeiro login';
COMMENT ON COLUMN public.profiles.first_login_at IS 'Data do primeiro login do usuário';
