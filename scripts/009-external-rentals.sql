-- =====================================================
-- Migração 009: Sistema de Locações Externas
-- =====================================================
-- Este script cria as tabelas necessárias para gerenciar
-- locações externas do espaço da igreja, incluindo:
-- - Cadastro de locações
-- - Registro de pagamentos
-- - Registro de custos/despesas
-- - Fluxo de caixa
-- =====================================================

-- Tabela principal de locações externas
CREATE TABLE IF NOT EXISTS public.external_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dados do ambiente e data/horário
  environment_id integer REFERENCES public.environments(id),
  rental_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  
  -- Dados do locador
  renter_name varchar(255) NOT NULL,
  renter_email varchar(255),
  renter_phone varchar(50) NOT NULL,
  renter_document varchar(20), -- CPF ou CNPJ
  renter_address text,
  
  -- Dados do evento/locação
  event_description text NOT NULL,
  expected_participants integer DEFAULT 0,
  
  -- Valores financeiros
  total_value decimal(10, 2) NOT NULL DEFAULT 0,
  discount decimal(10, 2) DEFAULT 0,
  final_value decimal(10, 2) GENERATED ALWAYS AS (total_value - discount) STORED,
  
  -- Status da locação
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  
  -- Observações e notas
  notes text,
  contract_signed boolean DEFAULT false,
  
  -- Metadados
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_external_rentals_date ON public.external_rentals(rental_date);
CREATE INDEX IF NOT EXISTS idx_external_rentals_status ON public.external_rentals(status);
CREATE INDEX IF NOT EXISTS idx_external_rentals_environment ON public.external_rentals(environment_id);
CREATE INDEX IF NOT EXISTS idx_external_rentals_created_by ON public.external_rentals(created_by);

