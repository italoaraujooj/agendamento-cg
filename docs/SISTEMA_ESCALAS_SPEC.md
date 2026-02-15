# Sistema de Escalas de Ministérios - Especificação Técnica

## 1. Visão Geral do Projeto

### 1.1 Objetivo
Desenvolver um sistema web para gestão de escalas de servos dos ministérios da igreja, permitindo:
- Cadastro hierárquico de Ministérios → Áreas → Servos
- Coleta de disponibilidade mensal dos servos via link compartilhável
- Integração com sistema de agendamentos existente para capturar eventos
- Geração automática e manual de escalas mensais
- Notificações por email sobre escalas publicadas

### 1.2 Contexto de Integração
Este sistema se integra ao **Sistema de Agendamento ICVCG** existente, consumindo dados de reservas aprovadas do ambiente "Salão Principal" para compor o calendário de eventos que necessitam de escala.

---

## 2. Stack Tecnológica

### 2.1 Frontend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js | 15.x | Framework React com App Router |
| React | 19.x | Biblioteca de UI |
| TypeScript | 5.x | Tipagem estática |
| Tailwind CSS | 4.x | Estilização utilitária |
| shadcn/ui | latest | Componentes de UI (estilo new-york) |
| Lucide React | latest | Ícones |
| React Hook Form | 7.x | Gerenciamento de formulários |
| Zod | 3.x | Validação de schemas |
| date-fns | 4.x | Manipulação de datas |
| Sonner | latest | Toast notifications |

### 2.2 Backend
| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Next.js API Routes | 15.x | APIs serverless |
| Supabase | latest | Banco de dados PostgreSQL + Auth |
| Resend | 6.x | Envio de emails transacionais |

### 2.3 Infraestrutura
| Serviço | Propósito |
|---------|-----------|
| Vercel | Hospedagem e deploy |
| Supabase | BaaS (Database + Auth + Storage) |
| Resend | Serviço de email |

---

## 3. Arquitetura de Banco de Dados

### 3.1 Diagrama Entidade-Relacionamento

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   ministries    │       │     areas       │       │    servants     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │───┐   │ id (PK)         │
│ name            │   │   │ ministry_id(FK) │   │   │ area_id (FK)    │
│ description     │   └──►│ name            │   └──►│ user_id (FK)    │
│ color           │       │ description     │       │ name            │
│ is_active       │       │ is_active       │       │ email           │
│ created_at      │       │ order_index     │       │ phone           │
│ updated_at      │       │ created_at      │       │ is_active       │
└─────────────────┘       │ updated_at      │       │ is_leader       │
                          └─────────────────┘       │ created_at      │
                                                    │ updated_at      │
                                                    └─────────────────┘

┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  schedule_periods│      │ servant_availability│   │  schedule_assignments│
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │───┐   │ id (PK)         │       │ id (PK)         │
│ ministry_id(FK) │   │   │ servant_id (FK) │       │ schedule_event_id│
│ month           │   │   │ period_id (FK)  │───┐   │ servant_id (FK) │
│ year            │   │   │ event_date      │   │   │ confirmed       │
│ status          │   │   │ is_available    │   │   │ created_at      │
│ start_date      │   │   │ notes           │   │   │ updated_at      │
│ end_date        │   │   │ submitted_at    │   │   └─────────────────┘
│ availability_   │   │   │ created_at      │   │
│   deadline      │   │   └─────────────────┘   │
│ created_at      │   │                         │
│ updated_at      │   │   ┌─────────────────┐   │
│ published_at    │   │   │ schedule_events │   │
└─────────────────┘   │   ├─────────────────┤   │
                      │   │ id (PK)         │◄──┘
                      └──►│ period_id (FK)  │
                          │ event_date      │
                          │ event_time      │
                          │ event_type      │
                          │ title           │
                          │ description     │
                          │ source          │
                          │ external_id     │
                          │ created_at      │
                          └─────────────────┘

┌─────────────────┐
│ regular_events  │  (Calendário Regular)
├─────────────────┤
│ id (PK)         │
│ ministry_id(FK) │
│ title           │
│ day_of_week     │  (0-6, domingo=0)
│ time            │
│ week_of_month   │  (null=todas, 1-5=específica)
│ is_active       │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

### 3.2 Scripts SQL de Criação

