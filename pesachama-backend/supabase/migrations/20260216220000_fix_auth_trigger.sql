-- Fix Auth Trigger to use public.users table instead of public.profiles
-- and handle name splitting and phone number format

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  _first_name VARCHAR(100);
  _last_name VARCHAR(100);
  _full_name TEXT;
  _space_pos INT;
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is enabled
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
