-- Automatic penalties for missed payments

ALTER TABLE public.penalty_events
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_penalty_events_source
ON public.penalty_events(user_id, source_type, source_id);

CREATE OR REPLACE FUNCTION public.apply_missed_payment_penalties(_as_of TIMESTAMPTZ DEFAULT now())
RETURNS void AS $$
DECLARE
  pr RECORD;
  rule RECORD;
  member RECORD;
BEGIN
  FOR pr IN
    SELECT * FROM public.payment_requests
    WHERE is_active = true
      AND due_date IS NOT NULL
      AND due_date < _as_of
  LOOP
    SELECT * INTO rule
    FROM public.penalty_rules
    WHERE chama_id = pr.chama_id
      AND event_type = 'missed_payment'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF rule IS NULL THEN
      CONTINUE;
    END IF;

    FOR member IN
      SELECT user_id FROM public.chama_members
      WHERE chama_id = pr.chama_id AND status = 'active'
    LOOP
      IF pr.target_member_ids IS NULL OR member.user_id = ANY(pr.target_member_ids) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.chama_id = pr.chama_id
            AND t.user_id = member.user_id
            AND t.status = 'completed'
            AND (t.metadata->>'payment_request_id') = pr.id::text
        ) THEN
          INSERT INTO public.penalty_events (
            chama_id,
            user_id,
            rule_id,
            event_type,
            points_penalty,
            monetary_penalty,
            source_type,
            source_id
          )
          VALUES (
            pr.chama_id,
            member.user_id,
            rule.id,
            rule.event_type,
            rule.points_penalty,
            rule.monetary_penalty,
            'payment_request',
            pr.id
          )
          ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
