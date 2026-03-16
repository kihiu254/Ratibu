-- Add otp_verified_at to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ;