```sql
-- =====================================================
-- SISTEMA DE ESCALAS DE MINISTÉRIOS
-- Script de criação do banco de dados
-- =====================================================

-- 1. TABELA: ministries (Ministérios)
CREATE TABLE public.ministries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6', -- Cor para identificação visual
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ministries_active ON public.ministries(is_active) WHERE is_active = true;

COMMENT ON TABLE public.ministries IS 'Ministérios da igreja (ex: Multimídia, Louvor, Recepção)';

-- 2. TABELA: areas (Áreas dentro de cada ministério)
CREATE TABLE public.areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0, -- Para ordenação na exibição
  min_servants integer DEFAULT 1, -- Mínimo de servos necessários por evento
  max_servants integer, -- Máximo de servos (null = sem limite)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(ministry_id, name)
);

CREATE INDEX idx_areas_ministry ON public.areas(ministry_id);
CREATE INDEX idx_areas_active ON public.areas(is_active) WHERE is_active = true;

COMMENT ON TABLE public.areas IS 'Áreas dentro de cada ministério (ex: Projeção, Mesa de Som, Transmissão)';

-- 3. TABELA: servants (Servos/Voluntários)
CREATE TABLE public.servants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Vinculo opcional com usuário do sistema
  name text NOT NULL,
  email text,
  phone text,
  is_active boolean DEFAULT true,
  is_leader boolean DEFAULT false, -- Líder da área
  notes text, -- Observações (ex: "disponível apenas domingos manhã")
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_servants_area ON public.servants(area_id);
CREATE INDEX idx_servants_user ON public.servants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_servants_active ON public.servants(is_active) WHERE is_active = true;
CREATE INDEX idx_servants_email ON public.servants(email) WHERE email IS NOT NULL;

COMMENT ON TABLE public.servants IS 'Servos/voluntários de cada área';

-- 4. TABELA: regular_events (Eventos regulares/recorrentes)
CREATE TABLE public.regular_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  title text NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 6=Sábado
  time time NOT NULL,
  week_of_month integer CHECK (week_of_month IS NULL OR week_of_month BETWEEN 1 AND 5), -- null=todas as semanas
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_regular_events_ministry ON public.regular_events(ministry_id);
CREATE INDEX idx_regular_events_day ON public.regular_events(day_of_week);

COMMENT ON TABLE public.regular_events IS 'Eventos recorrentes (ex: Culto domingo 10h, Culto quarta 19h)';
COMMENT ON COLUMN public.regular_events.day_of_week IS '0=Domingo, 1=Segunda, ..., 6=Sábado';
COMMENT ON COLUMN public.regular_events.week_of_month IS 'null=todas semanas, 1=primeira, 2=segunda, etc';

-- 5. TABELA: schedule_periods (Períodos de escala - normalmente mensal)
CREATE TABLE public.schedule_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year >= 2024),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'collecting', 'scheduling', 'published', 'closed')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  availability_deadline timestamptz, -- Prazo para servos informarem disponibilidade
  availability_token uuid DEFAULT gen_random_uuid(), -- Token único para link de disponibilidade
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  
  UNIQUE(ministry_id, month, year)
);

CREATE INDEX idx_schedule_periods_ministry ON public.schedule_periods(ministry_id);
CREATE INDEX idx_schedule_periods_status ON public.schedule_periods(status);
CREATE INDEX idx_schedule_periods_token ON public.schedule_periods(availability_token);

COMMENT ON TABLE public.schedule_periods IS 'Períodos de escala (geralmente mensal)';
COMMENT ON COLUMN public.schedule_periods.status IS 'draft=rascunho, collecting=coletando disponibilidade, scheduling=montando escala, published=publicada, closed=encerrada';

-- 6. TABELA: schedule_events (Eventos específicos de um período)
CREATE TABLE public.schedule_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.schedule_periods(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_time time NOT NULL,
  event_type text DEFAULT 'regular' CHECK (event_type IN ('regular', 'special', 'imported')),
  title text NOT NULL,
  description text,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'regular_calendar', 'booking_system')),
  external_id text, -- ID do booking se importado do sistema de agendamentos
  requires_areas uuid[], -- Array de IDs das áreas necessárias (null = todas do ministério)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_schedule_events_period ON public.schedule_events(period_id);
CREATE INDEX idx_schedule_events_date ON public.schedule_events(event_date);
CREATE INDEX idx_schedule_events_external ON public.schedule_events(external_id) WHERE external_id IS NOT NULL;

COMMENT ON TABLE public.schedule_events IS 'Eventos específicos dentro de um período de escala';

-- 7. TABELA: servant_availability (Disponibilidade dos servos)
CREATE TABLE public.servant_availability (
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

CREATE INDEX idx_availability_servant ON public.servant_availability(servant_id);
CREATE INDEX idx_availability_period ON public.servant_availability(period_id);
CREATE INDEX idx_availability_event ON public.servant_availability(event_id);

COMMENT ON TABLE public.servant_availability IS 'Registro de disponibilidade dos servos para cada evento';

-- 8. TABELA: schedule_assignments (Escala final - atribuições)
CREATE TABLE public.schedule_assignments (
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

CREATE INDEX idx_assignments_event ON public.schedule_assignments(schedule_event_id);
CREATE INDEX idx_assignments_servant ON public.schedule_assignments(servant_id);
CREATE INDEX idx_assignments_area ON public.schedule_assignments(area_id);

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
CREATE POLICY "Anyone can view active ministries" ON public.ministries
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active areas" ON public.areas
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view published schedules" ON public.schedule_periods
  FOR SELECT USING (status = 'published' OR public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view events of published schedules" ON public.schedule_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schedule_periods sp 
      WHERE sp.id = period_id 
      AND (sp.status = 'published' OR public.is_admin(auth.uid()))
    )
  );

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
CREATE POLICY "Admins can manage ministries" ON public.ministries
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage areas" ON public.areas
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage servants" ON public.servants
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage regular events" ON public.regular_events
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage schedule periods" ON public.schedule_periods
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage schedule events" ON public.schedule_events
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage assignments" ON public.schedule_assignments
  FOR ALL USING (public.is_admin(auth.uid()));

-- Política especial: Servos podem inserir/atualizar própria disponibilidade
CREATE POLICY "Servants can manage own availability" ON public.servant_availability
  FOR ALL USING (
    public.is_admin(auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM public.servants s 
      WHERE s.id = servant_id 
      AND s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Política: Qualquer um com o token pode inserir disponibilidade
CREATE POLICY "Anyone with token can submit availability" ON public.servant_availability
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedule_periods sp
      WHERE sp.id = period_id
      AND sp.status = 'collecting'
    )
  );

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
  v_week_of_month integer;
  v_count integer := 0;
BEGIN
  -- Buscar dados do período
  SELECT * INTO v_period FROM public.schedule_periods WHERE id = p_period_id;
  
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;
  
  -- Iterar sobre eventos regulares do ministério
  FOR v_regular_event IN 
    SELECT * FROM public.regular_events 
    WHERE ministry_id = v_period.ministry_id AND is_active = true
  LOOP
    -- Iterar sobre cada dia do período
    v_current_date := v_period.start_date;
    
    WHILE v_current_date <= v_period.end_date LOOP
      -- Verificar se o dia da semana corresponde
      IF EXTRACT(DOW FROM v_current_date) = v_regular_event.day_of_week THEN
        -- Calcular semana do mês
        v_week_of_month := CEIL(EXTRACT(DAY FROM v_current_date) / 7.0)::integer;
        
        -- Verificar se é a semana correta (ou todas as semanas)
        IF v_regular_event.week_of_month IS NULL OR v_regular_event.week_of_month = v_week_of_month THEN
          -- Inserir evento (ignorar duplicatas)
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
CREATE OR REPLACE FUNCTION public.import_bookings_to_period(
  p_period_id uuid,
  p_environment_id uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  v_period record;
  v_booking record;
  v_count integer := 0;
  v_env_filter uuid;
BEGIN
  SELECT * INTO v_period FROM public.schedule_periods WHERE id = p_period_id;
  
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Período não encontrado';
  END IF;
  
  -- Se não especificado, buscar ID do Salão Principal
  IF p_environment_id IS NULL THEN
    SELECT id INTO v_env_filter FROM public.environments WHERE name ILIKE '%salão principal%' LIMIT 1;
  ELSE
    v_env_filter := p_environment_id;
  END IF;
  
  -- Importar bookings aprovados do período
  FOR v_booking IN 
    SELECT b.*, e.name as environment_name
    FROM public.bookings b
    JOIN public.environments e ON e.id = b.environment_id
    WHERE b.status = 'approved'
    AND b.booking_date BETWEEN v_period.start_date AND v_period.end_date
    AND (v_env_filter IS NULL OR b.environment_id = v_env_filter)
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
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas
CREATE TRIGGER update_ministries_updated_at BEFORE UPDATE ON public.ministries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_servants_updated_at BEFORE UPDATE ON public.servants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_regular_events_updated_at BEFORE UPDATE ON public.regular_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_schedule_periods_updated_at BEFORE UPDATE ON public.schedule_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON public.servant_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

---

## 4. Estrutura do Projeto

```
escalas-ministerio/
├── app/
│   ├── (public)/                    # Rotas públicas
│   │   ├── disponibilidade/
│   │   │   └── [token]/
│   │   │       └── page.tsx         # Formulário de disponibilidade (link compartilhável)
│   │   └── escala/
│   │       └── [periodId]/
│   │           └── page.tsx         # Visualização pública da escala
│   │
│   ├── (auth)/                      # Rotas que requerem autenticação
│   │   ├── admin/
│   │   │   ├── page.tsx             # Dashboard admin
│   │   │   ├── ministerios/
│   │   │   │   ├── page.tsx         # Lista de ministérios
│   │   │   │   ├── novo/
│   │   │   │   │   └── page.tsx     # Criar ministério
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx     # Editar ministério
│   │   │   │       ├── areas/
│   │   │   │       │   └── page.tsx # Gerenciar áreas
│   │   │   │       └── servos/
│   │   │   │           └── page.tsx # Gerenciar servos
│   │   │   │
│   │   │   ├── calendario/
│   │   │   │   └── page.tsx         # Configurar eventos regulares
│   │   │   │
│   │   │   └── escalas/
│   │   │       ├── page.tsx         # Lista de períodos de escala
│   │   │       ├── nova/
│   │   │       │   └── page.tsx     # Criar período de escala
│   │   │       └── [periodId]/
│   │   │           ├── page.tsx     # Visualizar/editar período
│   │   │           ├── eventos/
│   │   │           │   └── page.tsx # Gerenciar eventos do período
│   │   │           ├── disponibilidade/
│   │   │           │   └── page.tsx # Ver disponibilidades coletadas
│   │   │           └── montar/
│   │   │               └── page.tsx # Interface de montagem da escala
│   │   │
│   │   └── layout.tsx               # Layout autenticado
│   │
│   ├── api/
│   │   ├── ministries/
│   │   │   ├── route.ts             # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       └── route.ts         # GET, PUT, DELETE
│   │   │
│   │   ├── areas/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   │
│   │   ├── servants/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   │
│   │   ├── regular-events/
│   │   │   └── route.ts
│   │   │
│   │   ├── schedule-periods/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── generate-events/
│   │   │       │   └── route.ts     # Gerar eventos do calendário
│   │   │       ├── import-bookings/
│   │   │       │   └── route.ts     # Importar do sistema de agendamentos
│   │   │       └── publish/
│   │   │           └── route.ts     # Publicar escala
│   │   │
│   │   ├── availability/
│   │   │   ├── route.ts             # POST (submit availability)
│   │   │   └── [token]/
│   │   │       └── route.ts         # GET (dados para form público)
│   │   │
│   │   ├── assignments/
│   │   │   └── route.ts             # CRUD de atribuições
│   │   │
│   │   └── notifications/
│   │       └── send-availability-link/
│   │           └── route.ts         # Enviar link por email
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     # Home / redirect
│
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── calendar.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── form.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── auth/
│   │   ├── auth-provider.tsx
│   │   └── auth-button.tsx
│   │
│   ├── ministry/
│   │   ├── ministry-card.tsx
│   │   ├── ministry-form.tsx
│   │   ├── area-list.tsx
│   │   ├── area-form.tsx
│   │   ├── servant-list.tsx
│   │   └── servant-form.tsx
│   │
│   ├── schedule/
│   │   ├── period-card.tsx
│   │   ├── period-form.tsx
│   │   ├── event-calendar.tsx
│   │   ├── event-list.tsx
│   │   ├── availability-form.tsx    # Form público de disponibilidade
│   │   ├── availability-grid.tsx    # Grid de disponibilidades (admin)
│   │   ├── schedule-builder.tsx     # Interface drag-and-drop
│   │   └── schedule-view.tsx        # Visualização da escala final
│   │
│   ├── calendar/
│   │   ├── regular-event-form.tsx
│   │   └── regular-event-list.tsx
│   │
│   └── shared/
│       ├── navigation-header.tsx
│       ├── page-header.tsx
│       ├── loading-spinner.tsx
│       ├── empty-state.tsx
│       └── confirm-dialog.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts                 # Cliente com service role
│   │
│   ├── utils.ts                     # cn() e utilitários gerais
│   ├── constants.ts                 # Constantes do sistema
│   │
│   └── validations/
│       ├── ministry.ts              # Schemas Zod
│       ├── area.ts
│       ├── servant.ts
│       ├── schedule.ts
│       └── availability.ts
│
├── hooks/
│   ├── use-ministries.ts
│   ├── use-areas.ts
│   ├── use-servants.ts
│   ├── use-schedule-periods.ts
│   └── use-availability.ts
│
├── types/
│   └── database.ts                  # Tipos TypeScript das tabelas
│
├── scripts/
│   └── 001-create-schedule-tables.sql
│
├── .env.local.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 5. Tipos TypeScript

