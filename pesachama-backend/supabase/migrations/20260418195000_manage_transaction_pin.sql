CREATE OR REPLACE FUNCTION public.manage_transaction_pin(
  action text,
  pin text DEFAULT NULL,
  target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_role text;
  user_row users%ROWTYPE;
  salt text;
  pin_hash text;
  failed_attempts integer;
  next_attempts integer;
  reset_required boolean;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT system_role INTO caller_role
  FROM public.users
  WHERE id = caller_id;

  IF action = 'status' THEN
    SELECT *
    INTO user_row
    FROM public.users
    WHERE id = caller_id;

    failed_attempts := COALESCE(user_row.transaction_pin_failed_attempts, 0);
    reset_required := COALESCE(user_row.transaction_pin_hash IS NOT NULL, false)
      AND (COALESCE(user_row.transaction_pin_enabled, false) = false OR failed_attempts >= 3);

    RETURN jsonb_build_object(
      'enabled', COALESCE(user_row.transaction_pin_enabled, false),
      'needsSetup', user_row.transaction_pin_hash IS NULL,
      'resetRequired', reset_required,
      'attemptsRemaining', GREATEST(0, 3 - failed_attempts),
      'lockedUntil', user_row.transaction_pin_locked_until
    );
  END IF;

  IF action IN ('set', 'reset') THEN
    IF pin IS NULL OR pin !~ '^\d{4,6}$' THEN
      RETURN jsonb_build_object('error', 'PIN must be 4 to 6 digits');
    END IF;

    salt := encode(gen_random_bytes(16), 'hex');
    pin_hash := encode(digest(salt || ':' || pin, 'sha256'), 'hex');

    UPDATE public.users
    SET
      transaction_pin_hash = pin_hash,
      transaction_pin_salt = salt,
      transaction_pin_enabled = true,
      transaction_pin_updated_at = now(),
      transaction_pin_failed_attempts = 0,
      transaction_pin_locked_until = NULL
    WHERE id = caller_id;

    RETURN jsonb_build_object(
      'success', true,
      'enabled', true,
      'reset', action = 'reset',
      'attemptsRemaining', 3
    );
  END IF;

  IF action = 'verify' THEN
    IF pin IS NULL OR pin !~ '^\d{4,6}$' THEN
      RETURN jsonb_build_object('error', 'PIN must be 4 to 6 digits');
    END IF;

    SELECT *
    INTO user_row
    FROM public.users
    WHERE id = caller_id;

    IF user_row.transaction_pin_hash IS NULL OR user_row.transaction_pin_salt IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'needsSetup', true,
        'resetRequired', false,
        'attemptsRemaining', 3
      );
    END IF;

    failed_attempts := COALESCE(user_row.transaction_pin_failed_attempts, 0);
    reset_required := COALESCE(user_row.transaction_pin_enabled, false) = false OR failed_attempts >= 3;

    IF reset_required THEN
      RETURN jsonb_build_object(
        'success', false,
        'needsSetup', false,
        'resetRequired', true,
        'attemptsRemaining', 0
      );
    END IF;

    pin_hash := encode(digest(user_row.transaction_pin_salt || ':' || pin, 'sha256'), 'hex');
    IF pin_hash <> user_row.transaction_pin_hash THEN
      next_attempts := failed_attempts + 1;

      UPDATE public.users
      SET
        transaction_pin_failed_attempts = next_attempts,
        transaction_pin_enabled = CASE WHEN next_attempts >= 3 THEN false ELSE true END,
        transaction_pin_locked_until = CASE WHEN next_attempts >= 3 THEN NULL ELSE transaction_pin_locked_until END
      WHERE id = caller_id;

      RETURN jsonb_build_object(
        'success', false,
        'needsSetup', false,
        'resetRequired', next_attempts >= 3,
        'attemptsRemaining', GREATEST(0, 3 - next_attempts)
      );
    END IF;

    UPDATE public.users
    SET
      transaction_pin_failed_attempts = 0,
      transaction_pin_locked_until = NULL,
      transaction_pin_enabled = true
    WHERE id = caller_id;

    RETURN jsonb_build_object(
      'success', true,
      'needsSetup', false,
      'resetRequired', false,
      'attemptsRemaining', 3
    );
  END IF;

  IF action = 'admin_reset' THEN
    IF caller_role NOT IN ('admin', 'super_admin') THEN
      RETURN jsonb_build_object('error', 'Admin access required');
    END IF;

    IF target_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Missing targetUserId');
    END IF;

    UPDATE public.users
    SET
      transaction_pin_hash = NULL,
      transaction_pin_salt = NULL,
      transaction_pin_enabled = false,
      transaction_pin_updated_at = now(),
      transaction_pin_failed_attempts = 0,
      transaction_pin_locked_until = NULL
    WHERE id = target_user_id;

    INSERT INTO public.audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      old_value,
      new_value
    )
    VALUES (
      caller_id,
      'transaction_pin_admin_reset',
      'transaction_pin',
      target_user_id,
      jsonb_build_object('target_user_id', target_user_id),
      jsonb_build_object('reset', true)
    );

    RETURN jsonb_build_object('success', true, 'reset', true, 'targetUserId', target_user_id);
  END IF;

  RETURN jsonb_build_object('error', 'Unsupported action');
END;
$$;
