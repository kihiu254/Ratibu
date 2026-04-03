-- Fix swap approval conflicts and add stricter authorization checks.

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
