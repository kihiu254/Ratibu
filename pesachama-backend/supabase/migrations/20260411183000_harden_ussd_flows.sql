-- Harden USSD flows with idempotency, request throttling, and atomic writes.

CREATE TABLE IF NOT EXISTS public.ussd_request_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    request_text TEXT NOT NULL,
    response_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ussd_request_log_session_text
    ON public.ussd_request_log(session_id, request_text);

CREATE INDEX IF NOT EXISTS idx_ussd_request_log_phone_created_at
    ON public.ussd_request_log(phone_number, created_at DESC);

ALTER TABLE public.ussd_request_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.process_ussd_savings_transaction(
    p_user_id UUID,
    p_target_id UUID,
    p_amount NUMERIC,
    p_tx_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target RECORD;
    v_next_amount NUMERIC;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid amount.');
    END IF;

    IF p_tx_type NOT IN ('deposit', 'withdrawal') THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Unsupported savings action.');
    END IF;

    SELECT id, name, current_amount, status, is_locked, lock_until
    INTO v_target
    FROM public.user_savings_targets
    WHERE id = p_target_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Savings target not found.');
    END IF;

    IF p_tx_type = 'withdrawal' AND (v_target.is_locked = true OR v_target.status = 'locked') THEN
        RETURN jsonb_build_object('ok', false, 'message', format('%s is locked. Withdrawals are disabled until it unlocks.', v_target.name));
    END IF;

    IF p_tx_type = 'withdrawal' AND p_amount > COALESCE(v_target.current_amount, 0) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Amount exceeds available savings balance.');
    END IF;

    v_next_amount := CASE
        WHEN p_tx_type = 'deposit' THEN COALESCE(v_target.current_amount, 0) + p_amount
        ELSE COALESCE(v_target.current_amount, 0) - p_amount
    END;

    UPDATE public.user_savings_targets
    SET current_amount = v_next_amount,
        updated_at = v_now
    WHERE id = p_target_id
      AND user_id = p_user_id;

    INSERT INTO public.transactions (
        user_id,
        savings_target_id,
        type,
        amount,
        status,
        payment_method,
        description,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_target_id,
        p_tx_type,
        p_amount,
        'completed',
        'ussd',
        format('USSD savings %s', p_tx_type),
        jsonb_build_object(
            'channel', 'ussd',
            'savings_target_name', v_target.name,
            'previous_amount', COALESCE(v_target.current_amount, 0),
            'next_amount', v_next_amount
        ),
        v_now,
        v_now
    );

    RETURN jsonb_build_object('ok', true, 'next_amount', v_next_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ussd_chama_withdrawal_request(
    p_user_id UUID,
    p_chama_id UUID,
    p_amount NUMERIC,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_role TEXT;
    v_chama_name TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid amount.');
    END IF;

    SELECT cm.role, c.name
    INTO v_member_role, v_chama_name
    FROM public.chama_members cm
    INNER JOIN public.chamas c ON c.id = cm.chama_id
    WHERE cm.user_id = p_user_id
      AND cm.chama_id = p_chama_id
      AND cm.status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Join the chama first.');
    END IF;

    IF v_member_role NOT IN ('admin', 'treasurer') THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Only chama admins or treasurers can request withdrawals.');
    END IF;

    INSERT INTO public.transactions (
        chama_id,
        user_id,
        type,
        amount,
        status,
        payment_method,
        description,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_chama_id,
        p_user_id,
        'withdrawal',
        p_amount,
        'pending',
        'ussd',
        format('USSD withdrawal request for %s', v_chama_name),
        jsonb_build_object(
            'channel', 'ussd',
            'chama_name', v_chama_name,
            'reason', COALESCE(p_reason, '')
        ),
        v_now,
        v_now
    );

    RETURN jsonb_build_object('ok', true);
END;
$$;