```typescript
// types/database.ts

export interface Ministry {
  id: string
  name: string
  description: string | null
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Area {
  id: string
  ministry_id: string
  name: string
  description: string | null
  is_active: boolean
  order_index: number
  min_servants: number
  max_servants: number | null
  created_at: string
  updated_at: string
  // Relacionamentos
  ministry?: Ministry
  servants?: Servant[]
}

export interface Servant {
  id: string
  area_id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  is_leader: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  area?: Area
}

export interface RegularEvent {
  id: string
  ministry_id: string
  title: string
  day_of_week: number // 0-6
  time: string // HH:mm:ss
  week_of_month: number | null // 1-5 ou null para todas
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type SchedulePeriodStatus = 
  | 'draft' 
  | 'collecting' 
  | 'scheduling' 
  | 'published' 
  | 'closed'

export interface SchedulePeriod {
  id: string
  ministry_id: string
  month: number
  year: number
  status: SchedulePeriodStatus
  start_date: string
  end_date: string
  availability_deadline: string | null
  availability_token: string
  notes: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  // Relacionamentos
  ministry?: Ministry
  events?: ScheduleEvent[]
}

export type EventType = 'regular' | 'special' | 'imported'
export type EventSource = 'manual' | 'regular_calendar' | 'booking_system'

export interface ScheduleEvent {
  id: string
  period_id: string
  event_date: string
  event_time: string
  event_type: EventType
  title: string
  description: string | null
  source: EventSource
  external_id: string | null
  requires_areas: string[] | null
  created_at: string
  updated_at: string
  // Relacionamentos
  assignments?: ScheduleAssignment[]
}

export interface ServantAvailability {
  id: string
  servant_id: string
  period_id: string
  event_id: string | null
  is_available: boolean
  notes: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  // Relacionamentos
  servant?: Servant
  event?: ScheduleEvent
}

export interface ScheduleAssignment {
  id: string
  schedule_event_id: string
  servant_id: string
  area_id: string
  confirmed: boolean
  confirmed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relacionamentos
  servant?: Servant
  area?: Area
  event?: ScheduleEvent
}

// Tipos auxiliares para formulários
export interface MinistryFormData {
  name: string
  description?: string
  color: string
}

export interface AreaFormData {
  ministry_id: string
  name: string
  description?: string
  min_servants: number
  max_servants?: number
}

export interface ServantFormData {
  area_id: string
  name: string
  email?: string
  phone?: string
  is_leader: boolean
  notes?: string
}

export interface AvailabilitySubmission {
  servant_id: string
  period_id: string
  availabilities: {
    event_id: string
    is_available: boolean
    notes?: string
  }[]
}
```

