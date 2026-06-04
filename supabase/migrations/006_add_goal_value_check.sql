-- supabase/migrations/006_add_goal_value_check.sql
-- Prevents goal_value <= 0 which causes division-by-zero in the progress bar.
--
-- Uses NOT VALID so the migration does not fail if existing rows violate the constraint.
-- After cleaning up any bad rows (DELETE FROM monthly_goals WHERE goal_value <= 0),
-- run the validation step below to fully enforce the constraint on existing data:
--   ALTER TABLE monthly_goals VALIDATE CONSTRAINT chk_goal_value_positive;
ALTER TABLE monthly_goals
  ADD CONSTRAINT chk_goal_value_positive CHECK (goal_value > 0) NOT VALID;
