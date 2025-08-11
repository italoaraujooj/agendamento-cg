-- Criar tabela de ambientes
CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  capacity INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de reservas
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  ministry VARCHAR(100) NOT NULL,
  estimated_participants INTEGER NOT NULL,
  responsible_person VARCHAR(100) NOT NULL,
  occasion TEXT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Removendo constraint problemática com tsrange
  -- A validação de sobreposição será feita no código da aplicação
  UNIQUE(environment_id, booking_date, start_time)
);

-- Limpar dados existentes (se houver)
DELETE FROM bookings;
DELETE FROM environments;

-- Inserir os ambientes específicos da igreja
INSERT INTO environments (name, capacity, description) VALUES
('Sala 1', 30, 'Sala térreo com TV ao lado do banheiro PCD. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h'),
('Sala 2', 30, 'Sala térreo com TV no corredor à esquerda após a recepção. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h'),
('Sala 3', 20, 'Primeira sala no primeiro andar à direita da escada. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h'),
('Sala 4', 20, 'Segunda sala no primeiro andar à direita da escada. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h'),
('Salão Principal', 500, 'Salão principal e mezanino. Disponível: Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h');
