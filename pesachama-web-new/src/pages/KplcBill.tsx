import { useEffect, useState } from 'react'
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

function validateMeterNumber(value: string): { ok: boolean; reason?: string } {
  const cleaned = value.replace(/[\s\-()]/g, '').trim()
  if (!cleaned) return { ok: false, reason: 'Enter a meter/account number.' }
  if (!/^\d{6,15}$/.test(cleaned)) {
    return { ok: false, reason: 'Meter/account numbers should be 6 to 15 digits.' }
  }
  const dummyValues = new Set([
    '000000',
    '0000000',
    '00000000',
    '000000000',
    '0000000000',
    '111111',
    '1111111',
    '11111111',
    '111111111',
    '1111111111',
    '123456',
    '1234567',
    '12345678',
    '123456789',
    '1234567890',
    '999999',
    '9999999',
    '99999999',
    '999999999',
    '9999999999',
  ])
  if (dummyValues.has(cleaned)) {
    return { ok: false, reason: 'That looks like a dummy meter number. Please enter a real KPLC meter/account number.' }
  }
  if (/^(\d)\1+$/.test(cleaned)) {
    return { ok: false, reason: 'That looks like a placeholder meter number. Please enter a real KPLC meter/account number.' }
  }
  return { ok: true }
}

type FavoriteMeter = {
  label: string
  value: string
}

const FAVORITES_STORAGE_KEY = 'ratibu.kplc.favorites'

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
  }
  return ''
}

function isMissingGatewayError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return normalized.includes('requested function was not found') ||
    normalized.includes('not_found') ||
    normalized.includes('functionexception(status: 404')
}

function summarizeKcbResponse(response: Record<string, unknown> | null) {
  const data = isRecord(response?.data) ? response.data : response
  const requestPayload = isRecord(data?.requestPayload) ? data.requestPayload : null
  const transactionInfo = isRecord(requestPayload?.transactionInfo) ? requestPayload.transactionInfo : null
  const billerData = isRecord(requestPayload?.billerData) ? requestPayload.billerData : null
  const payload: Record<string, unknown> | null = isRecord((data as Record<string, unknown> | null)?.payload)
    ? ((data as Record<string, unknown>).payload as Record<string, unknown>)
    : null

  const status = firstString(
    data?.status,
    data?.responseStatus,
    data?.responseCode,
    data?.resultCode,
    data?.code,
    data?.success === true ? 'success' : data?.success === false ? 'failed' : '',
    data?.error ? 'failed' : '',
  ).toUpperCase() || 'PENDING'

  const message = firstString(
    data?.message,
    data?.responseDescription,
    data?.description,
    data?.resultDesc,
    data?.reason,
    data?.detail,
    data?.error,
  ) || 'KCB returned a response.'

  const reference = firstString(
    transactionInfo?.transactionReference,
    transactionInfo?.originatorRequestId,
    transactionInfo?.billReference,
    transactionInfo?.billerRef,
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>)['originatorRequestId'] : undefined,
    data?.reference,
  ) || 'Not provided'

  const amount = firstString(transactionInfo?.transactionAmount, data?.amount)
  const billerCode = firstString(billerData?.billerCode, data?.billerCode)

  return {
    status,
    message,
    reference,
    amount,
    billerCode,
  }
}

function statusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('success') || normalized.includes('approved') || normalized.includes('ok')) return 'success'
  if (normalized.includes('fail') || normalized.includes('reject') || normalized.includes('error')) return 'error'
  return 'info'
}

