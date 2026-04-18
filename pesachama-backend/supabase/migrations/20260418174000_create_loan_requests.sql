-- Loan requests table for the Loans hub

CREATE TABLE IF NOT EXISTS public.loan_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    borrower_id UUID REFERENCES profiles(id) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    purpose TEXT NOT NULL,
    term_months INT DEFAULT 3,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed')) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loan_requests_borrower_id ON public.loan_requests(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loan_requests_status ON public.loan_requests(status);

ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their loan requests' AND tablename = 'loan_requests'
) THEN
    CREATE POLICY "Users can view their loan requests" ON public.loan_requests
    FOR SELECT USING (auth.uid() = borrower_id);
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their loan requests' AND tablename = 'loan_requests'
) THEN
    CREATE POLICY "Users can create their loan requests" ON public.loan_requests
    FOR INSERT WITH CHECK (auth.uid() = borrower_id);
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their loan requests' AND tablename = 'loan_requests'
) THEN
    CREATE POLICY "Users can update their loan requests" ON public.loan_requests
    FOR UPDATE USING (auth.uid() = borrower_id);
END IF; END $$;

