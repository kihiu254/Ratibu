-- Meeting and swap notification triggers

CREATE OR REPLACE FUNCTION public.notify_members_of_new_meeting()
RETURNS trigger AS $$
DECLARE
  chama_name TEXT;
  location_label TEXT;
  meeting_link TEXT;
BEGIN
  SELECT name
  INTO chama_name
  FROM public.chamas
  WHERE id = NEW.chama_id;

  location_label := CASE
    WHEN NEW.video_link IS NOT NULL AND btrim(NEW.video_link) <> '' THEN 'Join online'
    WHEN NEW.venue IS NOT NULL AND btrim(NEW.venue) <> '' THEN NEW.venue
    ELSE 'Venue to be confirmed'
  END;

  meeting_link := CASE
    WHEN NEW.video_link IS NOT NULL AND btrim(NEW.video_link) <> '' THEN NEW.video_link
    ELSE '/meetings'
  END;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    cm.user_id,
    'New meeting scheduled',
    format(
      '%s meeting for %s is on %s. %s.',
      COALESCE(NEW.title, 'A'),
      COALESCE(chama_name, 'your chama'),
      to_char(NEW.date AT TIME ZONE 'Africa/Nairobi', 'Dy, DD Mon YYYY at HH12:MI AM'),
      location_label
    ),
    'info',
    meeting_link
  FROM public.chama_members cm
  WHERE cm.chama_id = NEW.chama_id
    AND cm.status = 'active';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_on_meeting_created ON public.meetings;
CREATE TRIGGER notify_on_meeting_created
AFTER INSERT ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.notify_members_of_new_meeting();

CREATE OR REPLACE FUNCTION public.notify_on_swap_request_created()
RETURNS trigger AS $$
DECLARE
  chama_name TEXT;
  requester_name TEXT;
BEGIN
  SELECT name
  INTO chama_name
  FROM public.chamas
  WHERE id = NEW.chama_id;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'A member')
  INTO requester_name
  FROM public.users u
  WHERE u.id = NEW.requester_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.target_user_id,
    'New swap request',
    format(
      '%s requested to swap allocation days with you in %s for %s.',
      requester_name,
      COALESCE(chama_name, 'your chama'),
      to_char(NEW.month, 'Mon YYYY')
    ),
    'info',
    '/swaps'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_on_swap_request_created ON public.allocation_swap_requests;
CREATE TRIGGER notify_on_swap_request_created
AFTER INSERT ON public.allocation_swap_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_swap_request_created();

CREATE OR REPLACE FUNCTION public.notify_on_swap_request_updated()
RETURNS trigger AS $$
DECLARE
  chama_name TEXT;
  requester_name TEXT;
  target_name TEXT;
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT name
  INTO chama_name
  FROM public.chamas
  WHERE id = NEW.chama_id;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'The requester')
  INTO requester_name
  FROM public.users u
  WHERE u.id = NEW.requester_id;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'The other member')
  INTO target_name
  FROM public.users u
  WHERE u.id = NEW.target_user_id;

  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES
      (
        NEW.requester_id,
        'Swap approved',
        format(
          '%s accepted your swap request in %s for %s.',
          target_name,
          COALESCE(chama_name, 'your chama'),
          to_char(NEW.month, 'Mon YYYY')
        ),
        'success',
        '/swaps'
      ),
      (
        NEW.target_user_id,
        'Swap confirmed',
        format(
          'You approved %s''s swap request in %s for %s.',
          requester_name,
          COALESCE(chama_name, 'your chama'),
          to_char(NEW.month, 'Mon YYYY')
        ),
        'success',
        '/swaps'
      );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.requester_id,
      'Swap declined',
      format(
        '%s declined your swap request in %s for %s.',
        target_name,
        COALESCE(chama_name, 'your chama'),
        to_char(NEW.month, 'Mon YYYY')
      ),
      'warning',
      '/swaps'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_on_swap_request_updated ON public.allocation_swap_requests;
CREATE TRIGGER notify_on_swap_request_updated
AFTER UPDATE OF status ON public.allocation_swap_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_swap_request_updated();
