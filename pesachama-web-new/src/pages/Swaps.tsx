import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'

interface Allocation {
  user_id: string
  allocation_day: number
  user: { first_name: string; last_name: string } | null
}

interface SwapRequest {
  id: string
  requester_id: string
  target_user_id: string
  requester_day: number
  target_day: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requester: { first_name: string; last_name: string } | null
  target: { first_name: string; last_name: string } | null
}

interface Chama { id: string; name: string }

interface ChamaMemberRow {
  chamas: Chama | Chama[] | null
}

interface AllocationRow {
  user_id: string
  allocation_day: number
  user: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
}

interface SwapRequestRow {
  id: string
  requester_id: string
  target_user_id: string
  requester_day: number
  target_day: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requester: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
  target: Array<{ first_name: string; last_name: string }> | { first_name: string; last_name: string } | null
}

function asPerson(value: AllocationRow['user']) {
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizeAllocation(row: AllocationRow): Allocation {
  return {
    user_id: row.user_id,
    allocation_day: Number(row.allocation_day),
    user: asPerson(row.user),
  }
}

function normalizeSwapRequest(row: SwapRequestRow): SwapRequest {
  return {
    id: row.id,
    requester_id: row.requester_id,
    target_user_id: row.target_user_id,
    requester_day: Number(row.requester_day),
    target_day: Number(row.target_day),
    status: row.status,
    requester: asPerson(row.requester),
    target: asPerson(row.target),
  }
}

function asMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function isOfflineError(error: unknown) {
  const message = asMessage(error).toLowerCase()
  return !navigator.onLine
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message.includes('socketexception')
    || message.includes('failed host lookup')
    || message.includes('internet')
}

function friendlySwapError(error: unknown, fallback: string) {
  const message = asMessage(error)

  if (isOfflineError(error)) {
    return 'No internet connection. Reconnect and try again.'
  }

  if (message.toLowerCase().includes('duplicate key value violates unique constraint')) {
    return 'That allocation schedule changed while the swap was being approved. Refresh and try again.'
  }

  return message || fallback
}

function isMissingSwapEmailFunction(error: unknown) {
  const message = asMessage(error).toLowerCase()
  return message.includes('requested function was not found')
    || message.includes('not_found')
    || message.includes('status: 404')
}

function asChama(value: ChamaMemberRow['chamas']) {
  return Array.isArray(value) ? value[0] ?? null : value
}

const STATUS = {
  approved: { color: 'text-green-500', bg: 'bg-green-500/10', icon: CheckCircle, label: 'Approved' },
  rejected: { color: 'text-red-500',   bg: 'bg-red-500/10',   icon: XCircle,     label: 'Rejected' },
  cancelled:{ color: 'text-slate-400', bg: 'bg-slate-400/10', icon: XCircle,     label: 'Cancelled' },
  pending:  { color: 'text-orange-400',bg: 'bg-orange-400/10',icon: Clock,        label: 'Pending'  },
}

function avatar(name: string, color: string) {
  return (
    <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center font-black text-sm flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function fullName(u: { first_name: string; last_name: string } | null) {
  if (!u) return 'Member'
  return `${u.first_name} ${u.last_name}`.trim() || 'Member'
}

export default function Swaps() {
  const [chamas, setChamas] = useState<Chama[]>([])
  const [selectedChama, setSelectedChama] = useState<Chama | null>(null)
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<'schedule' | 'requests'>('schedule')
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [actingSwapId, setActingSwapId] = useState<string | null>(null)

  useEffect(() => { void init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyUserId(user.id)

    const { data: memberRows } = await supabase
      .from('chama_members')
      .select('chamas(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const list = ((memberRows || []) as ChamaMemberRow[])
      .map((row) => asChama(row.chamas))
      .filter((chama): chama is Chama => Boolean(chama))
    setChamas(list)
    if (list.length > 0) setSelectedChama(list[0])
    setLoading(false)
  }

  const loadData = useCallback(async () => {
    if (!selectedChama) return
    setLoadingData(true)
    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Reconnect and try again.')
      }

      const monthStr = format(month, 'yyyy-MM-dd')

      // Generate allocations via RPC
      await supabase.rpc('generate_monthly_allocations', {
        _chama_id: selectedChama.id,
        _month: monthStr,
      })

      const { data: allocs } = await supabase
        .from('chama_allocation_schedule')
        .select('user_id, allocation_day, user:users(first_name, last_name)')
        .eq('chama_id', selectedChama.id)
        .eq('allocation_month', monthStr)
        .order('allocation_day', { ascending: true })

      const { data: swaps } = await supabase
        .from('allocation_swap_requests')
        .select(`
          id, requester_id, target_user_id, requester_day, target_day, status,
          requester:users!allocation_swap_requests_requester_id_fkey(first_name, last_name),
          target:users!allocation_swap_requests_target_user_id_fkey(first_name, last_name)
        `)
        .eq('chama_id', selectedChama.id)
        .eq('month', monthStr)
        .order('created_at', { ascending: false })

      setAllocations(((allocs || []) as AllocationRow[]).map(normalizeAllocation))
      setSwapRequests(((swaps || []) as SwapRequestRow[]).map(normalizeSwapRequest))
    } catch (error: unknown) {
      toast.error(friendlySwapError(error, 'Failed to load data'))
    } finally {
      setLoadingData(false)
    }
  }, [month, selectedChama])

  useEffect(() => {
    if (selectedChama) void loadData()
  }, [loadData, selectedChama])

  async function sendSwapEmail(swapId: string, event: 'request_created' | 'approved' | 'rejected') {
    try {
      await supabase.functions.invoke('send-swap-email', {
        body: { swapId, event },
      })
    } catch (error) {
      if (isMissingSwapEmailFunction(error)) {
        console.warn('Swap email function is not deployed for this Supabase project. Skipping email send.')
        return
      }
      console.error('Failed to send swap email:', error)
    }
  }

  async function respondSwap(id: string, accept: boolean) {
    setActingSwapId(id)
    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Reconnect and try again.')
      }

      if (accept) {
        const { error } = await supabase.rpc('approve_allocation_swap', { _swap_id: id })
        if (error) throw error
        await sendSwapEmail(id, 'approved')
        toast.success('Swap accepted!')
      } else {
        const { error } = await supabase.from('allocation_swap_requests')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('target_user_id', myUserId)
          .eq('status', 'pending')
        if (error) throw error
        await sendSwapEmail(id, 'rejected')
        toast.success('Swap declined.')
      }
      void loadData()
    } catch (error: unknown) {
      toast.error(friendlySwapError(error, accept ? 'Failed to approve swap' : 'Failed to reject swap'))
    } finally {
      setActingSwapId(null)
    }
  }

  async function cancelSwap(id: string) {
    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Reconnect and try again.')
      }

      const { error } = await supabase
        .from('allocation_swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('requester_id', myUserId)
        .eq('status', 'pending')

      if (error) throw error
      toast.success('Swap request cancelled.')
      void loadData()
    } catch (error: unknown) {
      toast.error(friendlySwapError(error, 'Failed to cancel swap'))
    }
  }

  const myAllocation = allocations.find(a => a.user_id === myUserId)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00C853]" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {showSwapModal && selectedChama && myAllocation && (
        <SwapModal
          allocations={allocations}
          myUserId={myUserId!}
          myAllocation={myAllocation}
          chamaId={selectedChama.id}
          month={format(month, 'yyyy-MM-dd')}
          onClose={() => setShowSwapModal(false)}
          onCreated={() => { setShowSwapModal(false); void loadData() }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Swaps & Allocations</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your payout schedule and swap requests.</p>
        </div>
        <button
          onClick={() => myAllocation ? setShowSwapModal(true) : toast.info('You have no allocation for this month yet.')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00C853] text-white font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Request Swap
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Chama selector */}
        <select
          value={selectedChama?.id ?? ''}
          onChange={e => setSelectedChama(chamas.find(c => c.id === e.target.value) ?? null)}
          className="flex-1 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-[#00C853] transition-colors"
        >
          {chamas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Month navigator */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2">
          <button onClick={() => setMonth(m => subMonths(m, 1))}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-bold text-slate-900 dark:text-white w-28 text-center">
            {format(month, 'MMMM yyyy')}
          </span>
          <button onClick={() => setMonth(m => addMonths(m, 1))}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* My allocation banner */}
      {myAllocation && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#00C853] to-[#009624] text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">
            {myAllocation.allocation_day}
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Your Allocation</p>
            <p className="font-bold">Day {myAllocation.allocation_day} of {format(month, 'MMMM yyyy')}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        {(['schedule', 'requests'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {t === 'schedule'
              ? `Schedule (${allocations.length})`
              : `Requests (${swapRequests.length})`}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00C853]" />
        </div>
      ) : tab === 'schedule' ? (
        <ScheduleTab allocations={allocations} myUserId={myUserId} />
      ) : (
        <RequestsTab
          swapRequests={swapRequests}
          myUserId={myUserId}
          onRespond={respondSwap}
          onCancel={cancelSwap}
          actingSwapId={actingSwapId}
        />
      )}
    </div>
  )
}

