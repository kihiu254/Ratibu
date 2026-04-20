-- Credit score breakdown RPC for Ratibu wallet, marketplace, and USSD surfaces.

CREATE OR REPLACE FUNCTION public.get_credit_score_breakdown(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
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
  v_eligible_roles JSONB := '{}'::jsonb;
  v_chama_roles JSONB := '[]'::jsonb;
BEGIN
  SELECT
    id,
    first_name,
    last_name,
    phone,
    wallet_balance,
    credit_score,
    credit_tier,
    marketplace_status
  INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'User not found');
  END IF;

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
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active'
    AND cm.role = 'admin';

  SELECT COUNT(*)
  INTO v_treasurer_roles
  FROM public.chama_members cm
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active'
    AND cm.role = 'treasurer';

  SELECT COUNT(*)
  INTO v_secretary_roles
  FROM public.chama_members cm
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active'
    AND cm.role = 'secretary';

  SELECT COUNT(*)
  INTO v_completed_transfers
  FROM public.wallet_transfers wt
  WHERE wt.sender_user_id = p_user_id
    AND wt.status = 'completed';

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

  v_eligible_roles := jsonb_build_object(
    'vendor', v_score >= public.marketplace_role_minimum_score('vendor'),
    'rider', v_score >= public.marketplace_role_minimum_score('rider'),
    'agent', v_score >= public.marketplace_role_minimum_score('agent')
  );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'chama_id', cm.chama_id,
        'chama_name', c.name,
        'role', cm.role,
        'score_weight',
          CASE cm.role
            WHEN 'admin' THEN 20
            WHEN 'treasurer' THEN 15
            WHEN 'secretary' THEN 10
            ELSE 0
          END
      ) ORDER BY c.name
    ),
    '[]'::jsonb
  )
  INTO v_chama_roles
  FROM public.chama_members cm
  INNER JOIN public.chamas c ON c.id = cm.chama_id
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'first_name', v_user.first_name,
      'last_name', v_user.last_name,
      'phone', v_user.phone,
      'wallet_balance', COALESCE(v_user.wallet_balance, 0),
      'credit_score', COALESCE(v_user.credit_score, v_score),
      'credit_tier', COALESCE(v_user.credit_tier, v_tier),
      'marketplace_status', COALESCE(v_user.marketplace_status, '{}'::jsonb)
    ),
    'components', jsonb_build_object(
      'base_score', 500,
      'points_component', ROUND(COALESCE(v_points, 0) / 25.0)::INTEGER,
      'referral_component', ROUND(COALESCE(v_referral_points, 0) / 40.0)::INTEGER,
      'contribution_component', ROUND(COALESCE(v_contributions, 0) * 8.0)::INTEGER,
      'admin_role_component', ROUND(COALESCE(v_admin_roles, 0) * 20.0)::INTEGER,
      'treasurer_role_component', ROUND(COALESCE(v_treasurer_roles, 0) * 15.0)::INTEGER,
      'secretary_role_component', ROUND(COALESCE(v_secretary_roles, 0) * 10.0)::INTEGER,
      'transfer_component', ROUND(COALESCE(v_completed_transfers, 0) * 3.0)::INTEGER,
      'penalty_component', -ROUND(COALESCE(v_penalty_points, 0) / 20.0)::INTEGER,
      'total_penalty_points', COALESCE(v_penalty_points, 0)
    ),
    'eligible_roles', v_eligible_roles,
    'chama_roles', v_chama_roles,
    'role_rules', jsonb_build_array(
      jsonb_build_object('role', 'vendor', 'minimum_score', 600),
      jsonb_build_object('role', 'rider', 'minimum_score', 650),
      jsonb_build_object('role', 'agent', 'minimum_score', 700)
    ),
    'summary', format('Score %s, tier %s, based on rewards and penalties.', v_score, v_tier)
  );
END;
$$;
