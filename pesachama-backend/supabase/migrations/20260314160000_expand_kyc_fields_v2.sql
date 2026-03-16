-- Migration: Expand KYC details in users table (v2)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS income_source TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sub_county TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Update valid_kyc_status constraint if it exists, or just ensure kyc_status logic remains valid
-- Current status: 'not_started', 'pending', 'verified', 'rejected'
ALTER TABLE public.users ALTER COLUMN kyc_status SET DEFAULT 'not_started';
