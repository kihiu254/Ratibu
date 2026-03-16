-- Automatic monthly meeting generation

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_frequency_enum') THEN
    CREATE TYPE meeting_frequency_enum AS ENUM ('weekly', 'biweekly', 'monthly');
  END IF;
END $$;

ALTER TABLE public.chamas
ADD COLUMN IF NOT EXISTS meeting_frequency meeting_frequency_enum DEFAULT 'monthly';

ALTER TABLE public.chamas
ADD COLUMN IF NOT EXISTS meeting_day_of_month INT DEFAULT 5 CHECK (meeting_day_of_month BETWEEN 1 AND 31),
ADD COLUMN IF NOT EXISTS meeting_time TIME DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS meeting_timezone TEXT DEFAULT 'Africa/Nairobi',
ADD COLUMN IF NOT EXISTS meeting_title TEXT DEFAULT 'Monthly Chama Meeting',
ADD COLUMN IF NOT EXISTS meeting_venue TEXT,
ADD COLUMN IF NOT EXISTS meeting_video_link TEXT,
ADD COLUMN IF NOT EXISTS auto_meetings_enabled BOOLEAN DEFAULT true;

-- Prevent duplicate meetings for the same timestamp
CREATE UNIQUE INDEX IF NOT EXISTS uniq_meetings_chama_date ON public.meetings(chama_id, date);

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
    SELECT id, name, meeting_day_of_month, meeting_time, meeting_timezone,
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

    INSERT INTO public.meetings (chama_id, title, description, date, venue, video_link)
    VALUES (
      c.id,
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
