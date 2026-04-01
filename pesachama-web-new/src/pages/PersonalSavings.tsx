import { useEffect, useState } from 'react'
import { Pause, Play, Plus, Target, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'

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
  notes: ''
}

export default function PersonalSavings() {
  const [userId, setUserId] = useState<string | null>(null)
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newSavingsTarget, setNewSavingsTarget] = useState(emptySavingsTarget)

  useEffect(() => {
    void loadSavingsTargets()
  }, [])

  async function loadSavingsTargets() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)
      const { data, error } = await supabase
        .from('user_savings_targets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSavingsTargets((data || []) as SavingsTarget[])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load savings plans')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateSavingsTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return

    try {
      setSaving(true)
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
        })

      if (error) throw error

      setNewSavingsTarget(emptySavingsTarget)
      setShowForm(false)
      toast.success('Savings plan created')
      await loadSavingsTargets()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create savings plan')
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

      if (error) throw error
      setSavingsTargets((current) => current.map((item) =>
        item.id === target.id ? { ...item, status: nextStatus } : item
      ))
    } catch (error: any) {
      toast.error(error.message || 'Failed to update savings plan')
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
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#00C853] text-white font-bold shadow-lg shadow-green-500/20"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Close Form' : 'New Savings Plan'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateSavingsTarget} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
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
          <button
            type="submit"
            disabled={saving}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
          >
            <Wallet className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Savings Plan'}
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
            return (
              <div key={target.id} className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{target.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {target.destination_label || formatPurpose(target.purpose)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStatus(target)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold"
                  >
                    {target.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {target.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500 dark:text-slate-400">KES {Number(target.current_amount).toLocaleString()}</span>
                  <span className="font-bold text-slate-900 dark:text-white">KES {Number(target.target_amount).toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-4">
                  <div className="h-full bg-[#00C853]" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
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
                </div>
                {target.notes && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">{target.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
