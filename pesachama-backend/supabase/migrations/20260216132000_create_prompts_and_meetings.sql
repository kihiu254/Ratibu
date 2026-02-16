-- Meetings Table
DROP TABLE IF EXISTS public.meetings CASCADE;
DROP TABLE IF EXISTS public.payment_requests CASCADE;

CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    venue VARCHAR(255), -- "Online" or Physical Address
    video_link VARCHAR(500), -- Google Meet / Zoom link
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meetings_chama_id ON public.meetings(chama_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON public.meetings(date);

-- Payment Requests (Prompts) Table
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    title VARCHAR(255) NOT NULL, -- e.g. "February Contribution"
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_chama_id ON public.payment_requests(chama_id);

-- Payment Request Status (Per Member Tracking) - OPTIONAL for now, 
-- we can just assume if a transaction exists, they paid. 
-- But for "Prompts", we might want to track "Seen" or "Dismissed".
-- For simplicity in Phase 3, we will just show the Prompt if no valid contribution exists for this 'period'.
-- But to keep it simple, let's just show all active prompts.

-- RLS Policies

-- Meetings
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view meetings" ON public.meetings FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = meetings.chama_id AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can create meetings" ON public.meetings FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = meetings.chama_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer', 'secretary')
    )
);

-- Payment Requests
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payment requests" ON public.payment_requests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = payment_requests.chama_id AND cm.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can create payment requests" ON public.payment_requests FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = payment_requests.chama_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer')
    )
);
