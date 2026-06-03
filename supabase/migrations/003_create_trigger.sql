-- supabase/migrations/003_create_trigger.sql
CREATE OR REPLACE FUNCTION set_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Short-circuit: if status did not change on UPDATE, do nothing
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('won', 'lost') THEN
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    NEW.closed_date := (NEW.closed_at AT TIME ZONE 'UTC')::date;
    NEW.updated_at  := now();
  ELSIF NEW.status = 'open' THEN
    -- Deal reopened: clear close fields
    NEW.closed_at   := NULL;
    NEW.closed_date := NULL;
    NEW.updated_at  := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_closed_at
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION set_closed_at();
