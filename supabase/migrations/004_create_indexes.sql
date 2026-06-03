-- supabase/migrations/004_create_indexes.sql

-- Total Sales card and chart: filter by user_id + status + range on closed_date
CREATE INDEX IF NOT EXISTS idx_deals_user_status_date
  ON deals (user_id, status, closed_date);

-- Recent deals table: ORDER BY created_at DESC per user
-- Note: this index is NOT redundant with idx_deals_user_status_date
-- because the recent deals query sorts by created_at, not closed_date
CREATE INDEX IF NOT EXISTS idx_deals_user_created
  ON deals (user_id, created_at DESC);
