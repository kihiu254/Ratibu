-- Prevent duplicate chama names and ensure only one overlapping swap can succeed.

CREATE OR REPLACE FUNCTION public.normalize_chama_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(trim(coalesce(input_name, '')), '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_chama_names()
RETURNS TRIGGER AS $$
DECLARE
  normalized_name TEXT;
BEGIN
  normalized_name := public.normalize_chama_name(NEW.name);

  IF normalized_name = '' THEN
    RAISE EXCEPTION 'Chama name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_name, 0));

  IF EXISTS (
    SELECT 1
    FROM public.chamas c
    WHERE (NEW.id IS NULL OR c.id <> NEW.id)
      AND c.deleted_at IS NULL
      AND public.normalize_chama_name(c.name) = normalized_name
  ) THEN
    RAISE EXCEPTION 'A chama with this name already exists.';
  END IF;

  NEW.name := regexp_replace(trim(NEW.name), '\s+', ' ', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_chama_names ON public.chamas;
CREATE TRIGGER trg_prevent_duplicate_chama_names
  BEFORE INSERT OR UPDATE OF name ON public.chamas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_chama_names();

CREATE OR REPLACE FUNCTION public.approve_allocation_swap(_swap_id UUID)
RETURNS void AS $$
DECLARE
  req public.allocation_swap_requests%ROWTYPE;
  actor_id UUID := auth.uid();
  requester_current_day INT;
  target_current_day INT;
  can_manage BOOLEAN := false;
BEGIN
  SELECT *
  INTO req
  FROM public.allocation_swap_requests
  WHERE id = _swap_id
  FOR UPDATE;

  IF req IS NULL THEN
    RAISE EXCEPTION 'Swap request not found.';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'This swap request is no longer pending.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.chama_members cm
    WHERE cm.chama_id = req.chama_id
      AND cm.user_id = actor_id
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
  INTO can_manage;

  IF actor_id IS NULL OR (actor_id <> req.target_user_id AND NOT can_manage) THEN
    RAISE EXCEPTION 'You are not allowed to approve this swap request.';
  END IF;

  SELECT allocation_day
  INTO requester_current_day
  FROM public.chama_allocation_schedule
  WHERE chama_id = req.chama_id
    AND user_id = req.requester_id
    AND allocation_month = req.month
  FOR UPDATE;

  SELECT allocation_day
  INTO target_current_day
  FROM public.chama_allocation_schedule
  WHERE chama_id = req.chama_id
    AND user_id = req.target_user_id
    AND allocation_month = req.month
  FOR UPDATE;

  IF requester_current_day IS NULL OR target_current_day IS NULL THEN
    RAISE EXCEPTION 'Allocation schedule is missing for one or both members.';
  END IF;

  IF requester_current_day <> req.requester_day OR target_current_day <> req.target_day THEN
    RAISE EXCEPTION 'Allocation schedule changed before this swap could be approved. Refresh and try again.';
  END IF;

  UPDATE public.chama_allocation_schedule
  SET allocation_day = CASE
    WHEN user_id = req.requester_id THEN req.target_day
    WHEN user_id = req.target_user_id THEN req.requester_day
    ELSE allocation_day
  END
  WHERE chama_id = req.chama_id
    AND allocation_month = req.month
    AND user_id IN (req.requester_id, req.target_user_id);

  UPDATE public.allocation_swap_requests
  SET status = 'approved',
      updated_at = now()
  WHERE id = _swap_id;

  UPDATE public.allocation_swap_requests
  SET status = 'cancelled',
      updated_at = now()
  WHERE id <> _swap_id
    AND chama_id = req.chama_id
    AND month = req.month
    AND status = 'pending'
    AND (
      requester_id IN (req.requester_id, req.target_user_id)
      OR target_user_id IN (req.requester_id, req.target_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
