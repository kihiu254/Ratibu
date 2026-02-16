-- PesaChama & Ratibu Supabase Core Schema
-- Enable uuid-ossp for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Profiles (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    role TEXT CHECK (
        role IN ('member', 'chairman', 'treasurer', 'secretary')
    ) DEFAULT 'member',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 2. Groups (Chamas)
CREATE TABLE IF NOT EXISTS groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id),
    meeting_day INTEGER CHECK (
        meeting_day BETWEEN 0 AND 6
    ),
    -- 0=Sunday
    contribution_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 3. Group Members (Relationships)
CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role_in_group TEXT DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (group_id, profile_id)
);
-- 4. Contributions (Ledger)
CREATE TABLE IF NOT EXISTS contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    profile_id UUID REFERENCES profiles(id),
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    mpesa_receipt_number TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 5. Meetings & Disbursements
CREATE TABLE IF NOT EXISTS meetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    agenda TEXT,
    video_link TEXT,
    -- Jitsi/Zoom link
    disbursement_recipient_id UUID REFERENCES profiles(id),
    status TEXT CHECK (status IN ('scheduled', 'ongoing', 'completed')) DEFAULT 'scheduled'
);
-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- Profiles: Users can only see their own profile or fellow group members' names.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view their own profile'
) THEN CREATE POLICY "Users can view their own profile" ON profiles FOR
SELECT USING (auth.uid() = id);
END IF;
END $$;
-- Groups: Members can view the groups they belong to.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Members can view their groups'
) THEN CREATE POLICY "Members can view their groups" ON groups FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM group_members
            WHERE group_id = groups.id
                AND profile_id = auth.uid()
        )
    );
END IF;
END $$;
-- Contributions: Members can view their own contributions and the group ledger.
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Members can view group contributions'
) THEN CREATE POLICY "Members can view group contributions" ON contributions FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM group_members
            WHERE group_id = contributions.group_id
                AND profile_id = auth.uid()
        )
    );
END IF;
END $$;