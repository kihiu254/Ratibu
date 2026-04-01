CREATE TABLE IF NOT EXISTS public.user_savings_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'custom',
    destination_label TEXT,
    target_amount DECIMAL(15, 2) NOT NULL CHECK (target_amount > 0),
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
    auto_allocate BOOLEAN NOT NULL DEFAULT true,
    allocation_type TEXT NOT NULL DEFAULT 'percentage',
    allocation_value DECIMAL(15, 2) NOT NULL DEFAULT 100 CHECK (allocation_value > 0),
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_savings_targets_purpose_check CHECK (
        purpose IN (
            'emergency',
            'rent',
            'daily_payments',
            'bill_payment',
            'school_fees',
            'business',
            'investment',
            'withdrawal',
            'custom'
        )
    ),
    CONSTRAINT user_savings_targets_allocation_type_check CHECK (
        allocation_type IN ('percentage', 'fixed_amount')
    ),
    CONSTRAINT user_savings_targets_status_check CHECK (
        status IN ('active', 'paused', 'completed')
    )
);

CREATE INDEX IF NOT EXISTS idx_user_savings_targets_user_id
    ON public.user_savings_targets(user_id);

CREATE INDEX IF NOT EXISTS idx_user_savings_targets_status
    ON public.user_savings_targets(status);

ALTER TABLE public.user_savings_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own savings targets"
    ON public.user_savings_targets;
CREATE POLICY "Users can view their own savings targets"
    ON public.user_savings_targets
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own savings targets"
    ON public.user_savings_targets;
CREATE POLICY "Users can create their own savings targets"
    ON public.user_savings_targets
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own savings targets"
    ON public.user_savings_targets;
CREATE POLICY "Users can update their own savings targets"
    ON public.user_savings_targets
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own savings targets"
    ON public.user_savings_targets;
CREATE POLICY "Users can delete their own savings targets"
    ON public.user_savings_targets
    FOR DELETE
    USING (auth.uid() = user_id);
