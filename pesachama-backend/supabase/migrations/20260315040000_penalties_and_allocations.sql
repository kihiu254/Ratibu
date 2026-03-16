-- Penalties, rules, monthly allocations, and swap requests

-- 1) Penalty Rules per Chama
CREATE TABLE IF NOT EXISTS public.penalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'late_contribution', 'missed_meeting', 'missed_payment', 'other'
    points_penalty INT NOT NULL DEFAULT 0,
    monetary_penalty DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_rules_chama_id ON public.penalty_rules(chama_id);

-- 2) Penalty Events
CREATE TABLE IF NOT EXISTS public.penalty_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.penalty_rules(id),
    event_type VARCHAR(50) NOT NULL,
    points_penalty INT NOT NULL DEFAULT 0,
    monetary_penalty DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'applied', -- 'applied', 'waived'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penalty_events_chama_id ON public.penalty_events(chama_id);
CREATE INDEX IF NOT EXISTS idx_penalty_events_user_id ON public.penalty_events(user_id);

-- 3) Monthly Allocation Schedule
CREATE TABLE IF NOT EXISTS public.chama_allocation_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    allocation_month DATE NOT NULL, -- store first day of month
    allocation_day INT NOT NULL CHECK (allocation_day >= 1 AND allocation_day <= 31),
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'paid', 'skipped'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chama_id, user_id, allocation_month),
    UNIQUE(chama_id, allocation_month, allocation_day)
);

CREATE INDEX IF NOT EXISTS idx_allocation_schedule_chama_id ON public.chama_allocation_schedule(chama_id);
CREATE INDEX IF NOT EXISTS idx_allocation_schedule_month ON public.chama_allocation_schedule(allocation_month);

-- 4) Allocation Swap Requests
CREATE TABLE IF NOT EXISTS public.allocation_swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chama_id UUID NOT NULL REFERENCES public.chamas(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    requester_day INT NOT NULL,
    target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_day INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swap_requests_chama_id ON public.allocation_swap_requests(chama_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_month ON public.allocation_swap_requests(month);

-- RLS
ALTER TABLE public.penalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_allocation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_swap_requests ENABLE ROW LEVEL SECURITY;

-- Penalty rules: members can view, admins can manage
CREATE POLICY "penalty_rules_read_policy"
ON public.penalty_rules
FOR SELECT
USING (
  check_is_member(chama_id, auth.uid())
);

CREATE POLICY "penalty_rules_manage_policy"
ON public.penalty_rules
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = penalty_rules.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = penalty_rules.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
);

-- Penalty events: members can view their own, admins can view all and insert
CREATE POLICY "penalty_events_read_policy"
ON public.penalty_events
FOR SELECT
USING (
  auth.uid() = user_id
  OR check_is_member(chama_id, auth.uid())
);

CREATE POLICY "penalty_events_insert_policy"
ON public.penalty_events
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = penalty_events.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
);

-- Allocation schedule: members can view, admins can manage
CREATE POLICY "allocation_schedule_read_policy"
ON public.chama_allocation_schedule
FOR SELECT
USING (
  check_is_member(chama_id, auth.uid())
);

CREATE POLICY "allocation_schedule_manage_policy"
ON public.chama_allocation_schedule
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = chama_allocation_schedule.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = chama_allocation_schedule.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
);

-- Swap requests: members can create/view their own, admins can approve
CREATE POLICY "swap_requests_read_policy"
ON public.allocation_swap_requests
FOR SELECT
USING (
  requester_id = auth.uid()
  OR target_user_id = auth.uid()
  OR check_is_member(chama_id, auth.uid())
);

CREATE POLICY "swap_requests_insert_policy"
ON public.allocation_swap_requests
FOR INSERT
WITH CHECK (
  requester_id = auth.uid()
  AND check_is_member(chama_id, auth.uid())
);

CREATE POLICY "swap_requests_update_policy"
ON public.allocation_swap_requests
FOR UPDATE
USING (
  requester_id = auth.uid()
  OR target_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = allocation_swap_requests.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
)
WITH CHECK (
  requester_id = auth.uid()
  OR target_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chama_members cm
    WHERE cm.chama_id = allocation_swap_requests.chama_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'treasurer', 'secretary')
  )
);

-- Trigger to apply penalty points
CREATE OR REPLACE FUNCTION public.apply_penalty_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'applied' AND NEW.points_penalty > 0 THEN
    UPDATE public.gamification_stats
    SET points = points - NEW.points_penalty,
        penalty_points = penalty_points + NEW.points_penalty,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_penalty_event_applied ON public.penalty_events;
CREATE TRIGGER on_penalty_event_applied
AFTER INSERT ON public.penalty_events
FOR EACH ROW EXECUTE FUNCTION public.apply_penalty_points();

-- Helper function to generate monthly allocations (randomized)
CREATE OR REPLACE FUNCTION public.generate_monthly_allocations(_chama_id UUID, _month DATE)
RETURNS void AS $$
DECLARE
  member RECORD;
  days INT[];
  last_day INT;
  member_count INT;
  day_index INT := 1;
BEGIN
  last_day := EXTRACT(day FROM (date_trunc('month', _month) + interval '1 month - 1 day'));
  SELECT COUNT(*) INTO member_count
  FROM public.chama_members
  WHERE chama_id = _chama_id AND status = 'active';

  IF member_count > last_day THEN
    RAISE EXCEPTION 'Member count (%) exceeds days in month (%)', member_count, last_day;
  END IF;

  -- Collect available days within the month
  days := ARRAY(SELECT generate_series(1, last_day));
  -- Shuffle days
  SELECT array_agg(d ORDER BY random()) INTO days FROM unnest(days) d;

  FOR member IN
    SELECT cm.user_id
    FROM public.chama_members cm
    WHERE cm.chama_id = _chama_id
      AND cm.status = 'active'
  LOOP
    EXIT WHEN day_index > array_length(days, 1);
    INSERT INTO public.chama_allocation_schedule (chama_id, user_id, allocation_month, allocation_day)
    VALUES (_chama_id, member.user_id, date_trunc('month', _month)::date, days[day_index])
    ON CONFLICT (chama_id, user_id, allocation_month) DO NOTHING;
    day_index := day_index + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to approve a swap request and swap allocation days
CREATE OR REPLACE FUNCTION public.approve_allocation_swap(_swap_id UUID)
RETURNS void AS $$
DECLARE
  req RECORD;
BEGIN
  SELECT * INTO req FROM public.allocation_swap_requests WHERE id = _swap_id;
  IF req IS NULL OR req.status <> 'pending' THEN
    RETURN;
  END IF;

  -- Swap days in schedule
  UPDATE public.chama_allocation_schedule
  SET allocation_day = req.target_day
  WHERE chama_id = req.chama_id AND user_id = req.requester_id AND allocation_month = req.month;

  UPDATE public.chama_allocation_schedule
  SET allocation_day = req.requester_day
  WHERE chama_id = req.chama_id AND user_id = req.target_user_id AND allocation_month = req.month;

  UPDATE public.allocation_swap_requests
  SET status = 'approved', updated_at = now()
  WHERE id = _swap_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