---

## 6. Schemas de Validação (Zod)

```typescript
// lib/validations/ministry.ts
import { z } from 'zod'

export const ministrySchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
})

// lib/validations/area.ts
export const areaSchema = z.object({
  ministry_id: z.string().uuid('Ministério inválido'),
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  description: z.string().max(500).optional(),
  min_servants: z.number().int().min(1, 'Mínimo de 1 servo'),
  max_servants: z.number().int().min(1).optional().nullable(),
})

// lib/validations/servant.ts
export const servantSchema = z.object({
  area_id: z.string().uuid('Área inválida'),
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  is_leader: z.boolean().default(false),
  notes: z.string().max(500).optional(),
})

// lib/validations/schedule.ts
export const schedulePeriodSchema = z.object({
  ministry_id: z.string().uuid('Ministério inválido'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024),
  availability_deadline: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
})

// lib/validations/availability.ts
export const availabilitySubmissionSchema = z.object({
  servant_id: z.string().uuid(),
  period_id: z.string().uuid(),
  availabilities: z.array(z.object({
    event_id: z.string().uuid(),
    is_available: z.boolean(),
    notes: z.string().max(200).optional(),
  })),
})
```

---

## 7. Fluxos de Usuário

### 7.1 Fluxo do Administrador

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DO ADMINISTRADOR                            │
└─────────────────────────────────────────────────────────────────────────┘

