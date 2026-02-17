-- Migration: Payment Request Notifications Trigger
-- Description: Automatically notifies members when a new payment prompt is created.

-- 1. Create Function to Notify Members
CREATE OR REPLACE FUNCTION public.on_payment_request_created()
RETURNS TRIGGER AS $$
DECLARE
    member_record RECORD;
BEGIN
    -- This trigger handles both targeted and group-wide requests
    
    FOR member_record IN 
        SELECT user_id FROM public.chama_members 
        WHERE chama_id = NEW.chama_id 
        AND (NEW.target_member_ids IS NULL OR user_id = ANY(NEW.target_member_ids))
        AND user_id != NEW.created_by -- Don't notify the person who created it
    LOOP
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            metadata
        ) VALUES (
            member_record.user_id,
            'New Payment Request: ' || NEW.title,
            'Your group has a new payment request of KES ' || NEW.amount || '. Please check your dashboard.',
            'payment_request',
            jsonb_build_object(
                'chama_id', NEW.chama_id,
                'request_id', NEW.id,
                'amount', NEW.amount
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_payment_request_added ON public.payment_requests;
CREATE TRIGGER on_payment_request_added
AFTER INSERT ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_payment_request_created();
