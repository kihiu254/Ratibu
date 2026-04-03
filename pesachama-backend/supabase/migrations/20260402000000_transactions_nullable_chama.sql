-- Allow transactions without a chama (e.g. savings target deposits)
ALTER TABLE public.transactions
  ALTER COLUMN chama_id DROP NOT NULL;

-- Add savings_target_id for savings deposits
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS savings_target_id UUID
    REFERENCES public.user_savings_targets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_savings_target_id
  ON public.transactions(savings_target_id);

-- Ensure at least one destination is set
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_destination_check
    CHECK (chama_id IS NOT NULL OR savings_target_id IS NOT NULL);
