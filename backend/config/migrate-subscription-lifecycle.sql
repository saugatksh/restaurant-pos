-- ============================================================
-- Migration: Subscription Lifecycle Management
-- Run once on your existing database.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- 1. Ensure is_active column exists (already in schema, but safe guard)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Immediately deactivate any restaurant whose subscription has already expired
--    DATA IS PRESERVED — only the is_active flag changes.
UPDATE restaurants
SET is_active = false
WHERE subscription_end < CURRENT_DATE
  AND is_active = true;

-- 3. Reactivate any restaurant that was manually set inactive but now has a valid
--    subscription window (handles the "renew and reactivate" use case).
--    This runs at migration time; the /renew API endpoint handles it going forward.
UPDATE restaurants
SET is_active = true
WHERE subscription_start <= CURRENT_DATE
  AND subscription_end >= CURRENT_DATE
  AND is_active = false;

-- 4. Optional: create a PostgreSQL function for the daily cron sync
--    so you can call SELECT sync_subscription_status(); from pg_cron or a job.
CREATE OR REPLACE FUNCTION sync_subscription_status()
RETURNS TABLE(action TEXT, restaurant_id INT, restaurant_name TEXT) AS $$
BEGIN
  -- Deactivate expired
  RETURN QUERY
    UPDATE restaurants
    SET is_active = false
    WHERE subscription_end < CURRENT_DATE
      AND is_active = true
    RETURNING 'deactivated'::TEXT, id, name;

  -- Reactivate renewed
  RETURN QUERY
    UPDATE restaurants
    SET is_active = true
    WHERE subscription_start <= CURRENT_DATE
      AND subscription_end >= CURRENT_DATE
      AND is_active = false
    RETURNING 'reactivated'::TEXT, id, name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HOW SUBSCRIPTION LIFECYCLE WORKS (after this migration)
-- ============================================================
-- 1. ACTIVE:    subscription_start <= today <= subscription_end, is_active=true
--              → All staff can log in, all APIs work normally.
--
-- 2. EXPIRED:   subscription_end < today  OR  is_active=false
--              → Login blocked with "subscription_inactive: true" flag.
--              → All protected API routes return 403 with subscription_inactive: true.
--              → ALL DATA (menu, orders, staff, inventory) remains in the database.
--
-- 3. RENEWED:   Super Admin calls POST /super-admin/restaurants/:id/renew
--              with new subscription_start and subscription_end.
--              → is_active is set to true automatically.
--              → Staff can log in again immediately.
--              → All previous data is accessible as before — nothing is reset.
-- ============================================================
