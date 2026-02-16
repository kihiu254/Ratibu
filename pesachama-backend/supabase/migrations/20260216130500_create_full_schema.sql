-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CLEANUP: Drop existing tables to ensure schema consistency
-- WARNING: This deletes data in these tables. 
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.chama_members CASCADE;
DROP TABLE IF EXISTS public.chamas CASCADE;

-- Chamas Table
CREATE TABLE public.chamas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Financial Settings
    balance DECIMAL(15, 2) DEFAULT 0,
    member_limit INTEGER DEFAULT 50,
    contribution_frequency VARCHAR(50),
    contribution_amount DECIMAL(15, 2),
    min_withdrawal_amount DECIMAL(15, 2) DEFAULT 100,
    max_withdrawal_amount DECIMAL(15, 2) DEFAULT 1000000,
    
    -- Status & Rules
    status VARCHAR(50) DEFAULT 'active',
    rules JSONB,
    terms_conditions TEXT,
    
    -- Statistics
    total_members INTEGER DEFAULT 1,
    total_contributed DECIMAL(15, 2) DEFAULT 0,
    total_disbursed DECIMAL(15, 2) DEFAULT 0,
    meeting_count INTEGER DEFAULT 0,
    
    -- Metadata
    logo_url TEXT,
    category VARCHAR(50),
    registration_number VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chamas_created_by ON public.chamas(created_by);
CREATE INDEX idx_chamas_status ON public.chamas(status) WHERE deleted_at IS NULL;

-- Chama Members Table
CREATE TABLE public.chama_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Role & Status
    role VARCHAR(50) DEFAULT 'member',
    status VARCHAR(50) DEFAULT 'active',
    
    -- Financial Tracking
    total_contribution DECIMAL(15, 2) DEFAULT 0,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0,
    contribution_count INTEGER DEFAULT 0,
    
    -- Metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    reason_for_leaving TEXT,
    
    -- Constraints
    UNIQUE(chama_id, user_id),
    CONSTRAINT valid_role CHECK (role IN ('admin', 'treasurer', 'member')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'left'))
);

CREATE INDEX idx_chama_members_user_id ON public.chama_members(user_id);
CREATE INDEX idx_chama_members_chama_id ON public.chama_members(chama_id);

-- Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Transaction Details
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Payment Information
    payment_method VARCHAR(50),
    reference VARCHAR(100),
    mpesa_transaction_id VARCHAR(100),
    
    -- Details
    description TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'reversed'))
);

CREATE INDEX idx_transactions_chama_id ON public.transactions(chama_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);

-- Simple RLS Policies
ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Chamas policies
CREATE POLICY "Chamas are viewable by everyone" ON public.chamas FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create chamas" ON public.chamas FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Chama Members policies
CREATE POLICY "Members can view other members in their chama" ON public.chama_members FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = chama_members.chama_id AND cm.user_id = auth.uid()
    )
);

-- Transactions policies
CREATE POLICY "Members can view transactions in their chama" ON public.transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.chama_members cm 
        WHERE cm.chama_id = transactions.chama_id AND cm.user_id = auth.uid()
    )
);
