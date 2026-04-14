-- Allow bill payments and Mshwari deposits to be recorded in transactions.
-- The earlier destination constraint only covered chama and savings-target rows.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_destination_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_destination_check
    CHECK (
      chama_id IS NOT NULL
      OR savings_target_id IS NOT NULL
      OR type IN ('bill_payment', 'mshwari_deposit')
    )
    NOT VALID;
