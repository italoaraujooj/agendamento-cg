-- =====================================================
-- MIGRAÇÃO: Relacionamento Many-to-Many entre
-- regular_events e ministries
-- =====================================================

-- 1. Criar tabela de relacionamento
CREATE TABLE IF NOT EXISTS public.regular_event_ministries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  regular_event_id uuid NOT NULL REFERENCES public.regular_events(id) ON DELETE CASCADE,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(regular_event_id, ministry_id)
);

CREATE INDEX IF NOT EXISTS idx_regular_event_ministries_event ON public.regular_event_ministries(regular_event_id);
CREATE INDEX IF NOT EXISTS idx_regular_event_ministries_ministry ON public.regular_event_ministries(ministry_id);

COMMENT ON TABLE public.regular_event_ministries IS 'Relacionamento many-to-many entre eventos regulares e ministérios';

-- 2. Migrar dados existentes: criar relacionamentos baseados em ministry_id atual
INSERT INTO public.regular_event_ministries (regular_event_id, ministry_id)
SELECT id, ministry_id
FROM public.regular_events
WHERE ministry_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Tornar ministry_id nullable (mantém compatibilidade, mas não é mais obrigatório)
ALTER TABLE public.regular_events 
  ALTER COLUMN ministry_id DROP NOT NULL;

-- 4. Habilitar RLS na nova tabela
ALTER TABLE public.regular_event_ministries ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Anyone can view regular event ministries" ON public.regular_event_ministries;
CREATE POLICY "Anyone can view regular event ministries" ON public.regular_event_ministries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage regular event ministries" ON public.regular_event_ministries;
CREATE POLICY "Admins can manage regular event ministries" ON public.regular_event_ministries
  FOR ALL USING (public.is_admin(auth.uid()));

-- 5. Atualizar função generate_regular_events_for_period para usar relacionamento
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

  -- Buscar eventos regulares associados ao ministério do período através do relacionamento
  FOR v_regular_event IN
    SELECT DISTINCT re.*
    FROM public.regular_events re
    LEFT JOIN public.regular_event_ministries rem ON rem.regular_event_id = re.id
    WHERE re.is_active = true
    AND (
      rem.ministry_id = v_period.ministry_id
      OR re.ministry_id = v_period.ministry_id -- Compatibilidade com dados antigos
    )
  LOOP
    v_current_date := v_period.start_date;

    WHILE v_current_date <= v_period.end_date LOOP
      IF EXTRACT(DOW FROM v_current_date) = v_regular_event.day_of_week THEN
        -- Nª ocorrência do dia da semana no mês (ex.: dia 1-7 = 1ª, dia 8-14 = 2ª, etc.)
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
