-- Seed default chamas for KYC categories
DO $$
DECLARE
  creator_id UUID;
BEGIN
  -- Prefer an admin/super_admin as the creator
  SELECT id INTO creator_id
  FROM public.users
  WHERE system_role IN ('admin', 'super_admin')
  ORDER BY created_at
  LIMIT 1;

  -- Fallback to the earliest user if no admin exists
  IF creator_id IS NULL THEN
    SELECT id INTO creator_id
    FROM public.users
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Skip seeding if there is no user yet
  IF creator_id IS NULL THEN
    RAISE NOTICE 'No users found. Skipping default chamas seed.';
    RETURN;
  END IF;

  INSERT INTO public.chamas (
    name,
    description,
    created_by,
    category,
    contribution_frequency,
    contribution_amount,
    member_limit,
    total_members,
    status
  )
  SELECT
    v.name,
    v.description,
    creator_id,
    v.category,
    v.frequency,
    v.amount,
    v.member_limit,
    v.total_members,
    v.status
  FROM (VALUES
    ('Bodabodas Chama', 'Savings circle for boda boda riders to grow daily earnings into long-term wealth.', 'Bodabodas', 'Weekly', 200, 30, 0, 'active'),
    ('House-helps Chama', 'Supportive savings group for house-helps building financial stability together.', 'House-helps', 'Weekly', 150, 30, 0, 'active'),
    ('Sales-people Chama', 'Collaborative savings for sales teams to smooth income cycles and invest.', 'Sales-people', 'Weekly', 250, 30, 0, 'active'),
    ('Grocery Owners Chama', 'Merchants pooling savings to stabilize stock and expand shops.', 'Grocery Owners', 'Weekly', 300, 30, 0, 'active'),
    ('Waiters Chama', 'Hospitality professionals saving together for goals and emergencies.', 'Waiters', 'Weekly', 200, 30, 0, 'active'),
    ('Health Workers Chama', 'Health workers building a safety net and future investments.', 'Health Workers', 'Monthly', 500, 30, 0, 'active'),
    ('Caretakers Chama', 'Caretakers pooling resources for education, housing, and business plans.', 'Caretakers', 'Weekly', 180, 30, 0, 'active'),
    ('Drivers Chama', 'Drivers saving for vehicle upkeep, insurance, and growth.', 'Drivers', 'Weekly', 250, 30, 0, 'active'),
    ('Fundis Chama', 'Skilled artisans saving for tools, jobs, and expanding services.', 'Fundis', 'Weekly', 220, 30, 0, 'active'),
    ('Conductors Chama', 'Public transport conductors building consistent savings habits.', 'Conductors', 'Weekly', 180, 30, 0, 'active')
  ) AS v(name, description, category, frequency, amount, member_limit, total_members, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chamas c WHERE c.name = v.name
  );
END $$;
