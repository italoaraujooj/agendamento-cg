-- Create environments table for church spaces
CREATE TABLE IF NOT EXISTS environments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table for reservations
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  ministry_network VARCHAR(255) NOT NULL,
  estimated_participants INTEGER NOT NULL,
  responsible_person VARCHAR(255) NOT NULL,
  occasion TEXT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no overlapping bookings for the same environment
  CONSTRAINT no_overlap EXCLUDE USING gist (
    environment_id WITH =,
    booking_date WITH =,
    tsrange(start_time::text, end_time::text) WITH &&
  )
);

-- Insert default environments
INSERT INTO environments (name, description, capacity) VALUES
('Salão Principal', 'Salão principal da igreja para eventos grandes', 200),
('Sala de Reuniões 1', 'Sala pequena para reuniões e estudos', 20),
('Sala de Reuniões 2', 'Sala média para grupos e ministérios', 40),
('Sala Infantil', 'Sala dedicada para atividades infantis', 30)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_environment_date ON bookings(environment_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(booking_date, start_time, end_time);
