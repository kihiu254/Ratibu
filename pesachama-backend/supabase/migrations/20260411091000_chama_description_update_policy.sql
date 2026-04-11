ALTER TABLE public.chamas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chamas'
      AND policyname = 'Chama creators and admins can update chama details'
  ) THEN
    CREATE POLICY "Chama creators and admins can update chama details"
    ON public.chamas
    FOR UPDATE
    USING (
      auth.uid() = created_by
      OR EXISTS (
        SELECT 1
        FROM public.chama_members cm
        WHERE cm.chama_id = chamas.id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'active'
      )
    )
    WITH CHECK (
      auth.uid() = created_by
      OR EXISTS (
        SELECT 1
        FROM public.chama_members cm
        WHERE cm.chama_id = chamas.id
          AND cm.user_id = auth.uid()
          AND cm.role = 'admin'
          AND cm.status = 'active'
      )
    );
  END IF;
END $$;
