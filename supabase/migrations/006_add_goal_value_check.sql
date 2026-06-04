-- supabase/migrations/006_add_goal_value_check.sql
-- Prevents goal_value = 0 which causes a division-by-zero in the progress bar.
ALTER TABLE monthly_goals
  ADD CONSTRAINT chk_goal_value_positive CHECK (goal_value > 0);
