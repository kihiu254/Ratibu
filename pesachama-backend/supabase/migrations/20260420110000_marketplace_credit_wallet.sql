-- Marketplace, credit score, and internal wallet foundation for Ratibu.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marketplace_role_type_enum') THEN
    CREATE TYPE public.marketplace_role_type_enum AS ENUM ('vendor', 'agent', 'rider');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marketplace_application_status_enum') THEN
    CREATE TYPE public.marketplace_application_status_enum AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marketplace_tier_enum') THEN
    CREATE TYPE public.marketplace_tier_enum AS ENUM ('starter', 'trusted', 'partner', 'premium', 'elite');
  END IF;
END $$;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS credit_tier public.marketplace_tier_enum NOT NULL DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS marketplace_status JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.marketplace_role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_type public.marketplace_role_type_enum NOT NULL,
  status public.marketplace_application_status_enum NOT NULL DEFAULT 'pending',
  business_name TEXT,
  display_name TEXT,
  service_category TEXT,
  notes TEXT,
  score_snapshot INTEGER NOT NULL DEFAULT 0,
  required_score INTEGER NOT NULL DEFAULT 0,
  assigned_number TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_role_applications_user_role_pending
  ON public.marketplace_role_applications(user_id, role_type)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_marketplace_role_applications_status_created_at
  ON public.marketplace_role_applications(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_type public.marketplace_role_type_enum NOT NULL,
  business_name TEXT,
  display_name TEXT,
  service_category TEXT,
  till_number TEXT UNIQUE,
  agent_number TEXT UNIQUE,
  rider_code TEXT UNIQUE,
  delivery_zone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_profiles_user_role
  ON public.marketplace_profiles(user_id, role_type);

CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  channel TEXT NOT NULL DEFAULT 'wallet',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  sender_balance_after NUMERIC(15, 2),
  receiver_balance_after NUMERIC(15, 2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_sender_created_at
  ON public.wallet_transfers(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_receiver_created_at
  ON public.wallet_transfers(receiver_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.marketplace_role_minimum_score(p_role public.marketplace_role_type_enum)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'vendor' THEN 600
    WHEN 'rider' THEN 650
    WHEN 'agent' THEN 700
    ELSE 500
  END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_credit_score(p_user_id UUID)
RETURNS TABLE (
  credit_score INTEGER,
  credit_tier public.marketplace_tier_enum,
  eligible_roles JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points BIGINT := 0;
  v_referral_points BIGINT := 0;
  v_penalty_points BIGINT := 0;
  v_contributions BIGINT := 0;
  v_admin_roles BIGINT := 0;
  v_treasurer_roles BIGINT := 0;
  v_secretary_roles BIGINT := 0;
  v_completed_transfers BIGINT := 0;
  v_score INTEGER := 500;
  v_tier public.marketplace_tier_enum := 'starter';
  v_wallet_balance NUMERIC(15, 2) := 0;
BEGIN
  SELECT
    COALESCE(gs.points, 0),
    COALESCE(gs.referral_points, 0),
    COALESCE(gs.penalty_points, 0),
    COALESCE(gs.total_contributions, 0)
  INTO v_points, v_referral_points, v_penalty_points, v_contributions
  FROM public.gamification_stats gs
  WHERE gs.user_id = p_user_id;

  SELECT COUNT(*)
  INTO v_admin_roles
  FROM public.chama_members cm
  WHERE cm.user_id = p_user_id AND cm.status = 'active' AND cm.role = 'admin';

  SELECT COUNT(*)
  INTO v_treasurer_roles
  FROM public.chama_members cm
  WHERE cm.user_id = p_user_id AND cm.status = 'active' AND cm.role = 'treasurer';

  SELECT COUNT(*)
  INTO v_secretary_roles
  FROM public.chama_members cm
  WHERE cm.user_id = p_user_id AND cm.status = 'active' AND cm.role = 'secretary';

  SELECT COUNT(*)
  INTO v_completed_transfers
  FROM public.wallet_transfers wt
  WHERE wt.sender_user_id = p_user_id
    AND wt.status = 'completed';

  SELECT COALESCE(u.wallet_balance, 0)
  INTO v_wallet_balance
  FROM public.users u
  WHERE u.id = p_user_id;

  v_score := 500
    + ROUND(COALESCE(v_points, 0) / 25.0)::INTEGER
    + ROUND(COALESCE(v_referral_points, 0) / 40.0)::INTEGER
    + ROUND(COALESCE(v_contributions, 0) * 8.0)::INTEGER
    + ROUND(COALESCE(v_admin_roles, 0) * 20.0)::INTEGER
    + ROUND(COALESCE(v_treasurer_roles, 0) * 15.0)::INTEGER
    + ROUND(COALESCE(v_secretary_roles, 0) * 10.0)::INTEGER
    + ROUND(COALESCE(v_completed_transfers, 0) * 3.0)::INTEGER
    - ROUND(COALESCE(v_penalty_points, 0) / 20.0)::INTEGER;

  v_score := GREATEST(0, LEAST(1000, v_score));

  v_tier := CASE
    WHEN v_score >= 900 THEN 'elite'
    WHEN v_score >= 800 THEN 'premium'
    WHEN v_score >= 700 THEN 'partner'
    WHEN v_score >= 600 THEN 'trusted'
    ELSE 'starter'
  END;

  UPDATE public.users
  SET credit_score = v_score,
      credit_tier = v_tier,
      marketplace_status = jsonb_build_object(
        'wallet_balance', v_wallet_balance,
        'last_score_refresh_at', NOW()
      )
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    v_score,
    v_tier,
    jsonb_build_object(
      'vendor', v_score >= public.marketplace_role_minimum_score('vendor'),
      'rider', v_score >= public.marketplace_role_minimum_score('rider'),
      'agent', v_score >= public.marketplace_role_minimum_score('agent')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_credit_score_from_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.recompute_credit_score(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_credit_score_from_stats ON public.gamification_stats;
CREATE TRIGGER trg_sync_credit_score_from_stats
AFTER INSERT OR UPDATE ON public.gamification_stats
FOR EACH ROW
EXECUTE FUNCTION public.sync_credit_score_from_stats();

DROP TRIGGER IF EXISTS trg_sync_credit_score_from_chama_members ON public.chama_members;
CREATE TRIGGER trg_sync_credit_score_from_chama_members
AFTER INSERT OR UPDATE OR DELETE ON public.chama_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_credit_score_from_stats();

CREATE OR REPLACE FUNCTION public.get_marketplace_overview(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_roles JSONB := '[]'::jsonb;
  v_apps JSONB := '[]'::jsonb;
  v_profiles JSONB := '[]'::jsonb;
  v_chama_roles JSONB := '[]'::jsonb;
BEGIN
  SELECT id, first_name, last_name, phone, wallet_balance, credit_score, credit_tier, marketplace_status
  INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'User not found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'role', role_type,
    'business_name', business_name,
    'display_name', display_name,
    'service_category', service_category,
    'status', status,
    'required_score', required_score,
    'score_snapshot', score_snapshot,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_apps
  FROM public.marketplace_role_applications
  WHERE user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'role', role_type,
    'business_name', business_name,
    'display_name', display_name,
    'till_number', till_number,
    'agent_number', agent_number,
    'rider_code', rider_code,
    'delivery_zone', delivery_zone,
    'is_active', is_active
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_profiles
  FROM public.marketplace_profiles
  WHERE user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'chama_id', cm.chama_id,
    'chama_name', c.name,
    'role', cm.role
  ) ORDER BY c.name), '[]'::jsonb)
  INTO v_chama_roles
  FROM public.chama_members cm
  INNER JOIN public.chamas c ON c.id = cm.chama_id
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active';

  v_roles := jsonb_build_object(
    'vendor', COALESCE(v_user.credit_score, 500) >= public.marketplace_role_minimum_score('vendor'),
    'rider', COALESCE(v_user.credit_score, 500) >= public.marketplace_role_minimum_score('rider'),
    'agent', COALESCE(v_user.credit_score, 500) >= public.marketplace_role_minimum_score('agent')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'first_name', v_user.first_name,
      'last_name', v_user.last_name,
      'phone', v_user.phone,
      'wallet_balance', COALESCE(v_user.wallet_balance, 0),
      'credit_score', COALESCE(v_user.credit_score, 500),
      'credit_tier', COALESCE(v_user.credit_tier, 'starter'),
      'marketplace_status', COALESCE(v_user.marketplace_status, '{}'::jsonb)
    ),
    'eligible_roles', v_roles,
    'chama_roles', v_chama_roles,
    'applications', v_apps,
    'profiles', v_profiles
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_marketplace_role(
  p_user_id UUID,
  p_role public.marketplace_role_type_enum,
  p_business_name TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL,
  p_service_category TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_required INTEGER := 0;
BEGIN
  SELECT COALESCE(credit_score, 500)
  INTO v_score
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'User not found');
  END IF;

  v_required := public.marketplace_role_minimum_score(p_role);

  IF v_score < v_required THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', format('A %s role needs a credit score of at least %s.', p_role, v_required),
      'required_score', v_required,
      'current_score', v_score
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.marketplace_role_applications
    WHERE user_id = p_user_id
      AND role_type = p_role
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You already have a pending application for this role.');
  END IF;

  INSERT INTO public.marketplace_role_applications (
    user_id,
    role_type,
    status,
    business_name,
    display_name,
    service_category,
    notes,
    score_snapshot,
    required_score
  ) VALUES (
    p_user_id,
    p_role,
    'pending',
    p_business_name,
    p_display_name,
    p_service_category,
    p_notes,
    v_score,
    v_required
  );

  RETURN jsonb_build_object('ok', true, 'message', 'Application submitted successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.review_marketplace_role(
  p_application_id UUID,
  p_approved BOOLEAN,
  p_till_number TEXT DEFAULT NULL,
  p_agent_number TEXT DEFAULT NULL,
  p_rider_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_application RECORD;
  v_profile_id UUID;
BEGIN
  SELECT system_role
  INTO v_caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_caller_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only admins can review marketplace applications.');
  END IF;

  SELECT *
  INTO v_application
  FROM public.marketplace_role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Application not found.');
  END IF;

  UPDATE public.marketplace_role_applications
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_application_id;

  IF p_approved THEN
    INSERT INTO public.marketplace_profiles (
      user_id,
      role_type,
      business_name,
      display_name,
      service_category,
      till_number,
      agent_number,
      rider_code,
      approved_by,
      approved_at,
      metadata
    ) VALUES (
      v_application.user_id,
      v_application.role_type,
      v_application.business_name,
      COALESCE(v_application.display_name, v_application.business_name),
      v_application.service_category,
      p_till_number,
      p_agent_number,
      p_rider_code,
      auth.uid(),
      NOW(),
      jsonb_build_object(
        'notes', v_application.notes,
        'score_snapshot', v_application.score_snapshot
      )
    )
    ON CONFLICT (user_id, role_type) DO UPDATE
    SET business_name = EXCLUDED.business_name,
        display_name = EXCLUDED.display_name,
        service_category = EXCLUDED.service_category,
        till_number = COALESCE(EXCLUDED.till_number, public.marketplace_profiles.till_number),
        agent_number = COALESCE(EXCLUDED.agent_number, public.marketplace_profiles.agent_number),
        rider_code = COALESCE(EXCLUDED.rider_code, public.marketplace_profiles.rider_code),
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        metadata = EXCLUDED.metadata,
        is_active = true,
        updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', CASE WHEN p_approved THEN 'Application approved.' ELSE 'Application rejected.' END);
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

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users LOOP
    PERFORM public.recompute_credit_score(r.id);
  END LOOP;
END $$;
