-- supabase/migrations/002_create_monthly_goals.sql
CREATE TABLE IF NOT EXISTS monthly_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  month       date NOT NULL,
  goal_value  numeric(12, 2) NOT NULL,
  CONSTRAINT uq_user_month UNIQUE (user_id, month),
  CONSTRAINT chk_month_first_day CHECK (month = date_trunc('month', month)::date)
);
