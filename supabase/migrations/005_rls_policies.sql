-- supabase/migrations/005_rls_policies.sql

-- === deals table ===
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals: leitura própria"
  ON deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deals: escrita própria"
  ON deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals: atualização própria"
  ON deals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE on deals: no policy defined.
-- With RLS enabled, absence of a DELETE policy = implicit DENY for all non-superuser roles.
-- This is INTENTIONAL: deleting deals is out of scope for this version.
-- To enable deletion in a future version, add an explicit policy here.

-- === monthly_goals table ===
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: leitura própria"
  ON monthly_goals FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT, UPDATE and DELETE on monthly_goals: no policy defined.
-- Absence of policy = implicit DENY for authenticated users.
-- Write operations require the service role key, which bypasses RLS by design in PostgREST.
-- DO NOT add INSERT/UPDATE/DELETE policies here — that would open the table to all users.
-- Explanation: The service role JWT grants the 'service_role' database role, which has
-- BYPASSRLS privilege in Supabase's default config. This means RLS policies are not
-- evaluated. Admin scripts use this to write goals without needing an explicit policy.
