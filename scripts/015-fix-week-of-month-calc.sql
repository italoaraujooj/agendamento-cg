-- ============================================================
-- 015: Corrige cálculo de week_of_month na geração de eventos
-- ============================================================
-- Problema: CEIL(DAY/7) conta semanas a partir do dia 1 do mês,
-- ignorando que "primeira semana" deve ser a primeira semana
-- COMPLETA (segunda a sexta). Se o mês começa numa sexta, a
-- sexta do dia 1 era indevidamente incluída na semana 1.
--
-- Correção: calcular a semana pelo Monday da semana do dia.
-- Se esse Monday for do mês anterior → semana incompleta → ignorar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_regular_events_for_period(p_period_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_period          record;
  v_regular_event   record;
  v_current_date    date;
  v_week_of_month   integer;
  v_week_monday     date;
  v_month_start     date;
  v_count           integer := 0;
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

        IF v_regular_event.week_of_month IS NULL THEN
          -- Sem restrição de semana: gerar sempre
          INSERT INTO public.schedule_events (
            period_id, event_date, event_time, event_type, title, source
          ) VALUES (
            p_period_id, v_current_date, v_regular_event.time,
            'regular', v_regular_event.title, 'regular_calendar'
          )
          ON CONFLICT DO NOTHING;

          v_count := v_count + 1;

        ELSE
          -- Determinar a segunda-feira da semana deste dia.
          -- EXTRACT(DOW): 0=Dom, 1=Seg … 6=Sáb
          -- Offset até segunda: (DOW + 6) % 7  →  Seg=0, Ter=1 … Dom=6
          v_week_monday := v_current_date
            - CAST(((EXTRACT(DOW FROM v_current_date)::integer + 6) % 7) AS integer);

          v_month_start := date_trunc('month', v_current_date)::date;

          IF v_week_monday < v_month_start THEN
            -- A segunda dessa semana pertence ao mês anterior:
            -- semana incompleta no início do mês → não pertence à semana 1
            v_week_of_month := 0;
          ELSE
            v_week_of_month := CEIL(EXTRACT(DAY FROM v_week_monday) / 7.0)::integer;
          END IF;

          IF v_regular_event.week_of_month = v_week_of_month THEN
            INSERT INTO public.schedule_events (
              period_id, event_date, event_time, event_type, title, source
            ) VALUES (
              p_period_id, v_current_date, v_regular_event.time,
              'regular', v_regular_event.title, 'regular_calendar'
            )
            ON CONFLICT DO NOTHING;

            v_count := v_count + 1;
          END IF;

        END IF;

      END IF;

      v_current_date := v_current_date + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;
