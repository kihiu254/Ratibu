CREATE TABLE IF NOT EXISTS public.mpesa_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  chama_id UUID REFERENCES public.chamas(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('c2b', 'b2b')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (
    status IN ('initiated', 'validated', 'completed', 'failed', 'cancelled', 'timed_out')
  ),
  request_reference TEXT UNIQUE,
  conversation_id TEXT,
  transaction_id TEXT UNIQUE,
  short_code TEXT,
  counterparty_short_code TEXT,
  phone_number TEXT,
  receiver_phone TEXT,
  bill_ref_number TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  partner_name TEXT,
  account_reference TEXT,
  result_code TEXT,
  result_desc TEXT,
  raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_callback JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mpesa_payment_events_user_created_at
  ON public.mpesa_payment_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mpesa_payment_events_chama_created_at
  ON public.mpesa_payment_events(chama_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mpesa_payment_events_request_reference
  ON public.mpesa_payment_events(request_reference);

CREATE INDEX IF NOT EXISTS idx_mpesa_payment_events_transaction_id
  ON public.mpesa_payment_events(transaction_id);

ALTER TABLE public.mpesa_payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own mpesa payment events" ON public.mpesa_payment_events
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      chama_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.chama_members cm
        WHERE cm.chama_id = mpesa_payment_events.chama_id
          AND cm.user_id = auth.uid()
      )
    )
  );
