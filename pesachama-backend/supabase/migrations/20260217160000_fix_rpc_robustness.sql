-- Migration: Update Payment Visibility Helper
-- Description: Makes the function more robust and supports multiple transaction types.

CREATE OR REPLACE FUNCTION public.get_payment_prompt_status(prompt_id UUID)
RETURNS TABLE (
    user_id UUID,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    status TEXT, -- 'paid', 'pending'
    amount_paid DECIMAL(15, 2),
    paid_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.user_id,
        u.first_name,
        u.last_name,
        u.phone,
        CASE 
            WHEN t.id IS NOT NULL THEN 'paid'
            ELSE 'pending'
        END as status,
        COALESCE(t.amount, 0) as amount_paid,
        t.completed_at as paid_at
    FROM 
        public.chama_members cm
    JOIN 
        public.payment_requests pr ON pr.chama_id = cm.chama_id
    JOIN 
        public.users u ON u.id = cm.user_id
    LEFT JOIN 
        public.transactions t ON t.chama_id = cm.chama_id 
            AND t.user_id = cm.user_id 
            AND (t.type = 'contribution' OR t.type = 'deposit')
            AND t.status = 'completed'
            AND (
                (t.metadata->>'payment_request_id' IS NOT NULL AND (t.metadata->>'payment_request_id')::UUID = pr.id)
                OR
                (t.metadata->>'payment_request_id' IS NULL AND t.amount = pr.amount AND t.created_at >= pr.created_at)
            )
    WHERE 
        pr.id = prompt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
