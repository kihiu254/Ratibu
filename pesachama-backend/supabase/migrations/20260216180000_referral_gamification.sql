-- Migration: Referral & Gamification System

-- 1. Update Users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- 2. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.users(id),
    referred_id UUID UNIQUE NOT NULL REFERENCES public.users(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed'
    rewarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Gamification Stats
CREATE TABLE IF NOT EXISTS public.gamification_stats (
    user_id UUID PRIMARY KEY REFERENCES public.users(id),
    points BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    total_contributions INT DEFAULT 0,
    meetings_attended INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_type VARCHAR(50) NOT NULL, -- e.g., 'trophy', 'star', 'trending-up'
    requirement_type VARCHAR(50) NOT NULL, -- 'contributions', 'referrals', 'meetings'
    requirement_threshold INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. User Badges Table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    badge_id UUID NOT NULL REFERENCES public.badges(id),
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, badge_id)
);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "Users can view their own stats" ON public.gamification_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

-- Functions & Triggers

-- A. Auto-generate Referral Code & Init Stats
CREATE OR REPLACE FUNCTION public.handle_new_user_gamification()
RETURNS TRIGGER AS $$
DECLARE
    _ref_code VARCHAR(20);
BEGIN
    -- Generate unique referral code (e.g., RATIBU-XXXX)
    _ref_code := 'RATIBU-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6));
    
    UPDATE public.users SET referral_code = _ref_code WHERE id = NEW.id;
    
    INSERT INTO public.gamification_stats (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_init_gamification
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_gamification();

-- B. Award Points on Transaction
CREATE OR REPLACE FUNCTION public.award_points_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        -- Award 100 points per contribution
        UPDATE public.gamification_stats 
        SET points = points + 100,
            total_contributions = total_contributions + 1,
            updated_at = now()
        WHERE user_id = NEW.profile_id;
        
        -- Also check for referral completion if this is the first contribution
        IF (SELECT total_contributions FROM public.gamification_stats WHERE user_id = NEW.profile_id) = 1 THEN
            -- Mark referral as completed
            UPDATE public.referrals
            SET status = 'completed'
            WHERE referred_id = NEW.profile_id AND status = 'pending';
            
            -- Reward the referrer (500 bonus points)
            UPDATE public.gamification_stats
            SET points = points + 500
            WHERE user_id = (SELECT referrer_id FROM public.referrals WHERE referred_id = NEW.profile_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transaction_completed_award_points
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_contribution();

-- Seed some badges
INSERT INTO public.badges (name, description, icon_type, requirement_type, requirement_threshold) VALUES
('First Saver', 'Made your first contribution!', 'star', 'contributions', 1),
('Consistent Saver', 'Completed 5 contributions.', 'trending-up', 'contributions', 5),
('Chama Guru', 'Completed 20 contributions.', 'trophy', 'contributions', 20),
('Networker', 'Successfully referred 1 friend.', 'users', 'referrals', 1),
('Ambassador', 'Successfully referred 5 friends.', 'award', 'referrals', 5)
ON CONFLICT DO NOTHING;

-- Backfill existing users
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.users WHERE referral_code IS NULL LOOP
        UPDATE public.users 
        SET referral_code = 'RATIBU-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6))
        WHERE id = r.id;
        
        INSERT INTO public.gamification_stats (user_id) VALUES (r.id)
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;
