-- Correção das políticas RLS para permitir visualização pública das reservas

-- Primeiro, vamos remover as políticas restritivas antigas
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can view all bookings" ON public.bookings;

-- Agora vamos criar as políticas mais permissivas
-- Todos podem ver todas as reservas (importante para verificar disponibilidade)
CREATE POLICY "Anyone can view bookings" ON public.bookings
FOR SELECT USING (true);

-- Apenas usuários autenticados podem criar reservas
CREATE POLICY "Authenticated users can insert bookings" ON public.bookings
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Apenas usuários autenticados podem atualizar reservas
CREATE POLICY "Authenticated users can update bookings" ON public.bookings
FOR UPDATE USING (auth.role() = 'authenticated');

-- Apenas usuários autenticados podem deletar reservas
CREATE POLICY "Authenticated users can delete bookings" ON public.bookings
FOR DELETE USING (auth.role() = 'authenticated');

-- Verificar o estado das políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;
