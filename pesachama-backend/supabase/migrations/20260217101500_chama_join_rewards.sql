-- Migration: Chama Join Rewards
-- Adds Chama-specific points for joining

-- 1. Add join_points to chamas
ALTER TABLE public.chamas ADD COLUMN IF NOT EXISTS join_points INT DEFAULT 500;

-- 2. Function to award points on join
CREATE OR REPLACE FUNCTION public.award_points_on_joining_chama()
RETURNS TRIGGER AS $$
DECLARE
    _points INT;
BEGIN
    -- Get points from the chama
    SELECT join_points INTO _points FROM public.chamas WHERE id = NEW.chama_id;
    
    -- Award points to user
    UPDATE public.gamification_stats 
    SET points = points + COALESCE(_points, 0),
        updated_at = now()
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger on chama_members
DROP TRIGGER IF EXISTS on_chama_joined_award_points ON public.chama_members;
CREATE TRIGGER on_chama_joined_award_points
AFTER INSERT ON public.chama_members
FOR EACH ROW EXECUTE FUNCTION public.award_points_on_joining_chama();

-- Update existing chamas to have some variety in points
UPDATE public.chamas SET join_points = 1000 WHERE category = 'Investment';
UPDATE public.chamas SET join_points = 750 WHERE category = 'Education';
UPDATE public.chamas SET join_points = 250 WHERE category = 'Social';
