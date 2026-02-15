-- =====================================================
-- Migração 012: Sistema de Roles de Usuário
-- =====================================================
-- Adiciona suporte a roles de usuário e liderança de ministérios

-- 1. Adicionar campo role na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role varchar(50) DEFAULT 'user'
  CHECK (role IN ('user', 'ministry_leader', 'admin'));

-- 2. Tabela de relacionamento entre usuários e ministérios que lideram
CREATE TABLE IF NOT EXISTS public.user_ministry_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL DEFAULT 'leader' CHECK (role IN ('leader', 'coordinator', 'helper')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, ministry_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_ministry_roles_user ON public.user_ministry_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ministry_roles_ministry ON public.user_ministry_roles(ministry_id);

-- 4. Habilitar RLS
ALTER TABLE public.user_ministry_roles ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para user_ministry_roles
DROP POLICY IF EXISTS "Users can view own ministry roles" ON public.user_ministry_roles;
CREATE POLICY "Users can view own ministry roles"
  ON public.user_ministry_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all ministry roles" ON public.user_ministry_roles;
CREATE POLICY "Admins can manage all ministry roles"
  ON public.user_ministry_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- 6. Atualizar política de profiles para admin poder atualizar roles
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- 7. Função para verificar se usuário é líder de um ministério
CREATE OR REPLACE FUNCTION public.is_ministry_leader(user_uuid uuid, ministry_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_ministry_roles
    WHERE user_id = user_uuid
    AND ministry_id = ministry_uuid
  );
$$;

-- 8. Função para obter ministérios que o usuário lidera
CREATE OR REPLACE FUNCTION public.get_user_ministries(user_uuid uuid)
RETURNS TABLE (
  ministry_id uuid,
  ministry_name text,
  role varchar(50)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id as ministry_id,
    m.name as ministry_name,
    umr.role
  FROM public.user_ministry_roles umr
  JOIN public.ministries m ON m.id = umr.ministry_id
  WHERE umr.user_id = user_uuid;
$$;

-- 9. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_user_ministry_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_ministry_roles_updated_at ON public.user_ministry_roles;
CREATE TRIGGER user_ministry_roles_updated_at
  BEFORE UPDATE ON public.user_ministry_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_ministry_roles_updated_at();

-- 10. Comentários
COMMENT ON COLUMN public.profiles.role IS 'Role do usuário: user (padrão), ministry_leader (líder de ministério), admin (administrador)';
COMMENT ON TABLE public.user_ministry_roles IS 'Relacionamento entre usuários e ministérios que lideram';
COMMENT ON COLUMN public.user_ministry_roles.role IS 'Tipo de liderança: leader (líder principal), coordinator (coordenador), helper (auxiliar)';

-- 11. Migrar admins existentes para terem role = 'admin'
UPDATE public.profiles SET role = 'admin' WHERE is_admin = true AND (role IS NULL OR role = 'user');