1. CONFIGURAÇÃO INICIAL (uma vez)
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │   Criar      │───►│   Criar      │───►│  Adicionar   │
   │  Ministério  │    │    Áreas     │    │   Servos     │
   └──────────────┘    └──────────────┘    └──────────────┘
         │
         ▼
   ┌──────────────┐
   │  Configurar  │
   │  Calendário  │
   │   Regular    │
   └──────────────┘

2. CICLO MENSAL DE ESCALA
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │Criar Período │───►│   Gerar      │───►│  Importar    │
   │  (Mês/Ano)   │    │   Eventos    │    │  Bookings    │
   └──────────────┘    │  Regulares   │    │ (opcional)   │
                       └──────────────┘    └──────────────┘
         │
         ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │   Enviar     │───►│   Aguardar   │───►│    Montar    │
   │    Link      │    │ Disponibil.  │    │    Escala    │
   │Disponibilid. │    │              │    │              │
   └──────────────┘    └──────────────┘    └──────────────┘
         │
         ▼
   ┌──────────────┐    ┌──────────────┐
   │  Publicar    │───►│   Notificar  │
   │   Escala     │    │    Servos    │
   └──────────────┘    └──────────────┘
```

### 7.2 Fluxo do Servo (Via Link Compartilhável)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DO SERVO                                  │
└─────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │   Recebe     │───►│   Acessa     │───►│  Identifica  │
   │    Link      │    │    Link      │    │   (Email)    │
   │   (Email)    │    │              │    │              │
   └──────────────┘    └──────────────┘    └──────────────┘
         │
         ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │     Vê       │───►│    Marca     │───►│    Envia     │
   │   Eventos    │    │ Disponibil.  │    │  Respostas   │
   │    do Mês    │    │              │    │              │
   └──────────────┘    └──────────────┘    └──────────────┘
         │
         ▼
   ┌──────────────┐
   │   Recebe     │
   │ Confirmação  │
   └──────────────┘
```

---

## 8. Componentes Principais

### 8.1 Formulário de Disponibilidade (Público)

