-- Update default member_limit to 30
ALTER TABLE public.chamas
  ALTER COLUMN member_limit SET DEFAULT 30;

-- Update any existing chamas that still have the old default of 50
UPDATE public.chamas
  SET member_limit = 30
  WHERE member_limit = 50;

-- Add a check constraint so member_limit can never exceed 30
ALTER TABLE public.chamas
  DROP CONSTRAINT IF EXISTS chamas_member_limit_max;

ALTER TABLE public.chamas
  ADD CONSTRAINT chamas_member_limit_max
    CHECK (member_limit <= 30);

-- Trigger function: block new members when chama is full
CREATE OR REPLACE FUNCTION public.check_chama_member_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_count INT;
  max_limit     INT;
BEGIN
  SELECT COUNT(*), c.member_limit
    INTO current_count, max_limit
    FROM public.chama_members cm
    JOIN public.chamas c ON c.id = cm.chama_id
   WHERE cm.chama_id = NEW.chama_id
     AND cm.status = 'active'
   GROUP BY c.member_limit;

  IF current_count >= COALESCE(max_limit, 30) THEN
    RAISE EXCEPTION 'This chama has reached its maximum of % members.', COALESCE(max_limit, 30);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_chama_member_limit ON public.chama_members;

CREATE TRIGGER trg_check_chama_member_limit
  BEFORE INSERT ON public.chama_members
  FOR EACH ROW EXECUTE FUNCTION public.check_chama_member_limit();
