-- Migration 017: Sistema de permissões granulares
-- Permite delegar capacidades específicas sem promover a admin supremo

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission varchar(50) NOT NULL
    CHECK (permission IN ('approve_bookings', 'manage_external_rentals', 'access_escalas')),
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage permissions"
  ON public.user_permissions FOR ALL
  USING (public.is_admin(auth.uid()));

-- Função auxiliar para verificar permissão (admin sempre tem tudo)
CREATE OR REPLACE FUNCTION public.has_permission(p_user uuid, p_key varchar)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user AND is_admin = true
  ) OR EXISTS (
    SELECT 1 FROM public.user_permissions WHERE user_id = p_user AND permission = p_key
  );
$$;

-- Usuários com approve_bookings podem atualizar status de bookings
CREATE POLICY "Permission holders can update bookings"
  ON public.bookings FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_admin(auth.uid())
    OR public.has_permission(auth.uid(), 'approve_bookings')
  );

-- Usuários com manage_external_rentals acessam as três tabelas de locações
DO $$
BEGIN
  -- external_rentals
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'external_rentals' AND policyname = 'Permission holders can manage external rentals'
  ) THEN
    CREATE POLICY "Permission holders can manage external rentals"
      ON public.external_rentals FOR ALL
      USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_external_rentals'));
  ELSE
    -- Substituir política existente que só verificava is_admin
    DROP POLICY IF EXISTS "Permission holders can manage external rentals" ON public.external_rentals;
    CREATE POLICY "Permission holders can manage external rentals"
      ON public.external_rentals FOR ALL
      USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_external_rentals'));
  END IF;

  -- rental_payments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rental_payments' AND policyname = 'Permission holders can manage rental payments'
  ) THEN
    CREATE POLICY "Permission holders can manage rental payments"
      ON public.rental_payments FOR ALL
      USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_external_rentals'));
  END IF;

  -- rental_costs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rental_costs' AND policyname = 'Permission holders can manage rental costs'
  ) THEN
    CREATE POLICY "Permission holders can manage rental costs"
      ON public.rental_costs FOR ALL
      USING (public.is_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_external_rentals'));
  END IF;
END $$;

COMMENT ON TABLE public.user_permissions IS 'Permissões granulares por usuário: approve_bookings, manage_external_rentals, access_escalas';
