-- Create security_otps table
CREATE TABLE IF NOT EXISTS public.security_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.security_otps ENABLE ROW LEVEL SECURITY;

-- Policies
-- Service role has full access (used by Edge Functions)
-- We don't necessarily need user-level policies if only Edge Functions (service_role) interact with this table.
-- But for safety, let's allow users to see their own OTPs (though they won't usually need to)
CREATE POLICY "Users can view their own OTPs" ON public.security_otps
    FOR SELECT USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_security_otps_email ON public.security_otps(email);
CREATE INDEX IF NOT EXISTS idx_security_otps_user_id ON public.security_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_security_otps_expires_at ON public.security_otps(expires_at);

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION clean_expired_otps() RETURNS void AS $$
BEGIN
    DELETE FROM public.security_otps WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;
