-- Prevent duplicate phone numbers across user records.
-- This keeps legacy data intact, but blocks new inserts/updates that reuse an existing phone.

CREATE OR REPLACE FUNCTION public.normalize_kenyan_phone(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(lower(trim(value)), '^(tel:|whatsapp:)', '', 'i');
  cleaned := regexp_replace(cleaned, '[\s\-\(\)]', '', 'g');
  cleaned := regexp_replace(cleaned, '[^\d+]', '', 'g');

  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  IF cleaned LIKE '+254%' AND length(cleaned) >= 13 THEN
    RETURN '254' || right(cleaned, 9);
  ELSIF cleaned LIKE '254%' AND length(cleaned) >= 12 THEN
    RETURN '254' || right(cleaned, 9);
  ELSIF cleaned LIKE '0%' AND length(cleaned) >= 10 THEN
    RETURN '254' || right(cleaned, 9);
  ELSIF length(cleaned) = 9 THEN
    RETURN '254' || cleaned;
  END IF;

  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_duplicate_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_value TEXT;
  normalized_value TEXT;
  duplicate_count INTEGER;
BEGIN
  current_value := CASE
    WHEN TG_TABLE_NAME = 'users' THEN NEW.phone
    WHEN TG_TABLE_NAME = 'profiles' THEN NEW.phone_number
    ELSE NULL
  END;

  normalized_value := public.normalize_kenyan_phone(current_value);
  IF normalized_value IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'users' THEN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM public.users u
    WHERE u.id <> NEW.id
      AND public.normalize_kenyan_phone(u.phone) = normalized_value;

    IF duplicate_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'unique_violation',
        MESSAGE = 'Phone number already exists';
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND public.normalize_kenyan_phone(p.phone_number) = normalized_value;

    IF duplicate_count > 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'unique_violation',
        MESSAGE = 'Phone number already exists';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_reject_duplicate_phone_number ON public.users;
CREATE TRIGGER users_reject_duplicate_phone_number
BEFORE INSERT OR UPDATE OF phone ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.reject_duplicate_phone_number();

DROP TRIGGER IF EXISTS profiles_reject_duplicate_phone_number ON public.profiles;
CREATE TRIGGER profiles_reject_duplicate_phone_number
BEFORE INSERT OR UPDATE OF phone_number ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.reject_duplicate_phone_number();
