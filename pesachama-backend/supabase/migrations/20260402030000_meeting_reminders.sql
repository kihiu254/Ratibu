-- Track which reminders have been sent per meeting
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS meeting_reminders_sent TEXT[] DEFAULT '{}';

-- Schedule the reminder function every 15 minutes via pg_cron
-- (requires pg_cron extension — enable it in Supabase Dashboard > Database > Extensions)
SELECT cron.schedule(
  'meeting-reminders',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/send-meeting-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body   := '{}'::jsonb
    );
  $$
);
