-- Migration: M-Pesa Ratiba Standing Orders
-- Description: Table to track automated recurring contributions.

CREATE TABLE IF NOT EXISTS public.standing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    
    -- Standing Order Details
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    frequency VARCHAR(50) NOT NULL, -- '1' (One Off), '2' (Daily), '3' (Weekly), '4' (Monthly), etc.
    
    -- Schedule
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Status & M-Pesa Info
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'cancelled', 'failed'
    mpesa_response_id TEXT, -- responseRefID from Safaricom
    mpesa_transaction_id TEXT, -- TransactionID from callback
    
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
ALTER TABLE public.standing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own standing orders" 
ON public.standing_orders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Treasurers/Admins can view all standing orders in their chama" 
ON public.standing_orders FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.chama_members 
        WHERE chama_id = standing_orders.chama_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'treasurer')
    )
);

-- Trigger for updated_at
CREATE TRIGGER set_standing_orders_updated_at
BEFORE UPDATE ON public.standing_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
