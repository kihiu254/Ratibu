-- Allow admins to inspect USSD request and audit logs from the web dashboard.

ALTER TABLE public.ussd_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs(action);

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ussd_request_log'
          AND policyname = 'System admins can view USSD request logs'
    ) THEN
        CREATE POLICY "System admins can view USSD request logs"
        ON public.ussd_request_log
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND u.system_role IN ('admin', 'super_admin')
            )
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'audit_logs'
          AND policyname = 'System admins can view audit logs'
    ) THEN
        CREATE POLICY "System admins can view audit logs"
        ON public.audit_logs
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND u.system_role IN ('admin', 'super_admin')
            )
        );
    END IF;
END $$;
