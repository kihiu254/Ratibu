import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '../utils/toast'
import {
  getTransactionPinStatus,
  setTransactionPin,
  verifyTransactionPinDetailed,
} from '../lib/transactionAuth'

type Props = {
  isOpen: boolean
  actionLabel: string
  amount: number
  onClose: () => void
  onApproved: () => Promise<void> | void
}

export default function TransactionApprovalModal({
  isOpen,
  actionLabel,
  amount,
  onClose,
  onApproved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [resetRequired, setResetRequired] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    void getTransactionPinStatus()
      .then((status) => {
        setNeedsSetup(status.needsSetup)
        setResetRequired(status.resetRequired ?? false)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load PIN status')
        onClose()
      })
      .finally(() => setLoading(false))
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pin || pin.length < 4 || pin.length > 6) {
      toast.error('Enter a 4 to 6 digit PIN')
      return
    }

    setSettingUp(true)
    try {
      if (needsSetup) {
        if (pin !== confirmPin) {
          toast.error('PINs do not match')
          return
        }
        await setTransactionPin(pin)
      } else {
        const result = await verifyTransactionPinDetailed(pin)
        if (!result.success) {
          if (result.resetRequired) {
            setResetRequired(true)
            toast.error('Your transaction PIN is locked. Ask an admin to reset it.')
          } else {
            toast.error(`Wrong transaction PIN. ${result.attemptsRemaining} attempt${result.attemptsRemaining === 1 ? '' : 's'} left.`)
          }
          return
        }
      }

      await onApproved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not confirm transaction')
    } finally {
      setSettingUp(false)
    }
  }

  const showResetBanner = resetRequired && !needsSetup

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#00C853]">Security Check</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Approve {actionLabel}</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Confirm KES {amount.toLocaleString()} before we continue.
          </p>
        </div>

        {showResetBanner && (
          <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-600">
            Your transaction PIN is locked. Ask an admin to reset it.
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                {needsSetup ? 'Create Transaction PIN' : 'Transaction PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\s+/g, ''))}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/15"
                placeholder="4-6 digit PIN"
                autoComplete="one-time-code"
              />
            </div>

            {needsSetup && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\s+/g, ''))}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/15"
                  placeholder="Confirm PIN"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              {showResetBanner ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-amber-500/30 px-4 py-3 font-bold text-amber-600"
                >
                  OK
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={settingUp}
                  className="flex-1 rounded-2xl bg-[#00C853] px-4 py-3 font-bold text-white shadow-lg shadow-green-500/20 disabled:opacity-60"
                >
                  {settingUp ? 'Working...' : needsSetup ? 'Save PIN' : 'Verify'}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
