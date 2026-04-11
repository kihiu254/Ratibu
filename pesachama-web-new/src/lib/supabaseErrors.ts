interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
  hint?: string
  status?: number
}

const SAVINGS_TARGETS_TABLE = 'user_savings_targets'

export function isMissingOrUnauthorizedSavingsTargets(error: SupabaseLikeError | null | undefined) {
  if (!error) return false

  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    text.includes(SAVINGS_TARGETS_TABLE) ||
    text.includes('is_locked') ||
    text.includes('lock_period_months') ||
    text.includes('lock_until') ||
    text.includes('lock_started_at') ||
    text.includes('permission denied') ||
    text.includes('does not exist') ||
    text.includes('could not find') ||
    text.includes('schema cache')
  )
}

export function isDuplicatePhoneError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false

  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    error.code === '23505' ||
    text.includes('phone number already exists') ||
    text.includes('duplicate key value') && text.includes('phone')
  )
}
