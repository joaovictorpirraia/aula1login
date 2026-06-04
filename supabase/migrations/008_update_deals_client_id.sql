-- supabase/migrations/008_update_deals_client_id.sql
ALTER TABLE deals ALTER COLUMN client_name DROP NOT NULL;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);

CREATE OR REPLACE FUNCTION check_deal_client_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'client_id must reference a client owned by the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_deal_client_ownership
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION check_deal_client_ownership();
