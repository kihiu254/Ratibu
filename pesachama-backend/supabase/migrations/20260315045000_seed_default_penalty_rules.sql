-- Seed a default missed payment penalty rule for each chama (if none exists)
INSERT INTO public.penalty_rules (
  chama_id,
  name,
  description,
  event_type,
  points_penalty,
  monetary_penalty,
  is_active,
  created_by
)
SELECT
  c.id,
  'Missed Payment',
  'Penalty applied when a member misses a payment request due date.',
  'missed_payment',
  50,
  0,
  true,
  c.created_by
FROM public.chamas c
WHERE NOT EXISTS (
  SELECT 1 FROM public.penalty_rules pr
  WHERE pr.chama_id = c.id AND pr.event_type = 'missed_payment'
);
