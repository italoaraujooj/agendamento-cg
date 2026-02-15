-- Adiciona líder e co-líder a nível de ministério
ALTER TABLE ministries ADD COLUMN leader_id uuid REFERENCES servants(id) ON DELETE SET NULL;
ALTER TABLE ministries ADD COLUMN co_leader_id uuid REFERENCES servants(id) ON DELETE SET NULL;
