import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, FileText, Layers, PiggyBank, Target, Wallet, Landmark, Pencil, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notifyUser } from '../lib/notify'
import { isMissingOrUnauthorizedSavingsTargets } from '../lib/supabaseErrors'
import TransactionApprovalModal from '../components/TransactionApprovalModal'
import { toast } from '../utils/toast'

interface ChamaAccount { id: string; name: string; description: string | null; contribution_amount: number | null }
interface SavingsTarget { id: string; name: string; purpose: string; current_amount: number; target_amount: number }
interface MemberRow { chamas: ChamaAccount | ChamaAccount[] | null }

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function progressWidthClass(progress: number) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))
  if (pct === 0) return 'w-0'
  if (pct <= 10) return 'w-[10%]'
  if (pct <= 20) return 'w-[20%]'
  if (pct <= 30) return 'w-[30%]'
  if (pct <= 40) return 'w-[40%]'
  if (pct <= 50) return 'w-[50%]'
  if (pct <= 60) return 'w-[60%]'
  if (pct <= 70) return 'w-[70%]'
  if (pct <= 80) return 'w-[80%]'
  if (pct <= 90) return 'w-[90%]'
  return 'w-full'
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function normalizePhone(value: string): string | null {
  const t = value.replace(/[\s\-()]/g, '')
  if (/^254\d{9}$/.test(t)) return t
  if (/^\+254\d{9}$/.test(t)) return t.slice(1)
  if (/^0\d{9}$/.test(t)) return `254${t.slice(1)}`
  return null
}

// ── Deposit modal (chama / savings target) ────────────────────────────────────
function DepositModal({ title, chamaId, savingsTargetId, onClose }: {
  title: string; chamaId?: string; savingsTargetId?: string; onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [pendingDeposit, setPendingDeposit] = useState<{ amount: number; phone: string } | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  async function executeDeposit(request: { amount: number; phone: string }) {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      const body: Record<string, unknown> = {
        phoneNumber: request.phone,
        amount: request.amount,
        userId: user!.id,
        ...(chamaId ? { chamaId } : {}),
        ...(savingsTargetId ? { savingsTargetId } : {}),
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'STK push failed')
      toast.success('STK push sent! Enter your M-Pesa PIN.')
      onClose()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return toast.error('Enter a valid amount')
    const normalized = normalizePhone(phone)
    if (!normalized) return toast.error('Use 07XXXXXXXX, 01XXXXXXXX or 254XXXXXXXXX format')

    setPendingDeposit({ amount: parsed, phone: normalized })
    setApprovalOpen(true)
  }

  return (
    <>
      <Modal title={`Deposit to ${title}`} onClose={onClose}>
        <form onSubmit={handleDeposit} className="space-y-4">
          <Field label="Amount (KES)" type="number" value={amount} onChange={setAmount} placeholder="e.g. 500" min="1" />
          <Field label="M-Pesa Phone" type="tel" value={phone} onChange={setPhone} placeholder="07XX or 254XX" />
          <ModalActions onClose={onClose} loading={loading} submitLabel="Pay via M-Pesa" />
        </form>
      </Modal>
      <TransactionApprovalModal
        isOpen={approvalOpen}
        actionLabel="deposit"
        amount={pendingDeposit?.amount ?? 0}
        onClose={() => {
          setApprovalOpen(false)
          setPendingDeposit(null)
        }}
        onApproved={async () => {
          if (!pendingDeposit) return
          await executeDeposit(pendingDeposit)
          setApprovalOpen(false)
          setPendingDeposit(null)
        }}
      />
    </>
  )
}

// ── Mshwari setup modal ───────────────────────────────────────────────────────
function MshwariSetupModal({ current, onSave, onClose }: {
  current: string; onSave: (phone: string) => Promise<void>; onClose: () => void
}) {
  const [phone, setPhone] = useState(current)
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) return toast.error('Use 07XXXXXXXX, 01XXXXXXXX or 254XXXXXXXXX format')
    setLoading(true)
    try { await onSave(normalized); onClose() }
    catch (err: unknown) { toast.error(getErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return <Modal title="Link Mshwari Account" onClose={onClose}>
    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
      Enter the phone number linked to your Mshwari account. Deposits go to paybill <strong>512400</strong> using this number as the account reference.
    </p>
    <form onSubmit={handleSave} className="space-y-4">
      <Field label="Mshwari Phone Number" type="tel" value={phone} onChange={setPhone} placeholder="07XX or 254XX" />
      <ModalActions onClose={onClose} loading={loading} submitLabel="Save & Continue" />
    </form>
  </Modal>
}

// ── Mshwari deposit modal ─────────────────────────────────────────────────────
function MshwariDepositModal({ mshwariPhone, onClose }: { mshwariPhone: string; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [pendingDeposit, setPendingDeposit] = useState<{ amount: number; phone: string } | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  async function executeDeposit(request: { amount: number; phone: string }) {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          phoneNumber: request.phone,
          amount: request.amount,
          userId: user!.id,
          destinationType: 'mshwari',
          mshwariPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'STK push failed')
      toast.success('STK push sent! Enter your M-Pesa PIN to deposit to Mshwari.')
      onClose()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return toast.error('Enter a valid amount')
    const normalized = normalizePhone(phone)
    if (!normalized) return toast.error('Use 07XXXXXXXX, 01XXXXXXXX or 254XXXXXXXXX format')

    setPendingDeposit({ amount: parsed, phone: normalized })
    setApprovalOpen(true)
  }

  return (
    <>
      <Modal title={`Deposit to Mshwari (${mshwariPhone})`} onClose={onClose}>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Funds will be sent to Mshwari paybill <strong>512400</strong>, account <strong>{mshwariPhone}</strong>.
        </p>
        <form onSubmit={handleDeposit} className="space-y-4">
          <Field label="Amount (KES)" type="number" value={amount} onChange={setAmount} placeholder="e.g. 500" min="1" />
          <Field label="Your M-Pesa Paying Phone" type="tel" value={phone} onChange={setPhone} placeholder="07XX or 254XX" />
          <ModalActions onClose={onClose} loading={loading} submitLabel="Pay via M-Pesa" />
        </form>
      </Modal>
      <TransactionApprovalModal
        isOpen={approvalOpen}
        actionLabel="deposit"
        amount={pendingDeposit?.amount ?? 0}
        onClose={() => {
          setApprovalOpen(false)
          setPendingDeposit(null)
        }}
        onApproved={async () => {
          if (!pendingDeposit) return
          await executeDeposit(pendingDeposit)
          setApprovalOpen(false)
          setPendingDeposit(null)
        }}
      />
    </>
  )
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label={`Close ${title} dialog`}
            title={`Close ${title} dialog`}
            className="text-slate-400 hover:text-slate-600"
          ><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder, min }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string; min?: string
}) {
  return (
    <div>
      <label className="text-sm text-slate-500 dark:text-slate-400 mb-1 block">{label}</label>
      <input
        type={type} min={min} value={value} onChange={e => onChange(e.target.value)}
        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
        placeholder={placeholder} required
      />
    </div>
  )
}

