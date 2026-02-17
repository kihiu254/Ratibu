-- Migration: Allow Admins to Manage Users
-- Description: Adds RLS policies for admins to update and delete user records.

-- 1. Policy: System admins can update any profile
CREATE POLICY "System admins can update all profiles" 
ON public.users FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND system_role IN ('admin', 'super_admin')
  )
);

-- 2. Policy: System admins can delete any profile
CREATE POLICY "System admins can delete all profiles" 
ON public.users FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND system_role IN ('admin', 'super_admin')
  )
);
