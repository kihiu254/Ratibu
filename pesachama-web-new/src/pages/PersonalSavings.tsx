import { useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, FileText, Lock, Pause, Play, Plus, Target, Wallet, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isMissingOrUnauthorizedSavingsTargets } from '../lib/supabaseErrors'
import { toast } from '../utils/toast'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function progressWidthClass(progress: number) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
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

type SavingsPurpose =
  | 'emergency'
  | 'rent'
  | 'daily_payments'
  | 'bill_payment'
  | 'school_fees'
  | 'business'
  | 'investment'
  | 'withdrawal'
  | 'custom'

type AllocationType = 'percentage' | 'fixed_amount'
type SavingsStatus = 'active' | 'paused' | 'completed'

interface SavingsTarget {
  id: string
  name: string
  purpose: SavingsPurpose
  destination_label: string | null
  target_amount: number
  current_amount: number
  auto_allocate: boolean
  allocation_type: AllocationType
  allocation_value: number
  status: SavingsStatus
  notes: string | null
  is_locked?: boolean
  lock_period_months?: number
  lock_until?: string
  lock_started_at?: string
  savings_period_months?: number
  savings_period_started_at?: string
  early_withdrawal_penalty_percent?: number
}

const emptySavingsTarget = {
  name: '',
  purpose: 'emergency' as SavingsPurpose,
  destination_label: '',
  target_amount: 0,
  current_amount: 0,
  auto_allocate: true,
  allocation_type: 'percentage' as AllocationType,
  allocation_value: 100,
  notes: '',
  is_locked: false,
  lock_period_months: 12,
  savings_period_months: 12,
  early_withdrawal_penalty_percent: 5
}

const savingsTargetLegacySelect = [
  'id',
  'name',
  'purpose',
  'destination_label',
  'target_amount',
  'current_amount',
  'auto_allocate',
  'allocation_type',
  'allocation_value',
  'status',
  'notes',
  'created_at',
  'updated_at',
].join(', ')

const savingsTargetBaseSelect = [
  savingsTargetLegacySelect,
  'savings_period_months',
  'savings_period_started_at',
  'early_withdrawal_penalty_percent',
].join(', ')

const savingsTargetLockSelect = [
  savingsTargetBaseSelect,
  'is_locked',
  'lock_period_months',
  'lock_until',
  'lock_started_at',
].join(', ')

function normalizeSavingsTargets(data: Partial<SavingsTarget>[] | null | undefined): SavingsTarget[] {
  return (data || []).map((target) => ({
    id: target.id || '',
    name: target.name || '',
    purpose: (target.purpose || 'custom') as SavingsPurpose,
    destination_label: target.destination_label ?? null,
    target_amount: Number(target.target_amount || 0),
    current_amount: Number(target.current_amount || 0),
    auto_allocate: target.auto_allocate ?? true,
    allocation_type: (target.allocation_type || 'percentage') as AllocationType,
    allocation_value: Number(target.allocation_value || 0),
    status: (target.status || 'active') as SavingsStatus,
    notes: target.notes ?? null,
    is_locked: Boolean(target.is_locked),
    lock_period_months: target.lock_period_months,
    lock_until: target.lock_until,
    lock_started_at: target.lock_started_at,
    savings_period_months: target.savings_period_months,
    savings_period_started_at: target.savings_period_started_at,
    early_withdrawal_penalty_percent: Number(target.early_withdrawal_penalty_percent ?? 5),
  }))
}

