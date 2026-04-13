import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import TransactionApprovalModal from '../components/TransactionApprovalModal'
import { toast } from '../utils/toast'

function normalizePhone(value: string): string | null {
  const t = value.replace(/[\s\-()]/g, '')
  if (/^254\d{9}$/.test(t)) return t
  if (/^\+254\d{9}$/.test(t)) return t.slice(1)
  if (/^0\d{9}$/.test(t)) return `254${t.slice(1)}`
  return null
}

export default function KplcBill() {
  const [billType, setBillType] = useState<'prepaid' | 'postpaid'>('prepaid')
  const [meterNumber, setMeterNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [pendingPhone, setPendingPhone] = useState('')

  async function submitPayment() {
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!session?.access_token || !user) throw new Error('Please sign in again.')

    const response = await supabase.functions.invoke('trigger-stk-push', {
      body: {
        phoneNumber: pendingPhone || normalizePhone(phone) || phone,
        amount: pendingAmount || Number(amount),
        userId: user.id,
        destinationType: 'bill_payment',
        billerCode: billType === 'prepaid' ? '888880' : '888888',
        billAccountReference: meterNumber,
        billName: billType === 'prepaid' ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
      },
    })

    if (response.error) throw response.error
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-midnight text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <section className="pt-32 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8"
          >
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#00C853]">KPLC Electricity</p>
            <h1 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">Pay for tokens or postpaid electricity.</h1>
            <p className="mt-4 text-slate-500 dark:text-slate-400">
              The same Ratibu transaction PIN approves the payment before the M-Pesa prompt is sent.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBillType('prepaid')}
                className={`rounded-2xl px-4 py-3 font-bold ${billType === 'prepaid' ? 'bg-[#00C853] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
              >
                Prepaid Tokens
              </button>
              <button
                type="button"
                onClick={() => setBillType('postpaid')}
                className={`rounded-2xl px-4 py-3 font-bold ${billType === 'postpaid' ? 'bg-[#00C853] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
              >
                Postpaid Bill
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Meter / Account Number</span>
                <input
                  value={meterNumber}
                  onChange={(e) => setMeterNumber(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3"
                  placeholder={billType === 'prepaid' ? 'Meter number' : 'Account number'}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Amount (KES)</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="1"
                  className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3"
                  placeholder="e.g. 500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">M-Pesa Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3"
                  placeholder="07XXXXXXXX or 254XXXXXXXXX"
                />
              </label>

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  const normalizedPhone = normalizePhone(phone)
                  const parsedAmount = Number(amount)
                if (!normalizedPhone) return toast.error('Enter a valid phone number.')
                if (!meterNumber.trim()) return toast.error('Enter a meter/account number.')
                if (!parsedAmount || parsedAmount <= 0) return toast.error('Enter a valid amount.')
                  setPendingPhone(normalizedPhone)
                  setPendingAmount(parsedAmount)
                  setApprovalOpen(true)
                }}
                className="w-full rounded-2xl bg-[#00C853] px-4 py-3 font-bold text-white disabled:opacity-60"
              >
                {loading ? 'Sending...' : billType === 'prepaid' ? 'Pay KPLC Token' : 'Pay KPLC Bill'}
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <TransactionApprovalModal
        isOpen={approvalOpen}
        actionLabel="bill payment"
        amount={pendingAmount}
        onClose={() => setApprovalOpen(false)}
        onApproved={async () => {
          try {
            setLoading(true)
            await submitPayment()
            toast.success('STK push sent. Check your phone.')
            setApprovalOpen(false)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Payment failed')
          } finally {
            setLoading(false)
          }
        }}
      />
    </div>
  )
}
