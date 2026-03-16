-- Ensure gamification stats support referral and penalty point tracking

ALTER TABLE public.gamification_stats
ADD COLUMN IF NOT EXISTS referral_points BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_points BIGINT DEFAULT 0;

CREATE OR REPLACE FUNCTION public.award_points_on_contribution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE public.gamification_stats 
        SET points = points + 100,
            total_contributions = total_contributions + 1,
            updated_at = now()
        WHERE user_id = NEW.user_id;
        
        IF (SELECT total_contributions FROM public.gamification_stats WHERE user_id = NEW.user_id) = 1 THEN
            UPDATE public.referrals
            SET status = 'completed'
            WHERE referred_id = NEW.user_id AND status = 'pending';
            
            UPDATE public.gamification_stats
            SET points = points + 500,
                referral_points = referral_points + 500,
                updated_at = now()
            WHERE user_id = (SELECT referrer_id FROM public.referrals WHERE referred_id = NEW.user_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
