-- Add lock savings fields
ALTER TABLE public.user_savings_targets
  ADD COLUMN IF NOT EXISTS is_locked        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_period_months INT        CHECK (lock_period_months > 0),
  ADD COLUMN IF NOT EXISTS lock_until       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_started_at  TIMESTAMPTZ;

-- Update status check to include 'locked'
ALTER TABLE public.user_savings_targets
  DROP CONSTRAINT IF EXISTS user_savings_targets_status_check;

ALTER TABLE public.user_savings_targets
  ADD CONSTRAINT user_savings_targets_status_check
    CHECK (status IN ('active', 'paused', 'completed', 'locked'));

-- Ensure lock_until is set when is_locked = true
ALTER TABLE public.user_savings_targets
  ADD CONSTRAINT savings_lock_consistency
    CHECK (
      (is_locked = false) OR
      (is_locked = true AND lock_until IS NOT NULL AND lock_period_months IS NOT NULL)
    );
