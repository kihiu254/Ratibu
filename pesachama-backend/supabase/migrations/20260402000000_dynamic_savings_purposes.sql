-- Lookup table for known purposes (auto-populated, not enforced as constraint)
CREATE TABLE IF NOT EXISTS public.savings_purposes (
    purpose TEXT PRIMARY KEY,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the original built-in purposes
INSERT INTO public.savings_purposes (purpose, is_default) VALUES
    ('emergency',     true),
    ('rent',          true),
    ('daily_payments',true),
    ('bill_payment',  true),
    ('school_fees',   true),
    ('business',      true),
    ('investment',    true),
    ('withdrawal',    true),
    ('custom',        true)
ON CONFLICT DO NOTHING;

-- Drop the hard check constraint so any purpose value is accepted
ALTER TABLE public.user_savings_targets
    DROP CONSTRAINT IF EXISTS user_savings_targets_purpose_check;

-- Trigger: auto-register unknown purposes into the lookup table
CREATE OR REPLACE FUNCTION public.register_savings_purpose()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.savings_purposes (purpose)
    VALUES (NEW.purpose)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_register_savings_purpose ON public.user_savings_targets;
CREATE TRIGGER trg_register_savings_purpose
    BEFORE INSERT OR UPDATE OF purpose ON public.user_savings_targets
    FOR EACH ROW EXECUTE FUNCTION public.register_savings_purpose();

-- RLS for savings_purposes (read-only for all authenticated users)
ALTER TABLE public.savings_purposes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read savings purposes" ON public.savings_purposes;
CREATE POLICY "Anyone can read savings purposes"
    ON public.savings_purposes FOR SELECT
    USING (auth.role() = 'authenticated');
