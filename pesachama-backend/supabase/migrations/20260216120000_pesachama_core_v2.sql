-- PesaChama Core Schema V2
-- Based on Master Implementation Plan

-- 1. ENUMS
CREATE TYPE kyc_status_enum AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE chama_role_enum AS ENUM ('chairman', 'treasurer', 'secretary', 'member');
CREATE TYPE transaction_type_enum AS ENUM ('transfer', 'contribution', 'withdrawal', 'loan_disbursement', 'loan_repayment');
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'success', 'failed');
CREATE TYPE meeting_frequency_enum AS ENUM ('weekly', 'biweekly', 'monthly');

-- 2. PROFILES (Update existing table)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS national_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS kra_pin TEXT,
ADD COLUMN IF NOT EXISTS kyc_status kyc_status_enum DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE;

-- 3. CHAMAS (Rename groups -> chamas and update)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'groups') THEN
    ALTER TABLE groups RENAME TO chamas;
  END IF;
END $$;

ALTER TABLE chamas 
ADD COLUMN IF NOT EXISTS registration_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS total_members INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_savings DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
ADD COLUMN IF NOT EXISTS meeting_frequency meeting_frequency_enum DEFAULT 'monthly';

-- 4. CHAMA MEMBERS (Rename group_members -> chama_members and update)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_members') THEN
    ALTER TABLE group_members RENAME TO chama_members;
    ALTER TABLE chama_members RENAME COLUMN group_id TO chama_id;
  END IF;
END $$;

ALTER TABLE chama_members
DROP CONSTRAINT IF EXISTS group_members_group_id_fkey,
ADD CONSTRAINT chama_members_chama_id_fkey FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE;

-- 5. CONTRIBUTIONS (Update FK)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contributions' AND column_name = 'group_id') THEN
        ALTER TABLE contributions RENAME COLUMN group_id TO chama_id;
    END IF;
END $$;

ALTER TABLE contributions
DROP CONSTRAINT IF EXISTS contributions_group_id_fkey,
ADD CONSTRAINT contributions_chama_id_fkey FOREIGN KEY (chama_id) REFERENCES chamas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 6. TRANSACTIONS (New Table)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID REFERENCES profiles(id),
    to_user_id UUID REFERENCES profiles(id),
    chama_id UUID REFERENCES chamas(id),
    amount DECIMAL(15,2) NOT NULL,
    type transaction_type_enum NOT NULL,
    status transaction_status_enum DEFAULT 'pending',
    description TEXT,
    mpesa_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. LOANS (New Table)
CREATE TABLE IF NOT EXISTS loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chama_id UUID REFERENCES chamas(id) NOT NULL,
    borrower_id UUID REFERENCES profiles(id) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    interest_rate DECIMAL(5,2) DEFAULT 0,
    duration_months INT DEFAULT 1,
    status TEXT CHECK (status IN ('pending', 'approved', 'active', 'repaid', 'defaulted')) DEFAULT 'pending',
    disbursement_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. MPESA PAYMENTS (New Table)
CREATE TABLE IF NOT EXISTS mpesa_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id),
    phone_number TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    mpesa_receipt_id TEXT UNIQUE,
    checkout_request_id TEXT UNIQUE,
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    result_desc TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. USSD SESSIONS (New Table)
CREATE TABLE IF NOT EXISTS ussd_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    menu_level TEXT DEFAULT 'main',
    menu_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 10. AUDIT LOGS (New Table)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. SAVINGS GOALS (New Table)
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    name TEXT NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    deadline TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. WITHDRAWAL REQUESTS (New Table)
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chama_id UUID REFERENCES chamas(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'processed')) DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 13. MEETINGS (Update existing table)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS duration_minutes INT;

-- 14. UPDATED RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Transactions Policy
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their transactions' AND tablename = 'transactions'
) THEN
    CREATE POLICY "Users can view their transactions" ON transactions
    FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
END IF; END $$;

-- Loans Policy
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their loans' AND tablename = 'loans'
) THEN
    CREATE POLICY "Users can view their loans" ON loans
    FOR SELECT USING (auth.uid() = borrower_id);
END IF; END $$;

-- Triggers for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_mpesa_payments_updated_at
BEFORE UPDATE ON mpesa_payments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
