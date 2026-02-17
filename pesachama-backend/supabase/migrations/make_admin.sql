-- 1. Ensure the column exists (in case migration wasn't applied)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) DEFAULT 'user' CHECK (system_role IN ('user', 'support', 'admin', 'super_admin'));

-- 2. Make an email "system admin"
-- Replace 'YOUR_EMAIL@EXAMPLE.COM' with the actual email address
UPDATE public.users
SET system_role = 'admin'  -- or 'super_admin'
WHERE email = 'YOUR_EMAIL@EXAMPLE.COM';

-- Verify the update
SELECT id, email, system_role FROM public.users WHERE email = 'YOUR_EMAIL@EXAMPLE.COM';