-- Tabela de pagamentos recebidos
CREATE TABLE IF NOT EXISTS public.rental_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.external_rentals(id) ON DELETE CASCADE,
  
  -- Dados do pagamento
  amount decimal(10, 2) NOT NULL,
  payment_date date NOT NULL,
  payment_method varchar(50) NOT NULL CHECK (payment_method IN ('pix', 'cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'other')),
  
  -- Referência e observações
  reference varchar(255), -- Comprovante, número do PIX, etc.
  notes text,
  
  -- Metadados
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rental_payments_rental ON public.rental_payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_payments_date ON public.rental_payments(payment_date);

-- Tabela de custos/despesas relacionados a locações
CREATE TABLE IF NOT EXISTS public.rental_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid REFERENCES public.external_rentals(id) ON DELETE SET NULL, -- Pode ser NULL para custos gerais
  
  -- Dados do custo
  description varchar(255) NOT NULL,
  amount decimal(10, 2) NOT NULL,
  cost_date date NOT NULL,
  category varchar(50) NOT NULL CHECK (category IN ('cleaning', 'maintenance', 'utilities', 'supplies', 'staff', 'marketing', 'taxes', 'insurance', 'other')),
  
  -- Observações
  notes text,
  receipt_reference varchar(255), -- Número da nota fiscal, recibo, etc.
  
  -- Metadados
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rental_costs_rental ON public.rental_costs(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_costs_date ON public.rental_costs(cost_date);
CREATE INDEX IF NOT EXISTS idx_rental_costs_category ON public.rental_costs(category);

-- =====================================================
-- Políticas RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.external_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_costs ENABLE ROW LEVEL SECURITY;

-- Políticas para external_rentals
DROP POLICY IF EXISTS "Admins can view all external rentals" ON public.external_rentals;
CREATE POLICY "Admins can view all external rentals" 
  ON public.external_rentals FOR SELECT 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert external rentals" ON public.external_rentals;
CREATE POLICY "Admins can insert external rentals" 
  ON public.external_rentals FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update external rentals" ON public.external_rentals;
CREATE POLICY "Admins can update external rentals" 
  ON public.external_rentals FOR UPDATE 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete external rentals" ON public.external_rentals;
CREATE POLICY "Admins can delete external rentals" 
  ON public.external_rentals FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Políticas para rental_payments
DROP POLICY IF EXISTS "Admins can view all rental payments" ON public.rental_payments;
CREATE POLICY "Admins can view all rental payments" 
  ON public.rental_payments FOR SELECT 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert rental payments" ON public.rental_payments;
CREATE POLICY "Admins can insert rental payments" 
  ON public.rental_payments FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update rental payments" ON public.rental_payments;
CREATE POLICY "Admins can update rental payments" 
  ON public.rental_payments FOR UPDATE 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rental payments" ON public.rental_payments;
CREATE POLICY "Admins can delete rental payments" 
  ON public.rental_payments FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- Políticas para rental_costs
DROP POLICY IF EXISTS "Admins can view all rental costs" ON public.rental_costs;
CREATE POLICY "Admins can view all rental costs" 
  ON public.rental_costs FOR SELECT 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert rental costs" ON public.rental_costs;
CREATE POLICY "Admins can insert rental costs" 
  ON public.rental_costs FOR INSERT 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update rental costs" ON public.rental_costs;
CREATE POLICY "Admins can update rental costs" 
  ON public.rental_costs FOR UPDATE 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rental costs" ON public.rental_costs;
CREATE POLICY "Admins can delete rental costs" 
  ON public.rental_costs FOR DELETE 
  USING (public.is_admin(auth.uid()));

-- =====================================================
-- Funções auxiliares
-- =====================================================

-- Função para calcular o total recebido de uma locação
CREATE OR REPLACE FUNCTION public.get_rental_total_paid(rental_uuid uuid)
RETURNS decimal(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.rental_payments
  WHERE rental_id = rental_uuid;
$$;

-- Função para calcular o saldo pendente de uma locação
CREATE OR REPLACE FUNCTION public.get_rental_pending_balance(rental_uuid uuid)
RETURNS decimal(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT r.final_value - COALESCE(
    (SELECT SUM(amount) FROM public.rental_payments WHERE rental_id = rental_uuid), 
    0
  )
  FROM public.external_rentals r
  WHERE r.id = rental_uuid;
$$;

-- Função para obter resumo financeiro de um período
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  start_date date,
  end_date date
)
RETURNS TABLE (
  total_revenue decimal(10, 2),
  total_costs decimal(10, 2),
  net_balance decimal(10, 2),
  rentals_count bigint,
  payments_count bigint,
  costs_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE((
      SELECT SUM(amount) 
      FROM public.rental_payments 
      WHERE payment_date BETWEEN start_date AND end_date
    ), 0) as total_revenue,
    COALESCE((
      SELECT SUM(amount) 
      FROM public.rental_costs 
      WHERE cost_date BETWEEN start_date AND end_date
    ), 0) as total_costs,
    COALESCE((
      SELECT SUM(amount) 
      FROM public.rental_payments 
      WHERE payment_date BETWEEN start_date AND end_date
    ), 0) - COALESCE((
      SELECT SUM(amount) 
      FROM public.rental_costs 
      WHERE cost_date BETWEEN start_date AND end_date
    ), 0) as net_balance,
    (SELECT COUNT(*) FROM public.external_rentals WHERE rental_date BETWEEN start_date AND end_date) as rentals_count,
    (SELECT COUNT(*) FROM public.rental_payments WHERE payment_date BETWEEN start_date AND end_date) as payments_count,
    (SELECT COUNT(*) FROM public.rental_costs WHERE cost_date BETWEEN start_date AND end_date) as costs_count;
$$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_external_rental_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS external_rentals_updated_at ON public.external_rentals;
CREATE TRIGGER external_rentals_updated_at
  BEFORE UPDATE ON public.external_rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_external_rental_updated_at();

-- =====================================================
-- Comentários nas tabelas e colunas
-- =====================================================

COMMENT ON TABLE public.external_rentals IS 'Tabela de locações externas do espaço da igreja';
COMMENT ON TABLE public.rental_payments IS 'Pagamentos recebidos das locações externas';
COMMENT ON TABLE public.rental_costs IS 'Custos e despesas relacionados às locações';

COMMENT ON COLUMN public.external_rentals.status IS 'Status: pending (aguardando), confirmed (confirmado), completed (realizado), cancelled (cancelado)';
COMMENT ON COLUMN public.rental_payments.payment_method IS 'Método: pix, cash, credit_card, debit_card, bank_transfer, check, other';
COMMENT ON COLUMN public.rental_costs.category IS 'Categoria: cleaning, maintenance, utilities, supplies, staff, marketing, taxes, insurance, other';

-- =====================================================
-- Funções de verificação de conflitos
-- =====================================================

-- Função para verificar se há conflito com agendamentos internos
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
    WHERE b.environment_id = p_environment_id
      AND b.booking_date = p_date
      AND b.status != 'rejected'
      AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
      AND (
        (p_start_time < b.end_time AND p_end_time > b.start_time)
      )
  );
$$;

-- Função para verificar se há conflito com locações externas
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
    WHERE r.environment_id = p_environment_id
      AND r.rental_date = p_date
      AND r.status != 'cancelled'
      AND (p_exclude_rental_id IS NULL OR r.id != p_exclude_rental_id)
      AND (
        (p_start_time < r.end_time AND p_end_time > r.start_time)
      )
  );
$$;

-- Função para verificar conflitos em ambos os sistemas
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
    public.check_booking_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_booking_id) as has_booking_conflict,
    public.check_rental_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_rental_id) as has_rental_conflict,
    (
      public.check_booking_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_booking_id) 
      OR 
      public.check_rental_conflict(p_environment_id, p_date, p_start_time, p_end_time, p_exclude_rental_id)
    ) as has_any_conflict;
$$;

-- Função para obter todos os eventos de um ambiente em uma data (agendamentos + locações)
CREATE OR REPLACE FUNCTION public.get_environment_events(
  p_environment_id integer,
  p_date date
)
RETURNS TABLE (
  event_type text,
  event_id text,
  start_time time,
  end_time time,
  title text,
  status text
)
LANGUAGE sql
STABLE
AS $$
  -- Agendamentos internos
  SELECT 
    'booking'::text as event_type,
    b.id::text as event_id,
    b.start_time,
    b.end_time,
    b.name as title,
    b.status
  FROM public.bookings b
  WHERE b.environment_id = p_environment_id
    AND b.booking_date = p_date
    AND b.status != 'rejected'
  
  UNION ALL
  
  -- Locações externas
  SELECT 
    'rental'::text as event_type,
    r.id::text as event_id,
    r.start_time,
    r.end_time,
    r.renter_name || ' (Locação Externa)' as title,
    r.status
  FROM public.external_rentals r
  WHERE r.environment_id = p_environment_id
    AND r.rental_date = p_date
    AND r.status != 'cancelled'
  
  ORDER BY start_time;
$$;
