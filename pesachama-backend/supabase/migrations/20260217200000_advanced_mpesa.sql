-- Migration: Advanced M-Pesa Features (B2C & Balance)
-- Description: Adds tables for payouts (withdrawals) and account balance tracking.

-- 1. Payouts Table (Business to Customer)
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Transaction Details
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, initiated, completed, failed
    
    -- Safaricom Identifiers
    originator_conversation_id VARCHAR(100) UNIQUE,
    conversation_id VARCHAR(100),
    transaction_id VARCHAR(100), -- M-Pesa Receipt Number
    
    -- Metadata
    remarks TEXT,
    result_code VARCHAR(20),
    result_desc TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_payouts_chama_id ON public.payouts(chama_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_originator_id ON public.payouts(originator_conversation_id);

-- 2. Balance History Table
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

-- 3. Update Chamas Table for B2C
-- No changes needed as chamas already have balance and setting fields.

-- 4. DB Functions
CREATE OR REPLACE FUNCTION public.decrement_chama_balance(chama_id_param UUID, amount_param DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.chamas
    SET 
        balance = balance - amount_param,
        total_disbursed = total_disbursed + amount_param,
        updated_at = NOW()
    WHERE id = chama_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_history ENABLE ROW LEVEL SECURITY;

-- Payouts policies
CREATE POLICY "Users can view their own payouts" ON public.payouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts for their chama" ON public.payouts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chama_members cm 
            WHERE cm.chama_id = payouts.chama_id 
            AND cm.user_id = auth.uid() 
            AND cm.role IN ('admin', 'treasurer')
        )
    );

-- Balance history policies
CREATE POLICY "Admins can view balance history" ON public.balance_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chama_members cm 
            WHERE cm.chama_id = balance_history.chama_id 
            AND cm.user_id = auth.uid() 
            AND cm.role IN ('admin', 'treasurer')
        )
    );
