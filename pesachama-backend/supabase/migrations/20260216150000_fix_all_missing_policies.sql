-- Migration to fix missing RLS policies for members, chamas, and transactions

-- 1. CHAMA MEMBERS POLICIES

-- Allow users to add themselves to chamas they created (Chairman/Admin role)
CREATE POLICY "Users can join chamas they created" 
ON public.chama_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND 
  EXISTS (
    SELECT 1 FROM public.chamas 
    WHERE id = chama_id AND created_by = auth.uid()
  )
);

-- Allow admins to update member roles or status
CREATE POLICY "Admins can update members" 
ON public.chama_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.chama_members cm 
    WHERE cm.chama_id = chama_members.chama_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- 2. CHAMAS UPDATE POLICY

-- Allow creators/admins to update chama details
CREATE POLICY "Admins can update chama details" 
ON public.chamas 
FOR UPDATE 
USING (
  created_by = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.chama_members cm 
    WHERE cm.chama_id = chamas.id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'admin'
  )
);

-- 3. TRANSACTIONS INSERT POLICY

-- Allow members to create transactions (deposits/withdrawals)
CREATE POLICY "Members can create transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND 
  is_member_of_chama(chama_id)
);
