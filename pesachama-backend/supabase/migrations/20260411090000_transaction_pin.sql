ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS transaction_pin_hash TEXT,
ADD COLUMN IF NOT EXISTS transaction_pin_salt TEXT,
ADD COLUMN IF NOT EXISTS transaction_pin_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS transaction_pin_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transaction_pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_pin_locked_until TIMESTAMPTZ;
