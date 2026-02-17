-- Migration: Admin Enhancements
-- 1. Update chama_members role constraint to include 'secretary'
ALTER TABLE public.chama_members DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE public.chama_members ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'treasurer', 'secretary', 'member'));

-- 2. Add target_member_ids to payment_requests
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS target_member_ids UUID[] DEFAULT NULL;

-- 3. Update RLS for payment_requests to handle targeting
DROP POLICY IF EXISTS "Members can view payment requests" ON public.payment_requests;
CREATE POLICY "Members can view payment requests" ON public.payment_requests 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = payment_requests.chama_id AND cm.user_id = auth.uid()
    ) 
    AND (
        target_member_ids IS NULL 
        OR auth.uid() = ANY(target_member_ids)
        -- Admin/Treasurer/Secretary can see all prompts in their chama
        OR EXISTS (
            SELECT 1 FROM public.chama_members cm 
            WHERE cm.chama_id = payment_requests.chama_id 
            AND cm.user_id = auth.uid() 
            AND cm.role IN ('admin', 'treasurer', 'secretary')
        )
    )
);

-- Update Insert policy for payment_requests to include secretary
DROP POLICY IF EXISTS "Admins can create payment requests" ON public.payment_requests;
CREATE POLICY "Admins can create payment requests" ON public.payment_requests FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = payment_requests.chama_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer', 'secretary')
    )
);
