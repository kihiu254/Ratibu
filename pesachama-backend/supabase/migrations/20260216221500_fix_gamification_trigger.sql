-- Fix Gamification Trigger to use user_id instead of profile_id
-- The transactions table uses 'user_id', but the previous trigger referenced 'profile_id'.

CREATE OR REPLACE FUNCTION public.award_points_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        -- Award 100 points per contribution
        -- Changed NEW.profile_id to NEW.user_id
        UPDATE public.gamification_stats 
        SET points = points + 100,
            total_contributions = total_contributions + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id;
        
        -- Also check for referral completion if this is the first contribution
        -- Changed NEW.profile_id to NEW.user_id
        IF (SELECT total_contributions FROM public.gamification_stats WHERE user_id = NEW.user_id) = 1 THEN
            -- Mark referral as completed
            -- Changed NEW.profile_id to NEW.user_id
            UPDATE public.referrals
            SET status = 'completed'
            WHERE referred_id = NEW.user_id AND status = 'pending';
            
            -- Reward the referrer (500 bonus points)
            -- Changed NEW.profile_id to NEW.user_id
            UPDATE public.gamification_stats
            SET points = points + 500
            WHERE user_id = (SELECT referrer_id FROM public.referrals WHERE referred_id = NEW.user_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
