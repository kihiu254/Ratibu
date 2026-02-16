-- Migration: Fix M-Pesa Triggers and Balance Updates
-- Description: Adds triggers to update Chama and Member balances when a transaction is completed.

-- 1. Create Function to Handle Successful Deposits
CREATE OR REPLACE FUNCTION public.handle_successful_deposit()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if status changed to 'completed' and it's a deposit/contribution
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND (NEW.type = 'deposit' OR NEW.type = 'contribution') THEN
        
        -- A. Update Chama Totals
        UPDATE public.chamas
        SET 
            balance = balance + NEW.amount,
            total_contributed = total_contributed + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.chama_id;

        -- B. Update Member Totals
        UPDATE public.chama_members
        SET 
            total_contribution = total_contribution + NEW.amount,
            contribution_count = contribution_count + 1
        WHERE chama_id = NEW.chama_id AND user_id = NEW.user_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger on Transactions Table
DROP TRIGGER IF EXISTS on_transaction_completed ON public.transactions;

CREATE TRIGGER on_transaction_completed
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_successful_deposit();

-- 3. Ensure RLS allows Edge Functions to update transactions (Service Role bypasses RLS, but just in case)
-- (No action needed as Edge Functions use Service Role Key)