function ModalActions({ onClose, loading, submitLabel }: { onClose: () => void; loading: boolean; submitLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onClose}
        className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
        Cancel
      </button>
      <button type="submit" disabled={loading}
        className="flex-1 py-3 rounded-2xl bg-[#00C853] text-white font-bold shadow-lg shadow-green-500/20 disabled:opacity-50">
        {loading ? 'Sending...' : submitLabel}
      </button>
    </div>
  )
}

function AccountCard({ icon: Icon, iconBg, title, subtitle, badge, badgeColor = 'green', progress, depositLabel = 'Deposit', onDeposit, manageHref, statementHref, action }: {
  icon: React.ElementType; iconBg: string; title: string; subtitle: string
  badge?: string; badgeColor?: 'green' | 'orange'; progress?: number
  depositLabel?: string; onDeposit?: () => void; manageHref?: string; statementHref?: string; action?: React.ReactNode
}) {
  const badgeClass = badgeColor === 'orange'
    ? 'bg-orange-500/10 text-orange-500'
    : 'bg-[#00C853]/10 text-[#00C853]'

  return (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-2xl ${iconBg} flex-shrink-0`}><Icon className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white truncate">{title}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge && <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass}`}>{badge}</span>}
          {action}
        </div>
      </div>
      {progress !== undefined && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full bg-[#00C853] ${progressWidthClass(progress)}`} />
          </div>
          <p className="text-xs text-slate-400">{Math.round(progress * 100)}% of target</p>
        </div>
      )}
      <div className="flex gap-2">
        {onDeposit && (
          <button onClick={onDeposit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#00C853] text-white text-sm font-bold hover:bg-green-600 transition-colors">
            <ArrowDownToLine className="w-4 h-4" />{depositLabel}
          </button>
        )}
        {manageHref && (
          <Link to={manageHref}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Manage
          </Link>
        )}
        {statementHref && (
          <Link to={statementHref}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <FileText className="w-4 h-4" />
            Statement
          </Link>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</h2>
      </div>
      <p className="text-xs text-slate-400 mt-1 ml-6">{hint}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Accounts() {
  const [chamas, setChamas] = useState<ChamaAccount[]>([])
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([])
  const [mshwariPhone, setMshwariPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<
    | { type: 'chama'; id: string; name: string }
    | { type: 'savings'; id: string; name: string }
    | { type: 'mshwari_setup' }
    | { type: 'mshwari_deposit' }
    | null
  >(null)

  useEffect(() => { void loadAccounts() }, [])

  async function loadAccounts() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: memberRows }, { data: savingsRows, error: savingsError }, { data: profile }] = await Promise.all([
        supabase.from('chama_members').select('chamas(id, name, description, contribution_amount)')
          .eq('user_id', user.id).eq('status', 'active'),
        supabase.from('user_savings_targets').select('id, name, purpose, current_amount, target_amount, status')
          .eq('user_id', user.id).eq('status', 'active'),
        supabase.from('users').select('mshwari_phone').eq('id', user.id).maybeSingle(),
      ])

      setChamas(
        ((memberRows || []) as MemberRow[])
          .map((row) => firstItem(row.chamas))
          .filter((chama): chama is ChamaAccount => Boolean(chama))
      )
      if (savingsError && !isMissingOrUnauthorizedSavingsTargets(savingsError)) {
        throw savingsError
      }
      setSavingsTargets((savingsRows || []) as SavingsTarget[])
      setMshwariPhone(profile?.mshwari_phone || '')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  async function saveMshwariPhone(phone: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('users').update({ mshwari_phone: phone }).eq('id', user.id)
    if (error) throw error
    setMshwariPhone(phone)
    void notifyUser({
      targetUserId: user.id,
      title: 'Mshwari account linked',
      message: 'Your Mshwari phone number was saved successfully.',
      type: 'success',
      link: '/accounts',
      emailSubject: 'Mshwari account linked',
    }).catch(() => {})
    toast.success('Mshwari account linked!')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00C853]" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {/* Modals */}
      {modal?.type === 'chama' && (
        <DepositModal title={modal.name} chamaId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'savings' && (
        <DepositModal title={modal.name} savingsTargetId={modal.id} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'mshwari_setup' && (
        <MshwariSetupModal current={mshwariPhone} onSave={saveMshwariPhone} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'mshwari_deposit' && (
        <MshwariDepositModal mshwariPhone={mshwariPhone} onClose={() => setModal(null)} />
      )}

      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Accounts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Choose where to deposit.</p>
      </div>

      <div className="flex justify-end">
        <Link
          to="/statement?account=all&name=All%20Transactions"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#00C853]/30 text-[#00C853] font-semibold hover:bg-[#00C853]/10 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View Full Statement
        </Link>
      </div>

      {/* Chama Accounts */}
      <section>
        <SectionHeader icon={Layers} label="Chama Accounts" hint="Deposit directly into a chama pool" />
        {chamas.length === 0 ? (
          <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-500">
            No active chamas. <Link to="/explore" className="text-[#00C853] font-semibold">Explore chamas</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chamas.map(c => (
              <AccountCard key={c.id} icon={Layers}
                iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                title={c.name} subtitle={c.description || 'Chama account'}
                badge={c.contribution_amount ? `KES ${Number(c.contribution_amount).toLocaleString()}/cycle` : undefined}
                onDeposit={() => setModal({ type: 'chama', id: c.id, name: c.name })}
                manageHref={`/chama/${c.id}`}
                statementHref={`/statement?account=chama&id=${c.id}&name=${encodeURIComponent(c.name)}`} />
            ))}
          </div>
        )}
      </section>

      {/* Savings Accounts */}
      <section>
        <SectionHeader icon={PiggyBank} label="Savings Accounts" hint="Deposit into a personal savings plan" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccountCard icon={PiggyBank}
            iconBg="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
            title="Personal Savings" subtitle="General savings wallet"
            depositLabel="Manage Plans" manageHref="/personal-savings" />
          {savingsTargets.map(t => {
            const progress = t.target_amount > 0 ? t.current_amount / t.target_amount : 0
            return (
              <AccountCard key={t.id} icon={Target}
                iconBg="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                title={t.name}
                subtitle={`KES ${Number(t.current_amount).toLocaleString()} / KES ${Number(t.target_amount).toLocaleString()}`}
                progress={progress}
                onDeposit={() => setModal({ type: 'savings', id: t.id, name: t.name })}
                manageHref="/personal-savings"
                statementHref={`/statement?account=savings_target&id=${t.id}&name=${encodeURIComponent(t.name)}`} />
            )
          })}
        </div>
      </section>

      {/* Mshwari */}
      <section>
        <SectionHeader icon={Landmark} label="M-Pesa Mshwari"
          hint="Send funds to your Mshwari savings account via paybill 512400" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccountCard icon={Landmark}
            iconBg="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
            title="Mshwari Savings"
            subtitle={mshwariPhone ? `Linked: ${mshwariPhone}` : 'Tap to link your Mshwari phone number'}
            badge={mshwariPhone ? 'Linked' : 'Setup required'}
            badgeColor={mshwariPhone ? 'green' : 'orange'}
            depositLabel={mshwariPhone ? 'Deposit' : 'Set Up & Deposit'}
            onDeposit={() => mshwariPhone ? setModal({ type: 'mshwari_deposit' }) : setModal({ type: 'mshwari_setup' })}
            statementHref="/statement?account=mshwari&name=Mshwari+Savings"
            action={mshwariPhone ? (
              <button onClick={() => setModal({ type: 'mshwari_setup' })}
                aria-label="Edit linked Mshwari phone number"
                title="Edit linked Mshwari phone number"
                className="text-slate-400 hover:text-slate-600 p-1">
                <Pencil className="w-4 h-4" />
              </button>
            ) : undefined}
          />
        </div>
      </section>

      {/* Wallet */}
      <section>
        <SectionHeader icon={Wallet} label="Other" hint="General purpose wallet" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccountCard icon={Wallet}
            iconBg="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
            title="Ratibu Wallet" subtitle="General purpose wallet"
            onDeposit={() => toast.info('Select a chama or savings plan to deposit.')} />
        </div>
      </section>
    </div>
  )
}