function ScheduleTab({ allocations, myUserId }: { allocations: Allocation[]; myUserId: string | null }) {
  if (allocations.length === 0) return (
    <div className="p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
      <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 font-semibold">No allocations for this month</p>
      <p className="text-sm text-slate-400 mt-1">Allocations are generated automatically each month.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {allocations.map((a, i) => {
        const isMe = a.user_id === myUserId
        const name = fullName(a.user)
        return (
          <div key={a.user_id}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              isMe
                ? 'bg-[#00C853]/5 border-[#00C853]/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400">
              {i + 1}
            </div>
            {avatar(name, isMe ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-blue-500/10 text-blue-500')}
            <div className="flex-1 min-w-0">
              <p className={`font-bold truncate ${isMe ? 'text-[#00C853]' : 'text-slate-900 dark:text-white'}`}>
                {name} {isMe && <span className="text-xs font-normal opacity-70">(You)</span>}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
              isMe ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-blue-500/10 text-blue-500'
            }`}>
              Day {a.allocation_day}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RequestsTab({ swapRequests, myUserId, onRespond, onCancel, actingSwapId }: {
  swapRequests: SwapRequest[]
  myUserId: string | null
  onRespond: (id: string, accept: boolean) => void
  onCancel: (id: string) => void
  actingSwapId: string | null
}) {
  if (swapRequests.length === 0) return (
    <div className="p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
      <ArrowLeftRight className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <p className="text-slate-500 font-semibold">No swap requests</p>
      <p className="text-sm text-slate-400 mt-1">Click "Request Swap" to exchange your allocation day.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {swapRequests.map(s => {
        const st = STATUS[s.status] ?? STATUS.pending
        const StatusIcon = st.icon
        const isTargeted = s.target_user_id === myUserId
        const isMyRequest = s.requester_id === myUserId
        const isBusy = actingSwapId === s.id

        return (
          <div key={s.id}
            className={`bg-white dark:bg-slate-900 rounded-3xl border overflow-hidden ${
              isTargeted && s.status === 'pending'
                ? 'border-orange-400/40'
                : 'border-slate-200 dark:border-slate-800'
            }`}>
            <div className="p-5">
              <div className="flex items-center gap-4">
                {/* Requester */}
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                  {avatar(fullName(s.requester), 'bg-blue-500/10 text-blue-500')}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[100px]">
                      {fullName(s.requester)}
                      {isMyRequest && <span className="text-[#00C853] text-xs"> (You)</span>}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold">
                      Day {s.requester_day}
                    </span>
                  </div>
                </div>

                {/* Center */}
                <div className="flex flex-col items-center gap-1">
                  <ArrowLeftRight className={`w-6 h-6 ${st.color}`} />
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {st.label}
                  </span>
                </div>

                {/* Target */}
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                  {avatar(fullName(s.target), 'bg-purple-500/10 text-purple-500')}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[100px]">
                      {fullName(s.target)}
                      {isTargeted && <span className="text-[#00C853] text-xs"> (You)</span>}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-bold">
                      Day {s.target_day}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isTargeted && s.status === 'pending' && (
              <div className="flex border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => onRespond(s.id, false)}
                  disabled={isBusy}
                  className="flex-1 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  {isBusy ? 'Working...' : 'Decline'}
                </button>
                <div className="w-px bg-slate-100 dark:bg-slate-800" />
                <button onClick={() => onRespond(s.id, true)}
                  disabled={isBusy}
                  className="flex-1 py-3 text-sm font-bold text-[#00C853] hover:bg-[#00C853]/5 transition-colors">
                  {isBusy ? 'Working...' : 'Accept'}
                </button>
              </div>
            )}
            {isMyRequest && s.status === 'pending' && (
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400 text-left">Waiting for {fullName(s.target)} to respond</p>
                <button
                  onClick={() => onCancel(s.id)}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-colors"
                >
                  {isBusy ? 'Working...' : 'Cancel Request'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SwapModal({ allocations, myUserId, myAllocation, chamaId, month, onClose, onCreated }: {
  allocations: Allocation[]
  myUserId: string
  myAllocation: Allocation
  chamaId: string
  month: string
  onClose: () => void
  onCreated: () => void
}) {
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const others = allocations.filter(a => a.user_id !== myUserId)
  const targetAlloc = others.find(a => a.user_id === targetUserId)

  async function handleSubmit() {
    if (!targetUserId || !targetAlloc) return
    setLoading(true)
    try {
      if (!navigator.onLine) {
        throw new Error('No internet connection. Reconnect and try again.')
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('allocation_swap_requests').insert({
        chama_id: chamaId,
        month,
        requester_id: user!.id,
        requester_day: myAllocation.allocation_day,
        target_user_id: targetUserId,
        target_day: targetAlloc.allocation_day,
      }).select('id').single()
      if (error) throw error
      await supabase.functions.invoke('send-swap-email', {
        body: { swapId: data.id, event: 'request_created' },
      })
      toast.success('Swap request sent!')
      onCreated()
    } catch (error: unknown) {
      toast.error(friendlySwapError(error, 'Failed to send swap request'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#00C853]/10 flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Request Swap</h2>
            <p className="text-xs text-slate-500">Exchange your allocation day with a member</p>
          </div>
        </div>

        {/* My day */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 mb-4">
          <span className="text-sm text-slate-500">Your allocation day</span>
          <span className="px-3 py-1 rounded-full bg-[#00C853]/10 text-[#00C853] text-sm font-bold">
            Day {myAllocation.allocation_day}
          </span>
        </div>

        {/* Member list */}
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Select member to swap with</p>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
          {others.map(a => {
            const name = fullName(a.user)
            const isSelected = targetUserId === a.user_id
            return (
              <button key={a.user_id} onClick={() => setTargetUserId(a.user_id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                  isSelected
                    ? 'border-[#00C853] bg-[#00C853]/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}>
                {avatar(name, isSelected ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-blue-500/10 text-blue-500')}
                <span className={`flex-1 font-semibold text-sm ${isSelected ? 'text-[#00C853]' : 'text-slate-900 dark:text-white'}`}>
                  {name}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  isSelected ? 'bg-[#00C853]/15 text-[#00C853]' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  Day {a.allocation_day}
                </span>
                {isSelected && <CheckCircle className="w-4 h-4 text-[#00C853]" />}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!targetUserId || loading}
            className="flex-1 py-3 rounded-2xl bg-[#00C853] text-white font-bold text-sm disabled:opacity-50 shadow-lg shadow-green-500/20">
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
