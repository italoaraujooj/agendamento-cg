-- Migration 016: Adiciona blocks_all_environments em external_rentals
-- Quando true (padrão), uma locação externa bloqueia TODOS os ambientes
-- para reservas internas no mesmo horário.

ALTER TABLE public.external_rentals
  ADD COLUMN IF NOT EXISTS blocks_all_environments boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.external_rentals.blocks_all_environments IS
  'Quando true, bloqueia todos os ambientes para reservas internas no mesmo horário';

-- Atualiza check_rental_conflict para respeitar blocks_all_environments
CREATE OR REPLACE FUNCTION public.check_rental_conflict(
  p_environment_id integer,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_rental_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.external_rentals r
    WHERE (r.environment_id = p_environment_id OR r.blocks_all_environments = true)
      AND r.rental_date = p_date
      AND r.status != 'cancelled'
      AND (p_exclude_rental_id IS NULL OR r.id != p_exclude_rental_id)
      AND (p_start_time < r.end_time AND p_end_time > r.start_time)
  );
$$;

-- Atualiza check_any_conflict para propagar a correção
CREATE OR REPLACE FUNCTION public.check_any_conflict(
  p_environment_id integer,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_booking_id integer DEFAULT NULL,
  p_exclude_rental_id uuid DEFAULT NULL
)
RETURNS TABLE (
  has_booking_conflict boolean,
  has_rental_conflict boolean,
  has_any_conflict boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.check_booking_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_booking_id) AS has_booking_conflict,
    public.check_rental_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_rental_id) AS has_rental_conflict,
    (
      public.check_booking_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_booking_id)
      OR
      public.check_rental_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_rental_id)
    ) AS has_any_conflict;
$$;
