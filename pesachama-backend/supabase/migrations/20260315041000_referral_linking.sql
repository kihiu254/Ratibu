-- Link referrals on signup based on metadata referral_code

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  _first_name VARCHAR(100);
  _last_name VARCHAR(100);
  _full_name TEXT;
  _space_pos INT;
  _ref_code TEXT;
  _referrer_id UUID;
BEGIN
  -- Extract full name from metadata or default
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member');
  
  -- Simple name splitting
  _space_pos := POSITION(' ' IN _full_name);
  
  IF _space_pos > 0 THEN
      _first_name := SUBSTRING(_full_name, 1, _space_pos - 1);
      _last_name := SUBSTRING(_full_name, _space_pos + 1);
  ELSE
      _first_name := _full_name;
      _last_name := '';
  END IF;

  INSERT INTO public.users (id, email, phone, first_name, last_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    _first_name,
    _last_name,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW();

  -- Link referral if provided
  _ref_code := NULLIF(TRIM(NEW.raw_user_meta_data->>'referral_code'), '');
  IF _ref_code IS NOT NULL THEN
    SELECT id INTO _referrer_id
    FROM public.users
    WHERE referral_code = _ref_code
    LIMIT 1;

    IF _referrer_id IS NOT NULL AND _referrer_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id, status)
      VALUES (_referrer_id, NEW.id, 'pending')
      ON CONFLICT (referred_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
