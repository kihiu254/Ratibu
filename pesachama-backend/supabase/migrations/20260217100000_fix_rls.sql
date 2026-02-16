-- Migration: Fix RLS for Chamas and Members
-- Description: Ensures authenticated users can view chamas and members, and Edge Functions can bypass RLS if needed (though they use service role).

-- 1. Chamas Policies
DROP POLICY IF EXISTS "Chamas are viewable by everyone" ON public.chamas;
CREATE POLICY "Chamas are viewable by everyone" ON public.chamas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create chamas" ON public.chamas;
CREATE POLICY "Authenticated users can create chamas" ON public.chamas FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 2. Chama Members Policies
DROP POLICY IF EXISTS "Members can view other members in their chama" ON public.chama_members;
CREATE POLICY "Members can view other members in their chama" ON public.chama_members FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = chama_members.chama_id AND cm.user_id = auth.uid()
    )
);

-- 3. Transactions Policies (Ensure own transactions are viewable)
DROP POLICY IF EXISTS "Users can view their transactions" ON public.transactions;
CREATE POLICY "Users can view their transactions" ON public.transactions FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = transactions.chama_id AND cm.user_id = auth.uid() AND (cm.role = 'admin' OR cm.role = 'treasurer')
    )
);
