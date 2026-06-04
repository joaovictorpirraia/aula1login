-- supabase/migrations/007_create_clients.sql
CREATE TABLE IF NOT EXISTS clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  name        text NOT NULL,
  company     text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: leitura própria"
  ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clients: escrita própria"
  ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients: atualização própria"
  ON clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients: deleção própria"
  ON clients FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_email
  ON clients (user_id, email) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION set_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION set_clients_updated_at();