function KcbSummaryCard({
  response,
  request,
  statusReference,
}: {
  response: Record<string, unknown> | null
  request: Record<string, unknown> | null
  statusReference: string
}) {
  const summary = summarizeKcbResponse(response)
  const tone = statusTone(summary.status)
  const statusClasses = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    error: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
    info: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400',
  }[tone]

  return (
    <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">KCB Result</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            A quick summary of the latest KCB gateway response.
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.25em] ${statusClasses}`}>
          {summary.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Reference</p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-slate-100">{summary.reference}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">Message</p>
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{summary.message}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-900 text-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Action</p>
          <p className="mt-2 text-sm font-semibold">{response?.action ? String(response.action) : 'unknown'}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Amount</p>
          <p className="mt-2 text-sm font-semibold">{summary.amount || 'n/a'}</p>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Biller Code</p>
          <p className="mt-2 text-sm font-semibold">{summary.billerCode || 'n/a'}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Status reference: <span className="font-semibold">{statusReference || 'none yet'}</span>
      </p>

      <details className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200">
          View raw request and response
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Last Request</p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
              {prettyJson(request)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Last Response</p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
              {prettyJson(response)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  )
}

export default function KplcBill() {
  const [billType, setBillType] = useState<'prepaid' | 'postpaid'>('prepaid')
  const [buyFor, setBuyFor] = useState<'self' | 'other'>('self')
  const [meterNumber, setMeterNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [pendingPhone, setPendingPhone] = useState('')
  const [debugLoading, setDebugLoading] = useState<'validate' | 'purchase' | 'status' | null>(null)
  const [debugRequest, setDebugRequest] = useState<Record<string, unknown> | null>(null)
  const [debugResponse, setDebugResponse] = useState<Record<string, unknown> | null>(null)
  const [statusReference, setStatusReference] = useState('')
  const [favorites, setFavorites] = useState<FavoriteMeter[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed)
        ? parsed.filter((item): item is FavoriteMeter => Boolean(item && typeof item.label === 'string' && typeof item.value === 'string'))
        : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites))
    } catch {
      // Ignore storage errors in private mode or unavailable storage.
    }
  }, [favorites])

  const quickMeters = favorites.length > 0 ? favorites : [
    { label: 'House 24-three Steers', value: '0175115472516' },
    { label: 'Office Main Line', value: '0716 242 252' },
  ]

  function addFavoriteMeter() {
    const cleaned = meterNumber.replace(/[\s\-()]/g, '').trim()
    if (!cleaned) {
      toast.info('Enter a meter number first.', 'Then tap Add to save it as a favourite.')
      return
    }

    const validation = validateMeterNumber(cleaned)
    if (!validation.ok) {
      toast.error(validation.reason || 'Enter a valid meter number.')
      return
    }

    setFavorites((current) => {
      if (current.some((item) => item.value === cleaned)) {
        toast.info('That meter is already in favourites.')
        return current
      }

      const next = [
        { label: cleaned.length > 12 ? `Meter ${cleaned.slice(-4)}` : `Meter ${cleaned}`, value: cleaned },
        ...current,
      ].slice(0, 6)
      toast.success('Favourite saved.')
      return next
    })
  }

  function removeFavoriteMeter(value: string) {
    setFavorites((current) => {
      const next = current.filter((item) => item.value !== value)
      if (next.length === current.length) return current
      toast.success('Favourite removed.')
      return next
    })
  }

  function buildBillerCode() {
    return billType === 'prepaid' ? '888880' : '888888'
  }

  function buildBasePayload() {
    const phoneNumber = pendingPhone || normalizePhone(phone) || phone
    const parsedAmount = pendingAmount || Number(amount)

    return {
      billerCode: buildBillerCode(),
      accountReference: meterNumber,
      amount: parsedAmount,
      phoneNumber,
      billName: billType === 'prepaid' ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
      transactionType: 'bill_payment',
      source: 'pesachama-web-new',
    }
  }

  async function invokeGateway(
    action: 'validate-request' | 'vendor-confirmation' | 'transaction-status',
    payload: Record<string, unknown>,
  ) {
    setDebugRequest({ action, payload })
    setDebugResponse(null)
    setDebugLoading(action === 'validate-request' ? 'validate' : action === 'vendor-confirmation' ? 'purchase' : 'status')

    const response = await supabase.functions.invoke('kcb-vending-gateway', {
      body: { action, payload },
    })

    if (response.error) throw response.error

    const data = (response.data ?? {}) as Record<string, unknown>
    setDebugResponse(data)
    return data
  }

  async function submitPayment() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Please sign in again.')

    const meterCheck = validateMeterNumber(meterNumber)
    if (!meterCheck.ok) throw new Error(meterCheck.reason)

    try {
      await invokeGateway('validate-request', buildBasePayload())
    } catch (error) {
      if (isMissingGatewayError(error)) {
        toast.warning(
          'KCB gateway not deployed yet',
          'Continuing with the M-Pesa payment flow so your checkout still works.',
        )
      } else {
        throw error
      }
    }

    const response = await supabase.functions.invoke('trigger-stk-push', {
      body: {
        phoneNumber: pendingPhone || normalizePhone(phone) || phone,
        amount: pendingAmount || Number(amount),
        userId: user.id,
        destinationType: 'bill_payment',
        billerCode: buildBillerCode(),
        billAccountReference: meterNumber,
        accountReference: meterNumber,
        billName: billType === 'prepaid' ? 'KPLC Prepaid Token' : 'KPLC Postpaid Bill',
      },
    })

    if (response.error) throw response.error
  }

  async function runDebugValidate() {
    try {
      setLoading(true)
      const data = await invokeGateway('validate-request', buildBasePayload())
      const nextReference =
        (data as any)?.data?.requestPayload?.transactionInfo?.transactionReference ??
        (data as any)?.data?.requestPayload?.transactionInfo?.originatorRequestId ??
        ''
      if (nextReference) setStatusReference(String(nextReference))
      toast.success('KCB validation returned.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation failed')
    } finally {
      setLoading(false)
      setDebugLoading(null)
    }
  }

  async function runDebugPurchase() {
    try {
      setLoading(true)
      const data = await invokeGateway('vendor-confirmation', {
        ...buildBasePayload(),
        transactionAmount: String(pendingAmount || Number(amount)),
        chargeFees: '0',
        transactionReference: statusReference || crypto.randomUUID(),
        billReference: meterNumber,
        narration: billType === 'prepaid' ? 'token purchase' : 'postpaid bill payment',
      })
      const nextReference =
        (data as any)?.data?.requestPayload?.transactionInfo?.transactionReference ??
        (data as any)?.data?.requestPayload?.transactionInfo?.originatorRequestId ??
        ''
      if (nextReference) setStatusReference(String(nextReference))
      toast.success('KCB purchase request returned.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Purchase failed')
    } finally {
      setLoading(false)
      setDebugLoading(null)
    }
  }

  async function runDebugStatus() {
    try {
      setLoading(true)
      const reference = statusReference || meterNumber.trim() || crypto.randomUUID()
      await invokeGateway('transaction-status', {
        originatorRequestId: reference,
      })
      setStatusReference(reference)
      toast.success('KCB transaction status returned.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Status check failed')
    } finally {
      setLoading(false)
      setDebugLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-midnight dark:text-slate-100">
      <section className="pt-28 pb-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="bg-gradient-to-br from-[#0f172a] via-[#102a43] to-[#00C853]/35 px-6 py-8 sm:px-8">
              <p className="text-xs font-black uppercase tracking-[0.42em] text-[#a7f3d0]">KPLC Electricity</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Buy Tokens</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                Use a guided KPLC flow with our Ratibu UI. You can buy for yourself or another meter, then approve the STK prompt on your phone.
              </p>
            </div>

            <div className="grid gap-6 p-6 sm:p-8">
              <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Buy for</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick who this token or bill is for.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    Guided checkout
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { key: 'self' as const, title: 'Buy for self', subtitle: 'Use a saved meter or account.' },
                    { key: 'other' as const, title: 'Buy for other', subtitle: 'Send tokens to another meter.' },
                  ].map((option) => {
                    const active = buyFor === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setBuyFor(option.key)}
                        className={`rounded-[22px] border px-4 py-4 text-left transition-all ${
                          active
                            ? 'border-[#00C853]/40 bg-[#00C853]/10 ring-1 ring-[#00C853]/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                              active ? 'border-[#00C853]' : 'border-slate-400'
                            }`}
                          >
                            {active ? <span className="h-2.5 w-2.5 rounded-full bg-[#00C853]" /> : null}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{option.title}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{option.subtitle}</p>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Bill type</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBillType('prepaid')}
                    className={`rounded-[22px] px-4 py-4 text-left font-semibold transition-all ${
                      billType === 'prepaid'
                        ? 'border border-[#00C853]/40 bg-[#00C853]/10 text-slate-900 dark:text-white'
                        : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Prepaid Tokens
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillType('postpaid')}
                    className={`rounded-[22px] px-4 py-4 text-left font-semibold transition-all ${
                      billType === 'postpaid'
                        ? 'border border-[#00C853]/40 bg-[#00C853]/10 text-slate-900 dark:text-white'
                        : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    Postpaid Bill
                  </button>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Favorites</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tap a meter to fill the form faster.</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-bold text-[#00C853] hover:underline"
                    onClick={addFavoriteMeter}
                  >
                    Save current meter
                  </button>
                </div>
                <div className="mt-5 flex gap-4 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={addFavoriteMeter}
                    className="flex min-w-[92px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                  >
                    <span className="text-3xl leading-none text-[#00C853]">+</span>
                    <span className="mt-2 text-xs font-semibold">Save</span>
                  </button>
                  {quickMeters.map((item) => {
                    const isSaved = favorites.some((favorite) => favorite.value === item.value)
                    return (
                      <div key={item.value} className="relative min-w-[220px]">
                        <button
                          type="button"
                          onClick={() => setMeterNumber(item.value)}
                          className="flex h-full w-full items-center gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-left dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C853] text-lg font-black text-white">
                            {item.label.charAt(0)}
                          </div>
                          <div className="pr-6">
                            <p className="font-semibold text-slate-900 dark:text-white">{item.label}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.value}</p>
                          </div>
                        </button>
                        {isSaved ? (
                          <button
                            type="button"
                            aria-label={`Remove ${item.label}`}
                            onClick={() => removeFavoriteMeter(item.value)}
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Buy Tokens</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the meter or account number and payment amount.</p>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{billType === 'prepaid' ? 'Meter Number' : 'Account Number'}</span>
                  <input
                    value={meterNumber}
                    onChange={(e) => setMeterNumber(e.target.value)}
                    className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-base shadow-sm outline-none transition focus:border-[#00C853] dark:border-slate-700 dark:bg-slate-900"
                    placeholder={billType === 'prepaid' ? '0175 115 472516' : 'Enter account number'}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We block obvious dummy meter numbers, but only a KPLC lookup API can confirm whether a meter is truly registered.
                </p>
                <label className="block">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Amount</span>
                  <div className="mt-2 flex items-center rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-sm font-black uppercase tracking-[0.24em] text-[#00C853]">KES</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      type="number"
                      min="1"
                      className="ml-3 w-full border-0 bg-transparent text-base outline-none placeholder:text-slate-400"
                      placeholder="e.g. 500"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">M-Pesa Phone</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-base shadow-sm outline-none transition focus:border-[#00C853] dark:border-slate-700 dark:bg-slate-900"
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
                    const meterCheck = validateMeterNumber(meterNumber)
                    if (!meterCheck.ok) return toast.error(meterCheck.reason || 'Enter a valid meter/account number.')
                    if (!parsedAmount || parsedAmount <= 0) return toast.error('Enter a valid amount.')
                    setPendingPhone(normalizedPhone)
                    setPendingAmount(parsedAmount)
                    setApprovalOpen(true)
                  }}
                  className="w-full rounded-[20px] bg-[#00C853] px-4 py-4 text-base font-black text-white shadow-lg shadow-[#00C853]/25 disabled:opacity-60"
                >
                  {loading ? 'Sending...' : billType === 'prepaid' ? 'Buy KPLC Token' : 'Pay KPLC Bill'}
                </button>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <details>
                  <summary className="cursor-pointer list-none text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Developer tools
                  </summary>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={runDebugValidate}
                      className="rounded-[18px] border border-slate-300 bg-white px-4 py-3 font-bold dark:border-slate-700 dark:bg-slate-900"
                    >
                      {debugLoading === 'validate' ? 'Validating...' : 'Debug Validate'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={runDebugPurchase}
                      className="rounded-[18px] border border-slate-300 bg-white px-4 py-3 font-bold dark:border-slate-700 dark:bg-slate-900"
                    >
                      {debugLoading === 'purchase' ? 'Purchasing...' : 'Debug Purchase'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={runDebugStatus}
                      className="rounded-[18px] border border-slate-300 bg-white px-4 py-3 font-bold dark:border-slate-700 dark:bg-slate-900"
                    >
                      {debugLoading === 'status' ? 'Checking...' : 'Debug Status'}
                    </button>
                  </div>
                </details>
              </section>

              <KcbSummaryCard response={debugResponse} request={debugRequest} statusReference={statusReference} />
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
