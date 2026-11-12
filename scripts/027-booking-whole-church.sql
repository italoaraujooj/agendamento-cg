-- ============================================================
-- 027: Reserva da igreja inteira
-- ============================================================
-- Uma reserva com blocks_all_environments = true ocupa TODOS os ambientes
-- no horário (ex.: evento que usa o salão principal e as salas ao mesmo
-- tempo). É uma linha só: uma aprovação, um evento na agenda, um e-mail.
-- Nesse caso environment_id fica NULL. Mesmo padrão de
-- external_rentals.blocks_all_environments (migração 016).
-- Pode rodar de novo.
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS blocks_all_environments boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.blocks_all_environments IS
  'Quando true, a reserva ocupa todos os ambientes da igreja no horário (environment_id fica NULL)';

ALTER TABLE public.bookings ALTER COLUMN environment_id DROP NOT NULL;

-- Ou é da igreja inteira (sem ambiente), ou tem um ambiente
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_scope_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_scope_check CHECK (
  (blocks_all_environments AND environment_id IS NULL)
  OR (NOT blocks_all_environments AND environment_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS bookings_whole_church_date_idx
  ON public.bookings (booking_date)
  WHERE blocks_all_environments;

-- Conflito com reservas internas: uma reserva da igreja inteira conflita com
-- qualquer ambiente. p_environment_id NULL = verificar a igreja inteira
-- (conflita com qualquer reserva no horário).
CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_environment_id integer,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_booking_id integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE (
        p_environment_id IS NULL
        OR b.environment_id = p_environment_id
        OR b.blocks_all_environments = true
      )
      AND b.booking_date = p_date
      AND b.status != 'rejected'
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (p_start_time < b.end_time AND p_end_time > b.start_time)
  );
$$;

-- Conflito com locações externas: p_environment_id NULL = igreja inteira
-- (conflita com qualquer locação no horário)
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
    WHERE (
        p_environment_id IS NULL
        OR r.environment_id = p_environment_id
        OR r.blocks_all_environments = true
      )
      AND r.rental_date = p_date
      AND r.status != 'cancelled'
      AND (p_exclude_rental_id IS NULL OR r.id != p_exclude_rental_id)
      AND (p_start_time < r.end_time AND p_end_time > r.start_time)
  );
$$;
