ALTER TABLE public.user_savings_targets
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_period_months INT CHECK (lock_period_months > 0),
  ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS savings_period_months INT CHECK (savings_period_months > 0),
  ADD COLUMN IF NOT EXISTS savings_period_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS early_withdrawal_penalty_percent NUMERIC(5, 2) NOT NULL DEFAULT 5
    CHECK (early_withdrawal_penalty_percent >= 0 AND early_withdrawal_penalty_percent <= 100);

UPDATE public.user_savings_targets
SET savings_period_months = COALESCE(savings_period_months, COALESCE(lock_period_months, 12)),
    savings_period_started_at = COALESCE(savings_period_started_at, created_at),
    early_withdrawal_penalty_percent = COALESCE(early_withdrawal_penalty_percent, 5),
    lock_started_at = COALESCE(lock_started_at, created_at),
    lock_until = CASE
      WHEN is_locked = true THEN COALESCE(lock_until, created_at + (COALESCE(lock_period_months, 12) || ' months')::interval)
      ELSE lock_until
    END
WHERE savings_period_months IS NULL
   OR savings_period_started_at IS NULL
   OR early_withdrawal_penalty_percent IS NULL
   OR (is_locked = true AND (lock_started_at IS NULL OR lock_until IS NULL));

ALTER TABLE public.user_savings_targets
  DROP CONSTRAINT IF EXISTS user_savings_targets_status_check;

ALTER TABLE public.user_savings_targets
  ADD CONSTRAINT user_savings_targets_status_check
    CHECK (status IN ('active', 'paused', 'completed', 'locked'));

ALTER TABLE public.user_savings_targets
  DROP CONSTRAINT IF EXISTS savings_lock_consistency;

ALTER TABLE public.user_savings_targets
  ADD CONSTRAINT savings_lock_consistency
    CHECK (
      (is_locked = false) OR
      (is_locked = true AND lock_until IS NOT NULL AND lock_period_months IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION public.guard_savings_target_amount_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_amount IS DISTINCT FROM OLD.current_amount THEN
    IF COALESCE(current_setting('ratibu.allow_savings_amount_update', true), 'false') <> 'true'
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Direct savings balance updates are not allowed. Use the savings transaction RPC.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_savings_target_amount_updates ON public.user_savings_targets;
CREATE TRIGGER trg_guard_savings_target_amount_updates
  BEFORE UPDATE ON public.user_savings_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_savings_target_amount_updates();

CREATE OR REPLACE FUNCTION public.process_ussd_savings_transaction(
    p_user_id UUID,
    p_target_id UUID,
    p_amount NUMERIC,
    p_tx_type TEXT,
    p_channel TEXT DEFAULT 'web'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target RECORD;
    v_next_amount NUMERIC;
    v_now TIMESTAMPTZ := NOW();
    v_period_end TIMESTAMPTZ;
    v_penalty_percent NUMERIC := 0;
    v_penalty_amount NUMERIC := 0;
    v_payout_amount NUMERIC := 0;
    v_channel TEXT := COALESCE(NULLIF(p_channel, ''), 'web');
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid amount.');
    END IF;

    IF p_tx_type NOT IN ('deposit', 'withdrawal') THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Unsupported savings action.');
    END IF;

    SELECT id, name, current_amount, status, is_locked, lock_until, lock_period_months,
           lock_started_at, savings_period_months, savings_period_started_at,
           early_withdrawal_penalty_percent, created_at
    INTO v_target
    FROM public.user_savings_targets
    WHERE id = p_target_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Savings target not found.');
    END IF;

    IF p_tx_type = 'withdrawal' THEN
        IF v_target.is_locked = true AND v_target.lock_until IS NOT NULL AND v_now < v_target.lock_until THEN
            RETURN jsonb_build_object(
                'ok', false,
                'message', format('%s is locked until %s.', v_target.name, to_char(v_target.lock_until, 'DD Mon YYYY'))
            );
        END IF;

        IF p_amount > COALESCE(v_target.current_amount, 0) THEN
            RETURN jsonb_build_object('ok', false, 'message', 'Amount exceeds available savings balance.');
        END IF;

        v_period_end := CASE
            WHEN v_target.savings_period_started_at IS NOT NULL AND v_target.savings_period_months IS NOT NULL THEN
                v_target.savings_period_started_at + (v_target.savings_period_months || ' months')::interval
            ELSE NULL
        END;

        IF v_period_end IS NOT NULL AND v_now < v_period_end THEN
            v_penalty_percent := COALESCE(v_target.early_withdrawal_penalty_percent, 0);
            v_penalty_amount := ROUND((p_amount * v_penalty_percent / 100.0)::numeric, 2);
            v_payout_amount := GREATEST(p_amount - v_penalty_amount, 0);
        ELSE
            v_payout_amount := p_amount;
        END IF;
    END IF;

    v_next_amount := CASE
        WHEN p_tx_type = 'deposit' THEN COALESCE(v_target.current_amount, 0) + p_amount
        ELSE COALESCE(v_target.current_amount, 0) - p_amount
    END;

    PERFORM set_config('ratibu.allow_savings_amount_update', 'true', true);

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
        v_channel,
        CASE
            WHEN p_tx_type = 'deposit' THEN format('Savings deposit to %s', v_target.name)
            ELSE format('Savings withdrawal from %s', v_target.name)
        END,
        jsonb_build_object(
            'channel', v_channel,
            'savings_target_name', v_target.name,
            'previous_amount', COALESCE(v_target.current_amount, 0),
            'next_amount', v_next_amount,
            'savings_period_months', v_target.savings_period_months,
            'savings_period_ends_at', v_period_end,
            'is_locked', v_target.is_locked,
            'lock_until', v_target.lock_until,
            'penalty_percent', v_penalty_percent,
            'penalty_amount', v_penalty_amount,
            'payout_amount', v_payout_amount
        ),
        v_now,
        v_now
    );

    RETURN jsonb_build_object(
        'ok', true,
        'next_amount', v_next_amount,
        'penalty_amount', v_penalty_amount,
        'payout_amount', v_payout_amount,
        'message', CASE
            WHEN p_tx_type = 'withdrawal' AND v_penalty_amount > 0
                THEN format('Withdrawal processed. A KES %s penalty was applied.', ROUND(v_penalty_amount, 2))
            WHEN p_tx_type = 'withdrawal'
                THEN 'Withdrawal processed.'
            ELSE 'Deposit recorded.'
        END
    );
END;
$$;
