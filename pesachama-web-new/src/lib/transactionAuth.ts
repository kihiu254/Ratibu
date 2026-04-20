import { supabase } from './supabase'

type TransactionPinStatus = {
  enabled: boolean
  needsSetup: boolean
  resetRequired?: boolean
  attemptsRemaining?: number
}

async function invokeTransactionAuth(body: Record<string, unknown>) {
  let lastError: unknown = null
  for (let i = 0; i < 3; i += 1) {
    try {
      const { data, error } = await supabase.rpc('manage_transaction_pin', body)
      if (error) throw error
      return data as Record<string, unknown>
    } catch (error) {
      lastError = error
      const message = String(error).toLowerCase()
      if (
        message.includes('digest(text, unknown)') ||
        message.includes('function digest') ||
        message.includes('manage_transaction_pin')
      ) {
        throw new Error('Transaction PIN service is being repaired. Please try again in a moment.')
      }
      if (
        i === 2 ||
        !(message.includes('connection reset by peer') || message.includes('clientexception') || message.includes('socketexception'))
      ) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)))
    }
  }

  throw lastError ?? new Error('Request failed')
}

export async function getTransactionPinStatus(): Promise<TransactionPinStatus> {
  const data = await invokeTransactionAuth({ action: 'status' })
  return {
    enabled: data.enabled === true,
    needsSetup: data.needsSetup === true,
    resetRequired: data.resetRequired === true,
    attemptsRemaining: typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : Number(data.attemptsRemaining ?? 0),
  }
}

export async function setTransactionPin(pin: string) {
  await invokeTransactionAuth({ action: 'set', pin })
}

export async function resetTransactionPin(pin: string) {
  await invokeTransactionAuth({ action: 'reset', pin })
}

export async function adminResetTransactionPin(targetUserId: string) {
  await invokeTransactionAuth({ action: 'admin_reset', target_user_id: targetUserId })
}

export async function verifyTransactionPin(pin: string): Promise<boolean> {
  const data = await verifyTransactionPinDetailed(pin)
  return data.success
}

export async function verifyTransactionPinDetailed(pin: string): Promise<TransactionPinStatus & { success: boolean }> {
  const data = await invokeTransactionAuth({ action: 'verify', pin })
  return {
    enabled: data.enabled === true,
    needsSetup: data.needsSetup === true,
    resetRequired: data.resetRequired === true,
    attemptsRemaining: typeof data.attemptsRemaining === 'number' ? data.attemptsRemaining : Number(data.attemptsRemaining ?? 0),
    success: data.success === true,
  }
}
