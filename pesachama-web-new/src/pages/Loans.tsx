import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeDollarSign, ChevronRight, Clock3, Landmark, PiggyBank, ScrollText, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'

interface LoanRow {
  id: string
  amount: number
  interest_rate: number | null
  duration_months: number | null
  status: string | null
  disbursement_date: string | null
  due_date: string | null
  created_at: string
  chamas?: { name?: string | null } | null
}

interface LoanRequestRow {
  id: string
  amount: number
  purpose: string
  term_months: number | null
  status: string | null
  notes: string | null
  created_at: string
}

function fmtDate(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function statusLabel(status: string | null) {
  switch ((status ?? 'pending').toLowerCase()) {
    case 'active':
      return 'Active'
    case 'approved':
      return 'Approved'
    case 'repaid':
      return 'Repaid'
    case 'defaulted':
      return 'Defaulted'
    default:
      return 'Pending'
  }
}

function statusClass(status: string | null) {
  switch ((status ?? 'pending').toLowerCase()) {
    case 'active':
    case 'approved':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    case 'repaid':
      return 'bg-sky-500/10 text-sky-500 border-sky-500/20'
    case 'defaulted':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    default:
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  }
}

export default function Loans() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LoanRow[]>([])
  const [requests, setRequests] = useState<LoanRequestRow[]>([])
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestAmount, setRequestAmount] = useState('')
  const [requestPurpose, setRequestPurpose] = useState('Working capital')
  const [requestTerm, setRequestTerm] = useState('3')
  const [requestNotes, setRequestNotes] = useState('')

  useEffect(() => {
    void loadLoans()
  }, [])

  async function loadLoans() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('loans')
        .select('id, amount, interest_rate, duration_months, status, disbursement_date, due_date, created_at, chamas(name)')
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRows((data ?? []) as LoanRow[])

      const requestRes = await supabase
        .from('loan_requests')
        .select('id, amount, purpose, term_months, status, notes, created_at')
        .eq('borrower_id', user.id)
        .order('created_at', { ascending: false })

      if (requestRes.error) throw requestRes.error
      setRequests((requestRes.data ?? []) as LoanRequestRow[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load loans')
    } finally {
      setLoading(false)
    }
  }

  async function submitRequest() {
    const amount = Number(requestAmount)
    const term = Number(requestTerm)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (!requestPurpose.trim()) {
      toast.error('Enter a purpose for the loan')
      return
    }

    setRequestSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please sign in again')
        return
      }

      const { error } = await supabase.from('loan_requests').insert({
        borrower_id: user.id,
        amount,
        purpose: requestPurpose.trim(),
        term_months: Number.isFinite(term) && term > 0 ? term : 3,
        notes: requestNotes.trim(),
      })

      if (error) throw error
      toast.success('Loan request submitted')
      setRequestOpen(false)
      setRequestAmount('')
      setRequestPurpose('Working capital')
      setRequestTerm('3')
      setRequestNotes('')
      await loadLoans()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setRequestSubmitting(false)
    }
  }

  const stats = useMemo(() => {
    const totalBorrowed = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const activeBalance = rows.reduce((sum, row) => {
      const status = (row.status ?? '').toLowerCase()
      if (['active', 'approved', 'pending'].includes(status)) return sum + Number(row.amount || 0)
      return sum
    }, 0)
    return { totalBorrowed, activeBalance }
  }, [rows])

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      <section className="pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 md:p-14 text-white border border-white/10 overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_35%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-[#00C853] mb-4">
              <BadgeDollarSign className="w-8 h-8" />
              <span className="text-xs font-black uppercase tracking-[0.35em]">Loans & Credit</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight">Track your loans from one Ratibu view.</h1>
            <p className="mt-6 max-w-3xl text-lg text-slate-300 leading-relaxed">
              See active, approved, and repaid loans for your account, with repayment timing and disbursement history in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/kcb-mpesa" className="rounded-2xl bg-[#00C853] px-5 py-3 font-bold text-white inline-flex items-center gap-2">
                Open KCB M-PESA <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/personal-savings" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white inline-flex items-center gap-2">
                View Savings <ChevronRight className="w-4 h-4" />
              </Link>
              <Link to="/statement?account=all&name=All%20Transactions" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white inline-flex items-center gap-2">
                Open Statement <ScrollText className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 px-5 py-3 font-bold text-white inline-flex items-center gap-2"
              >
                Request Loan <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Total Borrowed</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">KES {stats.totalBorrowed.toLocaleString()}</h2>
        </div>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Active Balance</p>
          <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">KES {stats.activeBalance.toLocaleString()}</h2>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Your Loans</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Current and historical loans linked to your Ratibu account.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400">
            Loading loans...
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-[28px] border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-[#00C853]">
                <Landmark className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">No loans found yet</h3>
              <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                Your loan records will appear here once a loan is approved or disbursed. You can still use the loan hub to reach KCB M-PESA, Products, and your statement.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">Request a new loan</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Submit a request for review when you need working capital.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestOpen(true)}
                  className="rounded-2xl bg-[#00C853] px-4 py-2 text-sm font-bold text-white inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Open form
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: 'KCB M-PESA Loans',
                  desc: 'Open the KCB hub for savings-linked loan journeys and related payment flows.',
                  href: '/kcb-mpesa',
                },
                {
                  title: 'Products & Credit',
                  desc: 'Review the Ratibu product suite, including loans, credit, and automation.',
                  href: '/products',
                },
                {
                  title: 'Loan Statements',
                  desc: 'Check any loan-related activity alongside the rest of your transaction history.',
                  href: '/statement?account=all&name=All%20Transactions',
                },
              ].map((card) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
                >
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">{card.title}</h4>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.desc}</p>
                  <Link to={card.href} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#00C853]">
                    Open <ChevronRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((loan, index) => {
              const amount = Number(loan.amount || 0)
              const interest = loan.interest_rate == null ? '0%' : `${Number(loan.interest_rate).toFixed(Number(loan.interest_rate) % 1 === 0 ? 0 : 1)}%`
              const duration = loan.duration_months == null ? 'n/a' : `${loan.duration_months} months`
              const chamaName = loan.chamas?.name?.trim() || 'Personal Loan'
              return (
                <motion.article
                  key={loan.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-2 text-[#00C853] font-black uppercase tracking-[0.25em] text-[11px]">
                        <PiggyBank className="w-4 h-4" />
                        Loan record
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{chamaName}</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Created {fmtDate(loan.created_at)}</p>
                    </div>
                    <span className={`self-start inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${statusClass(loan.status)}`}>
                      {statusLabel(loan.status)}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Amount</p>
                      <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">KES {amount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Interest</p>
                      <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{interest}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Duration</p>
                      <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{duration}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-[#00C853]" />
                      Due {fmtDate(loan.due_date)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-[#00C853]" />
                      Disbursement {fmtDate(loan.disbursement_date)}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </div>
        )}

        {requests.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-4">Loan Requests</h3>
            <div className="grid gap-4">
              {requests.map((req) => {
                const status = (req.status ?? 'pending').toLowerCase()
                const statusStyle = status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : status === 'rejected'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : status === 'disbursed'
                      ? 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">{req.purpose}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Requested {fmtDate(req.created_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${statusStyle}`}>
                        {statusLabel(req.status)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Amount</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">KES {Number(req.amount).toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Term</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{req.term_months ?? 3} months</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Status</p>
                        <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{statusLabel(req.status)}</p>
                      </div>
                    </div>
                    {req.notes ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{req.notes}</p> : null}
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {requestOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Request Loan</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submit a loan request for review.</p>
              </div>
              <button type="button" onClick={() => setRequestOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES)</span>
                <input
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
                  placeholder="e.g. 5000"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Term (months)</span>
                <input
                  value={requestTerm}
                  onChange={(e) => setRequestTerm(e.target.value)}
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
                  placeholder="3"
                />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Purpose</span>
                <input
                  value={requestPurpose}
                  onChange={(e) => setRequestPurpose(e.target.value)}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
                  placeholder="Working capital"
                />
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</span>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={4}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
                  placeholder="Optional notes about the loan request"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 px-5 py-3 font-bold text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={requestSubmitting}
                className="rounded-2xl bg-[#00C853] px-5 py-3 font-bold text-white inline-flex items-center gap-2 disabled:opacity-70"
              >
                {requestSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
