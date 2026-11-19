-- ============================================================
-- 029: Períodos de escala com mais de um mês
-- ============================================================
-- Em dezembro a escala costuma cobrir dezembro e janeiro juntos. O período
-- passa a ir do 1º dia do mês inicial (month/year) ao último dia do mês
-- final (end_date). month/year continuam sendo o mês inicial.
-- A regra "um período por mês por ministério" vira "períodos do mesmo
-- ministério não podem se sobrepor".
-- Pode rodar de novo.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.schedule_periods
  DROP CONSTRAINT IF EXISTS schedule_periods_ministry_id_month_year_key;

ALTER TABLE public.schedule_periods
  DROP CONSTRAINT IF EXISTS schedule_periods_dates_check;
ALTER TABLE public.schedule_periods
  ADD CONSTRAINT schedule_periods_dates_check CHECK (end_date >= start_date);

ALTER TABLE public.schedule_periods
  DROP CONSTRAINT IF EXISTS schedule_periods_no_overlap;
ALTER TABLE public.schedule_periods
  ADD CONSTRAINT schedule_periods_no_overlap
  EXCLUDE USING gist (
    ministry_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  );

COMMENT ON TABLE public.schedule_periods IS
  'Períodos de escala: um ou mais meses seguidos (start_date a end_date)';
