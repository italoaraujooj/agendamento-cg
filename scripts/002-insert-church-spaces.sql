-- Clear existing default data
DELETE FROM environments WHERE name IN ('Salão Principal', 'Sala de Reuniões 1', 'Sala de Reuniões 2', 'Sala Infantil');

-- Insert specific church spaces with correct information
INSERT INTO environments (name, description, capacity) VALUES
(
  'Sala 1',
  'Sala térreo com TV ao lado do banheiro PCD. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h',
  30
),
(
  'Sala 2', 
  'Sala térreo com TV no corredor à esquerda após a recepção. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h',
  30
),
(
  'Sala 3',
  'Primeira sala no primeiro andar à direita da escada. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h', 
  20
),
(
  'Sala 4',
  'Segunda sala no primeiro andar à direita da escada. Disponível: Domingo 13h-17h, Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h',
  20
),
(
  'Salão Principal',
  'Salão principal e mezanino. Disponível: Segunda/Terça/Quinta/Sexta/Sábado 8h-22h, Quarta 8h-17h',
  500
)
ON CONFLICT DO NOTHING;
