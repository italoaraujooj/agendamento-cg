-- =====================================================
-- SISTEMA DE ESCALAS DE MINISTÉRIOS
-- Script de criação do banco de dados
-- =====================================================

-- 1. TABELA: ministries (Ministérios)
CREATE TABLE IF NOT EXISTS public.ministries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ministries_active ON public.ministries(is_active) WHERE is_active = true;

COMMENT ON TABLE public.ministries IS 'Ministérios da igreja (ex: Multimídia, Louvor, Recepção)';

-- 2. TABELA: areas (Áreas dentro de cada ministério)
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  min_servants integer DEFAULT 0,
  max_servants integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(ministry_id, name)
);

CREATE INDEX IF NOT EXISTS idx_areas_ministry ON public.areas(ministry_id);
CREATE INDEX IF NOT EXISTS idx_areas_active ON public.areas(is_active) WHERE is_active = true;

COMMENT ON TABLE public.areas IS 'Áreas dentro de cada ministério (ex: Projeção, Mesa de Som, Transmissão)';

-- 3. TABELA: servants (Servos/Voluntários)
CREATE TABLE IF NOT EXISTS public.servants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  is_active boolean DEFAULT true,
  is_leader boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servants_area ON public.servants(area_id);
CREATE INDEX IF NOT EXISTS idx_servants_user ON public.servants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_servants_active ON public.servants(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_servants_email ON public.servants(email) WHERE email IS NOT NULL;

COMMENT ON TABLE public.servants IS 'Servos/voluntários de cada área';

-- 4. TABELA: regular_events (Eventos regulares/recorrentes)
CREATE TABLE IF NOT EXISTS public.regular_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  title text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time time NOT NULL,
  week_of_month integer CHECK (week_of_month IS NULL OR week_of_month BETWEEN 1 AND 5),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regular_events_ministry ON public.regular_events(ministry_id);
CREATE INDEX IF NOT EXISTS idx_regular_events_day ON public.regular_events(day_of_week);

COMMENT ON TABLE public.regular_events IS 'Eventos recorrentes (ex: Culto domingo 10h, Culto quarta 19h)';
COMMENT ON COLUMN public.regular_events.day_of_week IS '0=Domingo, 1=Segunda, ..., 6=Sábado';
COMMENT ON COLUMN public.regular_events.week_of_month IS 'null=todas semanas; 1=1ª ocorrência do dia no mês (dia 1-7); 2=2ª ocorrência (dia 8-14); etc';

-- 5. TABELA: schedule_periods (Períodos de escala - normalmente mensal)
CREATE TABLE IF NOT EXISTS public.schedule_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year >= 2024),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'collecting', 'scheduling', 'published', 'closed')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  availability_deadline timestamptz,
  availability_token uuid DEFAULT gen_random_uuid(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  
  UNIQUE(ministry_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_schedule_periods_ministry ON public.schedule_periods(ministry_id);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_status ON public.schedule_periods(status);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_token ON public.schedule_periods(availability_token);

COMMENT ON TABLE public.schedule_periods IS 'Períodos de escala (geralmente mensal)';
COMMENT ON COLUMN public.schedule_periods.status IS 'draft=rascunho, collecting=coletando disponibilidade, scheduling=montando escala, published=publicada, closed=encerrada';

-- 6. TABELA: schedule_events (Eventos específicos de um período)
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_time time NOT NULL,
  event_type text DEFAULT 'regular' CHECK (event_type IN ('regular', 'special', 'imported')),
  title text NOT NULL,
  description text,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'regular_calendar', 'booking_system')),
  external_id text,
  requires_areas uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_period ON public.schedule_events(period_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_date ON public.schedule_events(event_date);
CREATE INDEX IF NOT EXISTS idx_schedule_events_external ON public.schedule_events(external_id) WHERE external_id IS NOT NULL;

COMMENT ON TABLE public.schedule_events IS 'Eventos específicos dentro de um período de escala';

-- 7. TABELA: servant_availability (Disponibilidade dos servos)
CREATE TABLE IF NOT EXISTS public.servant_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  servant_id uuid NOT NULL REFERENCES public.servants(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.schedule_events(id) ON DELETE CASCADE,
  is_available boolean DEFAULT true,
  notes text,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(servant_id, period_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_availability_servant ON public.servant_availability(servant_id);
CREATE INDEX IF NOT EXISTS idx_availability_period ON public.servant_availability(period_id);
CREATE INDEX IF NOT EXISTS idx_availability_event ON public.servant_availability(event_id);

COMMENT ON TABLE public.servant_availability IS 'Registro de disponibilidade dos servos para cada evento';

-- 8. TABELA: schedule_assignments (Escala final - atribuições)
CREATE TABLE IF NOT EXISTS public.schedule_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_event_id uuid NOT NULL REFERENCES public.schedule_events(id) ON DELETE CASCADE,
  servant_id uuid NOT NULL REFERENCES public.servants(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(schedule_event_id, servant_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_event ON public.schedule_assignments(schedule_event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_servant ON public.schedule_assignments(servant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_area ON public.schedule_assignments(area_id);

COMMENT ON TABLE public.schedule_assignments IS 'Atribuições finais da escala';

-- =====================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regular_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (para visualização de escalas publicadas)
DROP POLICY IF EXISTS "Anyone can view active ministries" ON public.ministries;
CREATE POLICY "Anyone can view active ministries" ON public.ministries
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active areas" ON public.areas;
CREATE POLICY "Anyone can view active areas" ON public.areas
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active servants" ON public.servants;
CREATE POLICY "Anyone can view active servants" ON public.servants
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view active regular events" ON public.regular_events;
CREATE POLICY "Anyone can view active regular events" ON public.regular_events
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can view published schedules" ON public.schedule_periods;
CREATE POLICY "Anyone can view published schedules" ON public.schedule_periods
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view events of accessible periods" ON public.schedule_events;
CREATE POLICY "Anyone can view events of accessible periods" ON public.schedule_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedule_periods sp 
      WHERE sp.id = period_id 
      AND (sp.status = 'published' OR public.is_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Anyone can view assignments of published schedules" ON public.schedule_assignments;
CREATE POLICY "Anyone can view assignments of published schedules" ON public.schedule_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedule_events se
      JOIN public.schedule_periods sp ON sp.id = se.period_id
      WHERE se.id = schedule_event_id 
      AND (sp.status = 'published' OR public.is_admin(auth.uid()))
    )
  );

-- Políticas de administração (apenas admins podem gerenciar)
DROP POLICY IF EXISTS "Admins can manage ministries" ON public.ministries;
CREATE POLICY "Admins can manage ministries" ON public.ministries
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage areas" ON public.areas;
CREATE POLICY "Admins can manage areas" ON public.areas
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage servants" ON public.servants;
CREATE POLICY "Admins can manage servants" ON public.servants
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage regular events" ON public.regular_events;
CREATE POLICY "Admins can manage regular events" ON public.regular_events
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage schedule periods" ON public.schedule_periods;
CREATE POLICY "Admins can manage schedule periods" ON public.schedule_periods
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage schedule events" ON public.schedule_events;
CREATE POLICY "Admins can manage schedule events" ON public.schedule_events
  FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.schedule_assignments;
CREATE POLICY "Admins can manage assignments" ON public.schedule_assignments
  FOR ALL USING (public.is_admin(auth.uid()));

-- Política especial: Servos podem ver e inserir própria disponibilidade
DROP POLICY IF EXISTS "Anyone can view availability" ON public.servant_availability;
CREATE POLICY "Anyone can view availability" ON public.servant_availability
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert availability" ON public.servant_availability;
CREATE POLICY "Anyone can insert availability" ON public.servant_availability
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedule_periods sp
      WHERE sp.id = period_id
      AND sp.status = 'collecting'
    )
  );

DROP POLICY IF EXISTS "Anyone can update own availability" ON public.servant_availability;
CREATE POLICY "Anyone can update own availability" ON public.servant_availability
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schedule_periods sp
      WHERE sp.id = period_id
      AND sp.status = 'collecting'
    )
  );

DROP POLICY IF EXISTS "Admins can manage availability" ON public.servant_availability;
CREATE POLICY "Admins can manage availability" ON public.servant_availability
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para gerar eventos do calendário regular para um período
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

  FOR v_regular_event IN
    SELECT * FROM public.regular_events
    WHERE ministry_id = v_period.ministry_id AND is_active = true
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

-- Função para importar eventos do sistema de agendamentos
-- p_environment_id: text (aceita integer ou uuid em string); quando NULL, filtra por nome (salão principal).
-- A tabela environments pode ter id como integer ou uuid conforme o projeto.
CREATE OR REPLACE FUNCTION public.import_bookings_to_period(
  p_period_id uuid,
  p_environment_id text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_period record;
  v_booking record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_period FROM public.schedule_periods WHERE id = p_period_id;
  
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;
  
  FOR v_booking IN 
    SELECT b.*, e.name as environment_name
    FROM public.bookings b
    JOIN public.environments e ON e.id = b.environment_id
    WHERE b.status = 'approved'
    AND b.booking_date BETWEEN v_period.start_date AND v_period.end_date
    AND (
      (p_environment_id IS NOT NULL AND b.environment_id::text = p_environment_id)
      OR (p_environment_id IS NULL AND e.name ILIKE '%salão principal%')
    )
  LOOP
    INSERT INTO public.schedule_events (
      period_id, event_date, event_time, event_type, title, description, source, external_id
    )
    VALUES (
      p_period_id,
      v_booking.booking_date,
      v_booking.start_time::time,
      'imported',
      COALESCE(v_booking.occasion, 'Evento importado'),
      format('Reserva: %s | Responsável: %s | Local: %s', 
        v_booking.occasion, v_booking.responsible_person, v_booking.environment_name),
      'booking_system',
      v_booking.id::text
    )
    ON CONFLICT DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_escalas_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas de escalas
DROP TRIGGER IF EXISTS update_ministries_updated_at ON public.ministries;
CREATE TRIGGER update_ministries_updated_at BEFORE UPDATE ON public.ministries
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_areas_updated_at ON public.areas;
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_servants_updated_at ON public.servants;
CREATE TRIGGER update_servants_updated_at BEFORE UPDATE ON public.servants
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_regular_events_updated_at ON public.regular_events;
CREATE TRIGGER update_regular_events_updated_at BEFORE UPDATE ON public.regular_events
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_schedule_periods_updated_at ON public.schedule_periods;
CREATE TRIGGER update_schedule_periods_updated_at BEFORE UPDATE ON public.schedule_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_schedule_events_updated_at ON public.schedule_events;
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_availability_updated_at ON public.servant_availability;
CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON public.servant_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON public.schedule_assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_escalas_updated_at();
