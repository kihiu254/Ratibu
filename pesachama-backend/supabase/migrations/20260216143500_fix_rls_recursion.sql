-- Fix for infinite recursion in RLS policy for chama_members

-- 1. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Members can view other members in their chama" ON public.chama_members;

-- 2. Create a SECURITY DEFINER function to check membership without triggering RLS
-- This function runs with the privileges of the creator (postgres/admin), bypassing RLS
CREATE OR REPLACE FUNCTION public.is_member_of_chama(_chama_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.chama_members 
    WHERE chama_id = _chama_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create the policy using the function
CREATE POLICY "Members can view other members in their chama" 
ON public.chama_members 
FOR SELECT 
USING (
  -- Users can always see their own membership record
  auth.uid() = user_id 
  OR 
  -- Users can see other members if they belong to the same chama
  is_member_of_chama(chama_id)
);
