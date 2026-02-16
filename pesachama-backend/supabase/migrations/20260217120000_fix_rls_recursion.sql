-- Migration: Fix RLS Infinite Recursion
-- Description: Introduces a SECURITY DEFINER function to check chama membership without triggering RLS recursion.

-- 1. Helper Function (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_chama_member(_chama_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chama_members
    WHERE chama_id = _chama_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Chama Members Policy
DROP POLICY IF EXISTS "Members can view other members in their chama" ON public.chama_members;
CREATE POLICY "Members can view other members in their chama" ON public.chama_members FOR SELECT USING (
    auth.uid() = user_id OR 
    public.is_chama_member(chama_id)
);

-- 3. Update Transactions Policy
DROP POLICY IF EXISTS "Users can view their transactions" ON public.transactions;
CREATE POLICY "Users can view their transactions" ON public.transactions FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = transactions.chama_id 
        AND cm.user_id = auth.uid() 
        AND (cm.role = 'admin' OR cm.role = 'treasurer')
    )
);
