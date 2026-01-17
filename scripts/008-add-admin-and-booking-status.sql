-- Migração para adicionar sistema de administração e aprovação de agendamentos
-- Esta migração adiciona:
-- 1. Campo is_admin na tabela profiles
-- 2. Campo status na tabela bookings (pending, approved, rejected)
-- 3. Políticas de RLS para administradores

-- 1. Adicionar campo is_admin na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Criar índice para consultas de administradores
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- 2. Adicionar campo status na tabela bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Adicionar campo para armazenar quem aprovou/rejeitou e quando
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS review_notes text;

-- Criar índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- 3. Criar função helper para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar função para obter emails de todos os admins
CREATE OR REPLACE FUNCTION public.get_admin_emails()
RETURNS TABLE(email text, full_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT p.email, p.full_name
  FROM public.profiles p
  WHERE p.is_admin = true
  AND p.email IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atualizar políticas de RLS para bookings (admins podem fazer tudo)

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Admins can do everything on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update any booking" ON public.bookings;
DROP POLICY IF EXISTS "Admins can delete any booking" ON public.bookings;

-- Política: Administradores podem atualizar qualquer reserva
CREATE POLICY "Admins can update any booking" ON public.bookings
FOR UPDATE USING (public.is_admin(auth.uid()));

-- Política: Administradores podem deletar qualquer reserva
CREATE POLICY "Admins can delete any booking" ON public.bookings
FOR DELETE USING (public.is_admin(auth.uid()));

-- 6. Políticas para profiles (admin pode ver todos os perfis)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id OR public.is_admin(auth.uid())
);

-- 7. Comentários explicativos
COMMENT ON COLUMN public.profiles.is_admin IS 'Indica se o usuário tem privilégios de administrador';
COMMENT ON COLUMN public.bookings.status IS 'Status da reserva: pending (aguardando aprovação), approved (aprovada), rejected (rejeitada)';
COMMENT ON COLUMN public.bookings.reviewed_by IS 'ID do administrador que aprovou/rejeitou a reserva';
COMMENT ON COLUMN public.bookings.reviewed_at IS 'Data e hora da revisão';
COMMENT ON COLUMN public.bookings.review_notes IS 'Observações do administrador sobre a aprovação/rejeição';

-- 8. Sincronizar emails da tabela auth.users para profiles (importante para notificações)
-- Isso garante que os perfis tenham o email correto do usuário
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND (p.email IS NULL OR p.email = '' OR p.email != u.email);

-- 9. Atualizar reservas existentes para status 'approved' (se já existiam antes do sistema de aprovação)
UPDATE public.bookings SET status = 'approved' WHERE status IS NULL;

-- 10. Criar trigger para manter email sincronizado quando usuário faz login
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email,
      updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Criar trigger para sincronizar email quando usuário é atualizado
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- 11. IMPORTANTE: Comando para definir um administrador (execute manualmente substituindo o email)
-- UPDATE public.profiles SET is_admin = true WHERE email = 'seu-email@exemplo.com';
