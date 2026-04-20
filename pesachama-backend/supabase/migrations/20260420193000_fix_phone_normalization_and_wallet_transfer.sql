-- Ensure Ratibu wallet transfers can normalize Kenyan phone numbers even if the earlier helper
-- migration was not applied in the target database yet.

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

CREATE OR REPLACE FUNCTION public.internal_wallet_transfer(
  p_sender_user_id UUID,
  p_receiver_phone TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_phone TEXT;
  v_receiver RECORD;
  v_normalized_phone TEXT;
  v_score INTEGER := 0;
  v_required INTEGER := 0;
  v_sender_balance NUMERIC(15, 2);
  v_receiver_balance NUMERIC(15, 2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid amount.');
  END IF;

  SELECT COALESCE(credit_score, 500), COALESCE(wallet_balance, 0), phone
  INTO v_score, v_sender_balance, v_sender_phone
  FROM public.users
  WHERE id = p_sender_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sender not found.');
  END IF;

  v_required := public.marketplace_role_minimum_score('vendor');
  IF v_score < v_required THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Your credit score is too low for wallet transfers.');
  END IF;

  v_normalized_phone := public.normalize_kenyan_phone(p_receiver_phone);
  IF v_normalized_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid recipient phone number.');
  END IF;

  SELECT id, COALESCE(wallet_balance, 0)
  INTO v_receiver
  FROM public.users
  WHERE public.normalize_kenyan_phone(phone) = v_normalized_phone
     OR public.normalize_kenyan_phone(phone) = public.normalize_kenyan_phone(p_receiver_phone)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No Ratibu member found for that phone number.');
  END IF;

  IF v_receiver.id = p_sender_user_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You cannot send money to yourself.');
  END IF;

  IF v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Insufficient wallet balance.');
  END IF;

  UPDATE public.users
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_sender_user_id
  RETURNING wallet_balance INTO v_sender_balance;

  UPDATE public.users
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = v_receiver.id
  RETURNING wallet_balance INTO v_receiver_balance;

  INSERT INTO public.wallet_transfers (
    sender_user_id,
    receiver_user_id,
    amount,
    note,
    channel,
    status,
    sender_balance_after,
    receiver_balance_after,
    metadata
  ) VALUES (
    p_sender_user_id,
    v_receiver.id,
    p_amount,
    p_note,
    'wallet',
    'completed',
    v_sender_balance,
    v_receiver_balance,
    jsonb_build_object('receiver_phone', v_normalized_phone)
  );

  INSERT INTO public.transactions (
    from_user_id,
    to_user_id,
    amount,
    type,
    status,
    description,
    created_at
  ) VALUES (
    p_sender_user_id,
    v_receiver.id,
    p_amount,
    'transfer',
    'success',
    COALESCE(p_note, 'Ratibu wallet transfer'),
    NOW()
  );

  PERFORM public.recompute_credit_score(p_sender_user_id);
  PERFORM public.recompute_credit_score(v_receiver.id);

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Transfer completed successfully.',
    'sender_balance', v_sender_balance,
    'receiver_balance', v_receiver_balance
  );
END;
$$;
