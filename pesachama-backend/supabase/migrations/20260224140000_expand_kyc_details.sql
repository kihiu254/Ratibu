-- Migration: Expand KYC details in users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kra_pin TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS next_of_kin_relation TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS category_other_specification TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS middle_name TEXT;