```tsx
// components/schedule/availability-form.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import type { ScheduleEvent, Servant, SchedulePeriod } from "@/types/database"

interface AvailabilityFormProps {
  period: SchedulePeriod
  events: ScheduleEvent[]
  servants: Servant[]
  onSubmit: (data: AvailabilitySubmission) => Promise<void>
}

export function AvailabilityForm({ period, events, servants, onSubmit }: AvailabilityFormProps) {
  const [selectedServant, setSelectedServant] = useState<string>("")
  const [email, setEmail] = useState("")
  const [availabilities, setAvailabilities] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<"identify" | "availability">("identify")

  // Agrupar eventos por data
  const eventsByDate = events.reduce((acc, event) => {
    const date = event.event_date
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {} as Record<string, ScheduleEvent[]>)

  const handleIdentify = () => {
    const servant = servants.find(s => 
      s.email?.toLowerCase() === email.toLowerCase()
    )
    
    if (!servant) {
      toast.error("Email não encontrado. Verifique se você está cadastrado.")
      return
    }
    
    setSelectedServant(servant.id)
    setStep("availability")
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      const submission = {
        servant_id: selectedServant,
        period_id: period.id,
        availabilities: Object.entries(availabilities).map(([eventId, isAvailable]) => ({
          event_id: eventId,
          is_available: isAvailable,
          notes: notes[eventId],
        })),
      }
      
      await onSubmit(submission)
      toast.success("Disponibilidade enviada com sucesso!")
    } catch (error) {
      toast.error("Erro ao enviar disponibilidade")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatEventDate = (dateStr: string) => {
    return format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR })
  }

  const formatEventTime = (timeStr: string) => {
    return timeStr.slice(0, 5)
  }

  if (step === "identify") {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Informe seu email para acessar o formulário de disponibilidade.
          </p>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleIdentify} className="w-full">
            Continuar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Disponibilidade - {format(new Date(period.year, period.month - 1), "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Marque os eventos em que você estará disponível para servir.
          </p>
          
          {period.availability_deadline && (
            <Badge variant="outline" className="mb-4">
              Prazo: {format(parseISO(period.availability_deadline), "dd/MM/yyyy 'às' HH:mm")}
            </Badge>
          )}
        </CardContent>
      </Card>

      {Object.entries(eventsByDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dateEvents]) => (
          <Card key={date}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">
                {formatEventDate(date)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dateEvents
                .sort((a, b) => a.event_time.localeCompare(b.event_time))
                .map((event) => (
                  <div key={event.id} className="flex items-start gap-4 p-3 rounded-lg border">
                    <Checkbox
                      id={event.id}
                      checked={availabilities[event.id] ?? true}
                      onCheckedChange={(checked) => 
                        setAvailabilities(prev => ({ ...prev, [event.id]: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor={event.id} className="font-medium cursor-pointer">
                        {formatEventTime(event.event_time)} - {event.title}
                      </Label>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}
                      <Textarea
                        placeholder="Observações (opcional)"
                        className="mt-2 h-16"
                        value={notes[event.id] || ""}
                        onChange={(e) => 
                          setNotes(prev => ({ ...prev, [event.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}

      <Button 
        onClick={handleSubmit} 
        disabled={isSubmitting}
        className="w-full"
        size="lg"
      >
        {isSubmitting ? "Enviando..." : "Enviar Disponibilidade"}
      </Button>
    </div>
  )
}
```

### 8.2 Interface de Montagem de Escala

