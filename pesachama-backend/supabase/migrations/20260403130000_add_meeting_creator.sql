-- Track the member who created each meeting so the host/admin is preserved.

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

UPDATE public.meetings m
SET created_by = c.created_by
FROM public.chamas c
WHERE c.id = m.chama_id
  AND m.created_by IS NULL;

ALTER TABLE public.meetings
ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_created_by
ON public.meetings(created_by);

CREATE OR REPLACE FUNCTION public.generate_monthly_meetings(_month DATE)
RETURNS void AS $$
DECLARE
  c RECORD;
  last_day INT;
  meeting_day INT;
  meeting_ts TIMESTAMPTZ;
BEGIN
  last_day := EXTRACT(day FROM (date_trunc('month', _month) + interval '1 month - 1 day'));

  FOR c IN
    SELECT id, created_by, name, meeting_day_of_month, meeting_time, meeting_timezone,
           meeting_title, meeting_venue, meeting_video_link
    FROM public.chamas
    WHERE status = 'active'
      AND meeting_frequency = 'monthly'
      AND auto_meetings_enabled = true
  LOOP
    meeting_day := LEAST(GREATEST(COALESCE(c.meeting_day_of_month, 5), 1), last_day);

    meeting_ts := make_timestamptz(
      EXTRACT(year FROM _month)::int,
      EXTRACT(month FROM _month)::int,
      meeting_day,
      EXTRACT(hour FROM COALESCE(c.meeting_time, '10:00'::time))::int,
      EXTRACT(minute FROM COALESCE(c.meeting_time, '10:00'::time))::int,
      0,
      COALESCE(c.meeting_timezone, 'UTC')
    );

    INSERT INTO public.meetings (chama_id, created_by, title, description, date, venue, video_link)
    VALUES (
      c.id,
      c.created_by,
      COALESCE(c.meeting_title, 'Monthly Chama Meeting'),
      NULL,
      meeting_ts,
      c.meeting_venue,
      c.meeting_video_link
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
