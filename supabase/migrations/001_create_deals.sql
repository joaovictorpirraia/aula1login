-- supabase/migrations/001_create_deals.sql
CREATE TABLE IF NOT EXISTS deals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  client_name  text NOT NULL,
  value        numeric(12, 2) NOT NULL,
  status       text NOT NULL CHECK (status IN ('open', 'won', 'lost')),
  created_at   timestamp DEFAULT now(),
  closed_at    timestamp,
  closed_date  date,
  updated_at   timestamp DEFAULT now()
);
