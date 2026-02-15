-- =====================================================
-- Migração 015: Corrigir lógica de week_of_month
-- =====================================================
-- Altera a interpretação de week_of_month de "semana após 1º domingo"
-- para "Nª ocorrência do dia da semana no mês" (ex.: 1 = 1º sábado, 2 = 2º sábado).
-- Isso permite criar eventos como "1º e 3º sábados" sem depender do 1º domingo.

-- 1. Atualizar comentário da coluna
COMMENT ON COLUMN public.regular_events.week_of_month IS 'null=todas semanas; 1=1ª ocorrência do dia no mês (dia 1-7); 2=2ª ocorrência (dia 8-14); etc';

-- 2. Atualizar função de geração de eventos para usar Nª ocorrência
CREATE OR REPLACE FUNCTION public.generate_regular_events_for_period(p_period_id uuid)
RETURNS integer AS $$
DECLARE
  v_period record;
  v_regular_event record;
  v_current_date date;
  v_occurrence integer;  -- Nª ocorrência do dia da semana no mês (1 = 1º, 2 = 2º, etc.)
  v_count integer := 0;
BEGIN
  SELECT * INTO v_period FROM public.schedule_periods WHERE id = p_period_id;

  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;

  -- Buscar eventos regulares associados ao ministério do período
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
        -- Nª ocorrência do dia da semana no mês (dia 1-7 = 1ª, dia 8-14 = 2ª, etc.)
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
          ON CONFLICT DO NOTHING;

          v_count := v_count + 1;
        END IF;
      END IF;

      v_current_date := v_current_date + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
