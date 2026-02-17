-- Manually create balance_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.balance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    
    -- Account Balances (from Safaricom callback)
    utility_balance DECIMAL(15, 2),
    working_balance DECIMAL(15, 2),
    charges_paid_balance DECIMAL(15, 2),
    
    -- Metadata
    originator_conversation_id VARCHAR(100),
    conversation_id VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_balance_history_chama_id ON public.balance_history(chama_id);

ALTER TABLE public.balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view balance history" ON public.balance_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chama_members cm 
            WHERE cm.chama_id = balance_history.chama_id 
            AND cm.user_id = auth.uid() 
            AND cm.role IN ('admin', 'treasurer')
        )
    );