export default function PersonalSavings() {
  const [userId, setUserId] = useState<string | null>(null)
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState<'regular' | 'locked' | null>(null)
  const [newSavingsTarget, setNewSavingsTarget] = useState(emptySavingsTarget)
  const [txModal, setTxModal] = useState<{ target: SavingsTarget; type: 'deposit' | 'withdraw' } | null>(null)
  const [txAmount, setTxAmount] = useState('')
  const [txLoading, setTxLoading] = useState(false)

  useEffect(() => {
    void loadSavingsTargets()
  }, [])

  async function loadSavingsTargets() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSavingsTargets([])
        return
      }

      setUserId(user.id)
      let { data, error } = await supabase
        .from('user_savings_targets')
        .select(savingsTargetLockSelect)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error && isMissingOrUnauthorizedSavingsTargets(error)) {
        const fallback = await supabase
          .from('user_savings_targets')
          .select(savingsTargetLegacySelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      setSavingsTargets(normalizeSavingsTargets(data as Partial<SavingsTarget>[]))
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load savings plans'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSavingsTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    try {
      setSaving(true)
      const isLocked = showForm === 'locked'
      const lockUntil = isLocked && newSavingsTarget.lock_period_months
        ? new Date(Date.now() + newSavingsTarget.lock_period_months * 30 * 24 * 60 * 60 * 1000).toISOString()
        : null
      const savingsPeriodMonths = isLocked
        ? Number(newSavingsTarget.lock_period_months || 12)
        : Number(newSavingsTarget.savings_period_months || 12)

      const { error } = await supabase
        .from('user_savings_targets')
        .insert({
          user_id: userId,
          name: newSavingsTarget.name.trim(),
          purpose: newSavingsTarget.purpose,
          destination_label: newSavingsTarget.destination_label.trim() || null,
          target_amount: Number(newSavingsTarget.target_amount),
          current_amount: Number(newSavingsTarget.current_amount) || 0,
          auto_allocate: newSavingsTarget.auto_allocate,
          allocation_type: newSavingsTarget.allocation_type,
          allocation_value: Number(newSavingsTarget.allocation_value),
          notes: newSavingsTarget.notes.trim() || null,
          is_locked: isLocked,
          lock_period_months: isLocked ? newSavingsTarget.lock_period_months : null,
          lock_until: lockUntil,
          lock_started_at: isLocked ? new Date().toISOString() : null,
          savings_period_months: savingsPeriodMonths,
          savings_period_started_at: new Date().toISOString(),
          early_withdrawal_penalty_percent: isLocked ? 0 : Number(newSavingsTarget.early_withdrawal_penalty_percent || 0),
        })

      if (error && isMissingOrUnauthorizedSavingsTargets(error)) {
        toast.error('Personal savings is not available until the latest database changes are applied.')
        return
      }
      if (error) throw error

      setNewSavingsTarget(emptySavingsTarget)
      setShowForm(null)
      toast.success(`${isLocked ? 'Lock savings' : 'Savings'} plan created`)
      await loadSavingsTargets()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create savings plan'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(target: SavingsTarget) {
    try {
      const nextStatus = target.status === 'active' ? 'paused' : 'active'
      const { error } = await supabase
        .from('user_savings_targets')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', target.id)

      if (error && isMissingOrUnauthorizedSavingsTargets(error)) {
        toast.error('Personal savings is not available until the latest database changes are applied.')
        return
      }
      if (error) throw error
      setSavingsTargets((current) => current.map((item) =>
        item.id === target.id ? { ...item, status: nextStatus } : item
      ))
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update savings plan'))
    }
  }

  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!txModal || !userId) return
    const amount = Number(txAmount)
    if (!amount || amount <= 0) return
    if (txModal.type === 'withdraw' && amount > Number(txModal.target.current_amount)) {
      toast.error('Amount exceeds available balance')
      return
    }

    try {
      setTxLoading(true)
      const { target, type } = txModal
      const { data, error } = await supabase.rpc('process_ussd_savings_transaction', {
        p_user_id: userId,
        p_target_id: target.id,
        p_amount: amount,
        p_tx_type: type === 'deposit' ? 'deposit' : 'withdrawal',
        p_channel: 'web',
      })

      if (error) {
        if (isMissingOrUnauthorizedSavingsTargets(error)) {
          toast.error('Personal savings is not available until the latest database changes are applied.')
          return
        }
        throw error
      }

      const result = data as { ok?: boolean; message?: string; next_amount?: number }
      if (!result?.ok) {
        throw new Error(result?.message || 'Transaction failed')
      }

      const next = Number(result.next_amount ?? target.current_amount)
      setSavingsTargets(prev => prev.map(t => t.id === target.id ? { ...t, current_amount: next } : t))
      toast.success(result.message || (type === 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded'))
      setTxModal(null)
      setTxAmount('')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Transaction failed'))
    } finally {
      setTxLoading(false)
    }
  }

  const formatPurpose = (purpose: SavingsPurpose) => {
    switch (purpose) {
      case 'daily_payments':
        return 'Daily payments'
      case 'bill_payment':
        return 'Bill payment'
      case 'school_fees':
        return 'School fees'
      default:
        return purpose.charAt(0).toUpperCase() + purpose.slice(1)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Personal Savings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Build savings plans for any viable goal and decide how future deposits should support them.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowForm('regular')}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#00C853] text-white font-bold shadow-lg shadow-green-500/20"
          >
            <Plus className="w-4 h-4" />
            Savings Account
          </button>
          <button
            onClick={() => setShowForm('locked')}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/20"
          >
            <Lock className="w-4 h-4" />
            Lock Savings
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreateSavingsTarget} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {showForm === 'locked' ? 'Create Lock Savings Account' : 'Create Savings Account'}
            </h3>
            <button type="button" onClick={() => setShowForm(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={newSavingsTarget.name}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder="Savings plan name"
              required
            />
            <select
              value={newSavingsTarget.purpose}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, purpose: e.target.value as SavingsPurpose }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="emergency">Emergency fund</option>
              <option value="rent">Rent</option>
              <option value="daily_payments">Daily payments</option>
              <option value="bill_payment">Bill payment</option>
              <option value="school_fees">School fees</option>
              <option value="business">Business capital</option>
              <option value="investment">Investment</option>
              <option value="withdrawal">Withdrawal reserve</option>
              <option value="custom">Custom</option>
            </select>
            <input
              value={newSavingsTarget.destination_label}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, destination_label: e.target.value }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder="Destination label e.g. December school fees"
            />
            <input
              type="number"
              min="1"
              step="0.01"
              value={newSavingsTarget.target_amount || ''}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, target_amount: Number(e.target.value) }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder="Target amount (KES)"
              required
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newSavingsTarget.current_amount || ''}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, current_amount: Number(e.target.value) }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder="Current saved (KES)"
            />
            <select
              value={newSavingsTarget.allocation_type}
              onChange={(e) => setNewSavingsTarget(prev => ({
                ...prev,
                allocation_type: e.target.value as AllocationType,
                allocation_value: e.target.value === 'percentage' ? 100 : prev.allocation_value
              }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="percentage">Allocate by percentage</option>
              <option value="fixed_amount">Allocate by fixed amount</option>
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              value={newSavingsTarget.allocation_value || ''}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, allocation_value: Number(e.target.value) }))}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              placeholder={newSavingsTarget.allocation_type === 'percentage' ? 'Allocation %' : 'Allocation amount (KES)'}
              required
            />
            {showForm === 'regular' && (
              <>
                <select
                  value={newSavingsTarget.savings_period_months || 12}
                  onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, savings_period_months: Number(e.target.value) }))}
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value={3}>Savings period: 3 months</option>
                  <option value={6}>Savings period: 6 months</option>
                  <option value={12}>Savings period: 12 months</option>
                  <option value={24}>Savings period: 24 months</option>
                  <option value={36}>Savings period: 36 months</option>
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newSavingsTarget.early_withdrawal_penalty_percent || 5}
                  onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, early_withdrawal_penalty_percent: Number(e.target.value) }))}
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  placeholder="Early withdrawal penalty (%)"
                />
              </>
            )}
            {showForm === 'locked' && (
              <select
                value={newSavingsTarget.lock_period_months || 12}
                onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, lock_period_months: Number(e.target.value) }))}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
                <option value={36}>36 months</option>
              </select>
            )}
          </div>
          <textarea
            value={newSavingsTarget.notes}
            onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            placeholder="Notes for this savings plan"
            rows={3}
          />
          <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={newSavingsTarget.auto_allocate}
              onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, auto_allocate: e.target.checked }))}
            />
            Enable automatic allocation toward this savings plan
          </label>
          {showForm === 'locked' && (
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold mb-2">🔒 Lock Savings Features:</p>
              <ul className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                <li>• Funds locked for {newSavingsTarget.lock_period_months || 12} months</li>
                <li>• No withdrawals allowed during lock period</li>
                <li>• Higher commitment to reach your savings goal</li>
              </ul>
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
          >
            <Wallet className="w-4 h-4" />
                        {saving ? 'Saving...' : showForm === 'locked' ? 'Create Lock Savings' : 'Save Savings Plan'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-slate-500">Loading savings plans...</div>
      ) : savingsTargets.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
          <Target className="w-12 h-12 text-[#00C853] mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-300 font-semibold">No savings plans yet.</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Create a plan for an emergency fund, school fees, a business goal, investments, rent, bills, or any other meaningful target.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {savingsTargets.map((target) => {
            const progress = Math.min((Number(target.current_amount) / Number(target.target_amount)) * 100, 100)
            const isLocked = Boolean(
              target.is_locked &&
              target.lock_until &&
              new Date(target.lock_until) > new Date()
            )
            const savingsPeriodEndsAt = target.savings_period_months && target.savings_period_started_at
              ? new Date(new Date(target.savings_period_started_at).getTime() + Number(target.savings_period_months) * 30 * 24 * 60 * 60 * 1000)
              : null
            const isSavingsPeriodActive = Boolean(savingsPeriodEndsAt && savingsPeriodEndsAt > new Date())
            const lockDaysLeft = isLocked ? Math.ceil((new Date(target.lock_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0
            const savingsDaysLeft = isSavingsPeriodActive && savingsPeriodEndsAt
              ? Math.ceil((savingsPeriodEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : 0
            
            return (
              <div key={target.id} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-black text-slate-900 dark:text-white">{target.name}</p>
                      {isLocked && <Lock className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {target.destination_label || formatPurpose(target.purpose)}
                    </p>
                    {isLocked && (
                      <p className="text-xs text-orange-500 mt-1">
                        Locked for {lockDaysLeft} more days
                      </p>
                    )}
                    {!isLocked && target.savings_period_months && savingsPeriodEndsAt && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Savings period: {target.savings_period_months} months
                        {isSavingsPeriodActive ? `, ${savingsDaysLeft} days left for penalty-free withdrawal` : ', penalty-free now'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setTxModal({ target, type: 'deposit' }); setTxAmount('') }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00C853]/10 text-[#00C853] text-sm font-semibold"
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isLocked) { toast.error('Cannot withdraw from locked savings'); return }
                        if (target.current_amount <= 0) { toast.error('No funds to withdraw'); return }
                        setTxModal({ target, type: 'withdraw' }); setTxAmount('')
                      }}
                      disabled={target.current_amount <= 0 || isLocked}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      Withdraw
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(target)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold"
                    >
                      {target.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {target.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500 dark:text-slate-400">KES {Number(target.current_amount).toLocaleString()}</span>
                  <span className="font-bold text-slate-900 dark:text-white">KES {Number(target.target_amount).toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-4">
                  <div className={`h-full bg-[#00C853] ${progressWidthClass(progress)}`} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="px-3 py-1 rounded-full bg-[#00C853]/10 text-[#00C853]">
                    {target.auto_allocate ? 'Auto allocation on' : 'Manual tracking'}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    {target.allocation_type === 'percentage'
                      ? `${Number(target.allocation_value)}% per matched saving`
                      : `KES ${Number(target.allocation_value).toLocaleString()} per matched saving`}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                    {target.status}
                  </span>
                  {!isLocked && target.early_withdrawal_penalty_percent !== undefined && (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      {Number(target.early_withdrawal_penalty_percent).toFixed(1)}% early withdrawal penalty
                    </span>
                  )}
                  {isLocked && (
                    <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/20 text-orange-500">
                      Locked
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/statement?account=savings_target&id=${target.id}&name=${encodeURIComponent(target.name)}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Statement
                  </a>
                </div>
                {target.notes && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">{target.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      {txModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {txModal.type === 'deposit' ? 'Deposit to' : 'Withdraw from'} {txModal.target.name}
              </p>
              <button onClick={() => setTxModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Current balance: <span className="font-bold text-slate-900 dark:text-white">KES {Number(txModal.target.current_amount).toLocaleString()}</span>
            </p>
            {!txModal.target.is_locked && txModal.target.savings_period_months && txModal.target.early_withdrawal_penalty_percent !== undefined && (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                Early withdrawals within {txModal.target.savings_period_months} months attract a {Number(txModal.target.early_withdrawal_penalty_percent).toFixed(1)}% penalty.
              </p>
            )}
            <form onSubmit={handleTransaction} className="space-y-4">
              <input
                type="number"
                min="1"
                step="0.01"
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                placeholder="Amount (KES)"
                max={txModal.type === 'withdraw' ? Number(txModal.target.current_amount) : undefined}
                required
              />
              <button
                type="submit"
                disabled={txLoading}
                className={`w-full py-3 rounded-2xl font-bold text-white ${
                  txModal.type === 'deposit' ? 'bg-[#00C853]' : 'bg-red-500'
                }`}
              >
                {txLoading ? 'Processing...' : txModal.type === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

