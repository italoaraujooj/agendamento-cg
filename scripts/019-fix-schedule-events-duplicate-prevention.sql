-- =====================================================
-- Migração 019: Prevenir duplicação de eventos de escala
-- =====================================================
-- Problema: generate_regular_events_for_period usava ON CONFLICT DO NOTHING
-- mas a tabela schedule_events não possuía nenhuma UNIQUE constraint,
-- então toda inserção era bem-sucedida e os eventos eram duplicados.

-- 1. Remover duplicatas existentes mantendo a linha mais antiga de cada grupo
DELETE FROM public.schedule_events
WHERE id NOT IN (
  SELECT DISTINCT ON (period_id, event_date, event_time, title)
    id
  FROM public.schedule_events
  ORDER BY period_id, event_date, event_time, title, created_at ASC
);

-- 2. Adicionar constraint UNIQUE para prevenir duplicatas futuras
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_period_date_time_title_key
  UNIQUE (period_id, event_date, event_time, title);

-- 3. Atualizar a função para usar o conflict target explícito e contar
--    apenas as linhas efetivamente inseridas (não as ignoradas pelo ON CONFLICT)
CREATE OR REPLACE FUNCTION public.generate_regular_events_for_period(p_period_id uuid)
RETURNS integer AS $$
DECLARE
  v_period record;
  v_regular_event record;
  v_current_date date;
  v_occurrence integer;
  v_count integer := 0;
  v_inserted integer;
BEGIN
  SELECT * INTO v_period FROM public.schedule_periods WHERE id = p_period_id;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;

  FOR v_regular_event IN
    SELECT DISTINCT re.*
    FROM public.regular_events re
    LEFT JOIN public.regular_event_ministries rem ON rem.regular_event_id = re.id
    WHERE re.is_active = true
    AND (
      rem.ministry_id = v_period.ministry_id
      OR re.ministry_id = v_period.ministry_id
    )
  LOOP
    v_current_date := v_period.start_date;

    WHILE v_current_date <= v_period.end_date LOOP
      IF EXTRACT(DOW FROM v_current_date) = v_regular_event.day_of_week THEN
        v_occurrence := CEIL(EXTRACT(DAY FROM v_current_date) / 7.0)::integer;

        IF v_regular_event.week_of_month IS NULL OR v_regular_event.week_of_month = v_occurrence THEN
          INSERT INTO public.schedule_events (
            period_id, event_date, event_time, event_type, title, source
          )
          VALUES (
            p_period_id,
            v_current_date,
            v_regular_event.time,
            'regular',
            v_regular_event.title,
            'regular_calendar'
          )
          ON CONFLICT (period_id, event_date, event_time, title) DO NOTHING;

          GET DIAGNOSTICS v_inserted = ROW_COUNT;
          v_count := v_count + v_inserted;
        END IF;
      END IF;

      v_current_date := v_current_date + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