```tsx
// components/schedule/schedule-builder.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, X, AlertCircle } from "lucide-react"
import type { 
  ScheduleEvent, 
  Servant, 
  Area, 
  ServantAvailability,
  ScheduleAssignment 
} from "@/types/database"

interface ScheduleBuilderProps {
  events: ScheduleEvent[]
  areas: Area[]
  servants: Servant[]
  availabilities: ServantAvailability[]
  assignments: ScheduleAssignment[]
  onAssign: (eventId: string, servantId: string, areaId: string) => Promise<void>
  onRemoveAssignment: (assignmentId: string) => Promise<void>
}

export function ScheduleBuilder({
  events,
  areas,
  servants,
  availabilities,
  assignments,
  onAssign,
  onRemoveAssignment,
}: ScheduleBuilderProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  // Verificar disponibilidade de um servo para um evento
  const isServantAvailable = (servantId: string, eventId: string) => {
    const availability = availabilities.find(
      a => a.servant_id === servantId && a.event_id === eventId
    )
    return availability?.is_available ?? false
  }

  // Obter atribuições de um evento
  const getEventAssignments = (eventId: string) => {
    return assignments.filter(a => a.schedule_event_id === eventId)
  }

  // Obter servos de uma área
  const getAreaServants = (areaId: string) => {
    return servants.filter(s => s.area_id === areaId && s.is_active)
  }

  // Contar quantas vezes um servo foi escalado
  const getServantAssignmentCount = (servantId: string) => {
    return assignments.filter(a => a.servant_id === servantId).length
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Eventos */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="font-semibold text-lg">Eventos</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {events
            .sort((a, b) => {
              const dateCompare = a.event_date.localeCompare(b.event_date)
              if (dateCompare !== 0) return dateCompare
              return a.event_time.localeCompare(b.event_time)
            })
            .map((event) => {
              const eventAssignments = getEventAssignments(event.id)
              const isComplete = areas.every(area => 
                eventAssignments.some(a => a.area_id === area.id)
              )
              
              return (
                <Card 
                  key={event.id}
                  className={`cursor-pointer transition-colors ${
                    selectedEvent === event.id 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedEvent(event.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {format(parseISO(event.event_date), "dd/MM", { locale: ptBR })}
                          {" "}{event.event_time.slice(0, 5)}
                        </p>
                        <p className="text-xs text-muted-foreground">{event.title}</p>
                      </div>
                      {isComplete ? (
                        <Badge variant="default" className="bg-green-500">
                          <Check className="h-3 w-3" />
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {eventAssignments.length}/{areas.length}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </div>
      </div>

      {/* Painel de Atribuição */}
      <div className="lg:col-span-2">
        {selectedEvent ? (
          <Card>
            <CardHeader>
              <CardTitle>
                {(() => {
                  const event = events.find(e => e.id === selectedEvent)
                  if (!event) return "Evento"
                  return `${format(parseISO(event.event_date), "EEEE, dd/MM", { locale: ptBR })} - ${event.event_time.slice(0, 5)} - ${event.title}`
                })()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {areas.map((area) => {
                const areaServants = getAreaServants(area.id)
                const currentAssignment = getEventAssignments(selectedEvent)
                  .find(a => a.area_id === area.id)
                
                return (
                  <div key={area.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{area.name}</h4>
                      {currentAssignment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveAssignment(currentAssignment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <Select
                      value={currentAssignment?.servant_id || ""}
                      onValueChange={(servantId) => 
                        onAssign(selectedEvent, servantId, area.id)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar servo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {areaServants.map((servant) => {
                          const available = isServantAvailable(servant.id, selectedEvent)
                          const assignmentCount = getServantAssignmentCount(servant.id)
                          
                          return (
                            <SelectItem 
                              key={servant.id} 
                              value={servant.id}
                              disabled={!available}
                            >
                              <div className="flex items-center gap-2">
                                {available ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-red-500" />
                                )}
                                <span>{servant.name}</span>
                                <Badge variant="outline" className="ml-2">
                                  {assignmentCount}x
                                </Badge>
                                {servant.is_leader && (
                                  <Badge variant="secondary">Líder</Badge>
                                )}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">
                Selecione um evento para montar a escala
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

---

## 9. APIs

### 9.1 API de Disponibilidade (Link Público)

```typescript
// app/api/availability/[token]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  const { token } = params

  // Buscar período pelo token
  const { data: period, error: periodError } = await supabase
    .from("schedule_periods")
    .select(`
      *,
      ministry:ministries(*),
      events:schedule_events(*)
    `)
    .eq("availability_token", token)
    .single()

  if (periodError || !period) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 })
  }

  // Verificar se ainda está coletando disponibilidade
  if (period.status !== "collecting") {
    return NextResponse.json({ 
      error: "O prazo para informar disponibilidade já encerrou" 
    }, { status: 400 })
  }

  // Buscar servos do ministério
  const { data: servants } = await supabase
    .from("servants")
    .select(`
      *,
      area:areas(*)
    `)
    .eq("area.ministry_id", period.ministry_id)
    .eq("is_active", true)

  return NextResponse.json({
    period,
    events: period.events,
    servants: servants || [],
  })
}
```

### 9.2 API de Importação de Bookings

```typescript
// app/api/schedule-periods/[id]/import-bookings/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
  }

  const { id: periodId } = params
  const body = await request.json()
  const { environmentId } = body // Opcional: ID do ambiente específico

  // Chamar função do banco para importar
  const { data, error } = await supabase
    .rpc("import_bookings_to_period", {
      p_period_id: periodId,
      p_environment_id: environmentId || null,
    })

  if (error) {
    console.error("Erro ao importar bookings:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ 
    success: true, 
    imported: data,
    message: `${data} evento(s) importado(s) do sistema de agendamentos`
  })
}
```

---

## 10. Configuração de Eventos Regulares

### 10.1 Exemplos de Configuração

```typescript
// Dados de exemplo para popular regular_events
const regularEventsData = [
  // Cultos de Domingo
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Culto de Domingo - Manhã",
    day_of_week: 0, // Domingo
    time: "10:00:00",
    week_of_month: null, // Todos os domingos
  },
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Culto de Domingo - Noite",
    day_of_week: 0,
    time: "18:00:00",
    week_of_month: null,
  },
  // Culto de Quarta
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Culto de Oração",
    day_of_week: 3, // Quarta-feira
    time: "19:00:00",
    week_of_month: null,
  },
  // Jejum e Oração (primeira semana)
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Jejum e Oração",
    day_of_week: 1, // Segunda
    time: "19:00:00",
    week_of_month: 1, // Primeira semana
  },
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Jejum e Oração",
    day_of_week: 2, // Terça
    time: "19:00:00",
    week_of_month: 1,
  },
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Jejum e Oração",
    day_of_week: 3, // Quarta
    time: "19:00:00",
    week_of_month: 1,
  },
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Jejum e Oração",
    day_of_week: 4, // Quinta
    time: "19:00:00",
    week_of_month: 1,
  },
  {
    ministry_id: "<MINISTRY_UUID>",
    title: "Jejum e Oração",
    day_of_week: 5, // Sexta
    time: "19:00:00",
    week_of_month: 1,
  },
]
```

---

## 11. Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-anon-key"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"

# Resend (emails)
RESEND_API_KEY="re_xxxxx"
RESEND_FROM_EMAIL="escalas@seudominio.com"

# App
NEXT_PUBLIC_APP_URL="https://seu-app.vercel.app"

# Sistema de Agendamentos (para integração)
BOOKING_SYSTEM_URL="https://agendamento-cg.vercel.app"
```

---

## 12. Checklist de Implementação

### Fase 1: Fundação
- [ ] Setup do projeto Next.js com TypeScript
- [ ] Configurar Tailwind CSS e shadcn/ui
- [ ] Configurar Supabase (client, server, admin)
- [ ] Criar schema do banco de dados
- [ ] Implementar autenticação (reutilizar do sistema existente)

### Fase 2: Cadastros Básicos
- [ ] CRUD de Ministérios
- [ ] CRUD de Áreas
- [ ] CRUD de Servos
- [ ] Tela de configuração de eventos regulares

### Fase 3: Sistema de Escalas
- [ ] CRUD de Períodos de Escala
- [ ] Geração automática de eventos regulares
- [ ] Importação de bookings do sistema de agendamentos
- [ ] Interface de montagem de escala

### Fase 4: Coleta de Disponibilidade
- [ ] Página pública de disponibilidade (via token)
- [ ] API de submissão de disponibilidade
- [ ] Visualização de disponibilidades coletadas
- [ ] Envio de link por email

### Fase 5: Publicação e Notificações
- [ ] Publicação de escala
- [ ] Visualização pública de escala publicada
- [ ] Notificação por email de escala publicada
- [ ] Exportação para PDF

### Fase 6: Melhorias
- [ ] Dashboard com estatísticas
- [ ] Histórico de escalas
- [ ] Sugestão automática de escala (balanceamento)
- [ ] Confirmação de presença pelos servos

---

## 13. Padrões de Código

### 13.1 Nomenclatura
- **Componentes**: PascalCase (`MinistryForm.tsx`)
- **Funções/Hooks**: camelCase (`useMinistries`)
- **Constantes**: SCREAMING_SNAKE_CASE (`MAX_SERVANTS_PER_EVENT`)
- **Tipos**: PascalCase (`Ministry`, `SchedulePeriod`)
- **Arquivos de API**: kebab-case (`schedule-periods/route.ts`)

### 13.2 Estrutura de Componentes
```tsx
"use client" // Apenas se necessário

// 1. Imports externos
import { useState } from "react"
import { format } from "date-fns"

// 2. Imports de componentes UI
import { Button } from "@/components/ui/button"

// 3. Imports de tipos
import type { Ministry } from "@/types/database"

// 4. Imports de utils/hooks
import { cn } from "@/lib/utils"

// 5. Interface de Props
interface ComponentProps {
  data: Ministry
  onSave: (data: Ministry) => Promise<void>
}

// 6. Componente
export function Component({ data, onSave }: ComponentProps) {
  // Estados
  const [loading, setLoading] = useState(false)
  
  // Handlers
  const handleSubmit = async () => {
    // ...
  }
  
  // Render
  return (
    // JSX
  )
}
```

### 13.3 Tratamento de Erros
```typescript
try {
  const { data, error } = await supabase.from("table").select()
  
  if (error) {
    console.error("Contexto do erro:", error)
    toast.error("Mensagem amigável para o usuário")
    return
  }
  
  // Sucesso
} catch (err) {
  console.error("Erro inesperado:", err)
  toast.error("Ocorreu um erro inesperado")
}
```

---

## 14. Considerações de Segurança

1. **RLS (Row Level Security)**: Todas as tabelas devem ter políticas RLS ativas
2. **Service Role Key**: Usar apenas em APIs do servidor, nunca expor no cliente
3. **Validação**: Sempre validar inputs com Zod antes de operações no banco
4. **Tokens**: Links de disponibilidade usam UUIDs únicos e verificam status do período
5. **Rate Limiting**: Considerar implementar para APIs públicas

---

## 15. Integração com Sistema de Agendamentos

A integração acontece através da função `import_bookings_to_period` que:

1. Recebe o ID do período de escala
2. Opcionalmente filtra por ambiente (ex: "Salão Principal")
3. Busca reservas aprovadas no período de datas
4. Cria eventos correspondentes na tabela `schedule_events`
5. Marca a origem como `booking_system` e armazena o ID original

Isso permite que eventos especiais (redes, eventos, conferências) sejam automaticamente incluídos no calendário de escala sem duplicação manual.

---

*Documento gerado em: Janeiro/2026*
*Versão: 1.0*
