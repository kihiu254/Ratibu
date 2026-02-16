-- Final RLS Recursion Fix
-- This migration should be applied to fix the "infinite recursion" error in chama_members

-- 1. Create a security definer function to check membership safely
CREATE OR REPLACE FUNCTION public.check_is_member(_chama_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.chama_members 
    WHERE chama_id = _chama_id 
    AND user_id = _user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up old policies
DROP POLICY IF EXISTS "chama_members_select_policy" ON public.chama_members;
DROP POLICY IF EXISTS "Members can view other members in their chama" ON public.chama_members;

-- 3. Implement non-recursive SELECT policy
CREATE POLICY "chama_members_read_policy" 
ON public.chama_members 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  check_is_member(chama_id, auth.uid())
);

-- 4. Transactions Policy Fix
DROP POLICY IF EXISTS "Members can view transactions in their chama" ON public.transactions;
CREATE POLICY "transactions_read_policy" 
ON public.transactions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  check_is_member(chama_id, auth.uid())
);

-- 5. Ensure Chamas are public (for discovery)
DROP POLICY IF EXISTS "Chamas are viewable by everyone" ON public.chamas;
CREATE POLICY "chamas_read_policy" 
ON public.chamas 
FOR SELECT 
USING (true);
