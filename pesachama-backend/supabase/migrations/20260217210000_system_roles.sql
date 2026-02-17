-- Migration: System Roles & Super Admin
-- Description: Adds system_role column and promotes initial super admin.

-- 1. Add system_role to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) DEFAULT 'user' CHECK (system_role IN ('user', 'support', 'admin', 'super_admin'));

-- 2. Update RLS on users table for system admins
-- System admins should be able to see all user records
DROP POLICY IF EXISTS "System admins can view all profiles" ON public.users;
CREATE POLICY "System admins can view all profiles" 
ON public.users FOR SELECT 
USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND system_role IN ('admin', 'super_admin')
  )
);

-- 3. Promote initial super admin
UPDATE public.users 
SET system_role = 'super_admin' 
WHERE email = '1kihiupaul@gmail.com';

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_system_role ON public.users(system_role);
