-- Migração para adicionar autenticação e controle de acesso
-- Esta migração adiciona suporte a usuários e controle de propriedade das reservas

-- 1. Adicionar campo user_id na tabela bookings
ALTER TABLE public.bookings
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Renomear campo ministry para ministry_network (para consistência com o código)
ALTER TABLE public.bookings
RENAME COLUMN ministry TO ministry_network;

-- 3. Adicionar campos para integração com Google Calendar (opcional)
ALTER TABLE public.bookings
ADD COLUMN google_event_id text,
ADD COLUMN synced_at timestamp with time zone;

-- 4. Criar índices para performance
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_booking_date ON public.bookings(booking_date);
CREATE INDEX idx_bookings_environment_date ON public.bookings(environment_id, booking_date);

-- 5. Habilitar Row Level Security na tabela bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de segurança para bookings

-- Política: Todos podem visualizar todas as reservas (para verificar disponibilidade)
CREATE POLICY "Anyone can view bookings" ON public.bookings
FOR SELECT USING (true);

-- Política: Apenas usuários autenticados podem criar reservas
CREATE POLICY "Authenticated users can insert bookings" ON public.bookings
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem atualizar reservas
CREATE POLICY "Authenticated users can update bookings" ON public.bookings
FOR UPDATE USING (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem deletar reservas
CREATE POLICY "Authenticated users can delete bookings" ON public.bookings
FOR DELETE USING (auth.role() = 'authenticated');

-- 7. Habilitar RLS na tabela environments (para admins)
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem visualizar ambientes (necessário para listagem)
CREATE POLICY "Anyone can view environments" ON public.environments
FOR SELECT USING (true);

-- Política: Apenas usuários autenticados podem criar ambientes
CREATE POLICY "Authenticated users can create environments" ON public.environments
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem atualizar ambientes
CREATE POLICY "Authenticated users can update environments" ON public.environments
FOR UPDATE USING (auth.role() = 'authenticated');

-- Política: Apenas usuários autenticados podem deletar ambientes
CREATE POLICY "Authenticated users can delete environments" ON public.environments
FOR DELETE USING (auth.role() = 'authenticated');

-- 8. Habilitar RLS na tabela environment_availabilities
ALTER TABLE public.environment_availabilities ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem visualizar disponibilidade
CREATE POLICY "Anyone can view availabilities" ON public.environment_availabilities
FOR SELECT USING (true);

-- Política: Apenas usuários autenticados podem gerenciar disponibilidade
CREATE POLICY "Authenticated users can manage availabilities" ON public.environment_availabilities
FOR ALL USING (auth.role() = 'authenticated');

-- 9. Atualizar reservas existentes (se houver) com um user_id padrão
-- NOTA: Isso é apenas para reservas existentes. Em produção, você pode querer
-- criar uma lógica para associar reservas existentes a usuários específicos
-- ou marcar como "legadas"

-- Função para criar perfil de usuário (opcional)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (new.id, new.email, now(), now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente quando usuário se registra
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Criar tabela de perfis de usuário (opcional, para dados adicionais)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- 11. Função helper para verificar propriedade da reserva
CREATE OR REPLACE FUNCTION public.is_booking_owner(booking_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = booking_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários explicativos
COMMENT ON COLUMN public.bookings.user_id IS 'ID do usuário proprietário da reserva';
COMMENT ON COLUMN public.bookings.google_event_id IS 'ID do evento no Google Calendar (se sincronizado)';
COMMENT ON COLUMN public.bookings.synced_at IS 'Última sincronização com Google Calendar';
