import { useState, useEffect, useCallback } from 'react'
import { toast } from '../utils/toast'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { openMeetingLink } from '../lib/meetingLink'
import { notifyAudience, notifyUser } from '../lib/notify'
import { mpesaService } from '../services/mpesaService'
import TransactionApprovalModal from '../components/TransactionApprovalModal'
import { 
  Users, 
  Wallet, 
  Calendar, 
  Bell, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  MoreVertical,
  CheckCircle2,
  Clock,
  Video,
  MapPin,
  ExternalLink,
  Star,
  Info,
  RefreshCcw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

type TabType = 'overview' | 'members' | 'meetings' | 'prompts' | 'calendar' | 'allocations'
type MaybeArray<T> = T | T[] | null

interface ChamaRow {
  id: string
  name: string
  description: string | null
  balance: number | null
  member_limit: number | null
  created_by: string | null
  contribution_frequency: string | null
  contribution_amount: number | null
  join_points: number | null
  mpesa_shortcode: string | null
}

interface ChamaMemberUser {
  first_name: string | null
  last_name: string | null
  phone: string | null
}

interface ChamaMemberRow {
  id: string
  user_id: string
  role: string
  joined_at: string
  total_contribution: number | null
  users: MaybeArray<ChamaMemberUser>
}

interface ChamaMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  total_contribution: number | null
  users: ChamaMemberUser | null
}

interface ChamaDetailsData extends ChamaRow {
  members: ChamaMember[]
}

interface Meeting {
  id: string
  title: string
  description: string | null
  date: string
  venue: string | null
  video_link: string | null
}

interface PaymentPrompt {
  id: string
  title: string
  amount: number
  due_date: string | null
}

interface AllocationRow {
  id: string
  user_id: string
  allocation_day: number
  status: string
  user: MaybeArray<Pick<ChamaMemberUser, 'first_name' | 'last_name'>>
}

interface Allocation {
  id: string
  user_id: string
  allocation_day: number
  status: string
  user: Pick<ChamaMemberUser, 'first_name' | 'last_name'> | null
}

interface SwapRequestRow {
  id: string
  requester_id: string
  target_user_id: string
  requester_day: number
  target_day: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requester: MaybeArray<Pick<ChamaMemberUser, 'first_name' | 'last_name'>>
  target: MaybeArray<Pick<ChamaMemberUser, 'first_name' | 'last_name'>>
}

interface SwapRequest {
  id: string
  requester_id: string
  target_user_id: string
  requester_day: number
  target_day: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requester: Pick<ChamaMemberUser, 'first_name' | 'last_name'> | null
  target: Pick<ChamaMemberUser, 'first_name' | 'last_name'> | null
}

interface BalanceHistory {
  working_balance: number | null
  utility_balance: number | null
}

interface PromptContributor {
  user_id: string
  first_name: string | null
  last_name: string | null
  status: string
}

type PaymentSelection = Pick<PaymentPrompt, 'id' | 'title' | 'amount'>

function firstItem<T>(value: MaybeArray<T>) {
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizeMember(row: ChamaMemberRow): ChamaMember {
  return {
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    total_contribution: row.total_contribution,
    users: firstItem(row.users),
  }
}

function normalizeAllocation(row: AllocationRow): Allocation {
  return {
    id: row.id,
    user_id: row.user_id,
    allocation_day: Number(row.allocation_day),
    status: row.status,
    user: firstItem(row.user),
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
    requester: firstItem(row.requester),
    target: firstItem(row.target),
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function isNetworkIssue(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return !navigator.onLine
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message.includes('socketexception')
    || message.includes('failed host lookup')
    || message.includes('internet')
}

function getSwapErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error)

  if (isNetworkIssue(error)) {
    return 'No internet connection. Reconnect and try again.'
  }

  if (message.toLowerCase().includes('duplicate key value violates unique constraint')) {
    return 'That allocation schedule changed while the swap was being approved. Refresh and try again.'
  }

  return message || fallback
}

function isMissingSwapEmailFunction(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('requested function was not found')
    || message.includes('not_found')
    || message.includes('status: 404')
}

export default function ChamaDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ChamaDetailsData | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [prompts, setPrompts] = useState<PaymentPrompt[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [isGeneratingAllocations, setIsGeneratingAllocations] = useState(false)
  const [creatingSwap, setCreatingSwap] = useState(false)
  const [actingSwapId, setActingSwapId] = useState<string | null>(null)
  const [swapTargetUserId, setSwapTargetUserId] = useState<string>('')
  const [swapTargetDay, setSwapTargetDay] = useState<number>(1)
  const [userRole, setUserRole] = useState<string>('member')
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [standingOrderModalOpen, setStandingOrderModalOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<PaymentSelection | null>(null)
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)
  const [realTimeBalance, setRealTimeBalance] = useState<BalanceHistory | null>(null)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')

  const fetchRealTimeBalance = useCallback(async (chamaId: string) => {
    try {
      const { data } = await supabase
        .from('balance_history')
        .select('*')
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (data) setRealTimeBalance(data)
    } catch (err) {
      console.error('Error fetching balance history:', err)
    }
  }, [])

  const fetchChamaDetails = useCallback(async () => {
    if (!id) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Fetch chama details
      const { data: chama, error } = await supabase
        .from('chamas')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // Fetch members & user role
      const { data: members, error: membersError } = await supabase
        .from('chama_members')
        .select('*, users:user_id(first_name, last_name, phone)')
        .eq('chama_id', id)

      if (membersError) throw membersError

      const normalizedMembers = ((members || []) as ChamaMemberRow[]).map(normalizeMember)
      const currentUserMember = normalizedMembers.find((member) => member.user_id === user.id)
      setUserRole(currentUserMember?.role || 'member')

      setData({ ...(chama as ChamaRow), members: normalizedMembers })
      setDescriptionDraft((chama as ChamaRow).description || '')
      if (id) fetchRealTimeBalance(id)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchRealTimeBalance, id])

  const fetchMeetings = useCallback(async () => {
    if (!id) return
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('chama_id', id)
      .gte('date', start.toISOString())
      .lt('date', end.toISOString())
      .order('date', { ascending: true })
    if (error) {
      toast.error('Failed to load meetings', error.message)
      return
    }
    setMeetings((data || []) as Meeting[])
  }, [calendarMonth, id])

  const fetchPrompts = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('chama_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setPrompts((data || []) as PaymentPrompt[])
  }, [id])

  const fetchAllocations = useCallback(async () => {
    if (!id) return
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const allocationResponse = await supabase
      .from('chama_allocation_schedule')
      .select('*, user:users(first_name,last_name)')
      .eq('chama_id', id)
      .eq('allocation_month', monthStart.toISOString().slice(0,10))
      .order('allocation_day', { ascending: true })
    let data = allocationResponse.data
    const error = allocationResponse.error
    if (error) {
      toast.error('Failed to load allocations', error.message)
      return
    }
    if ((!data || data.length === 0) && id) {
      const { error: generateError } = await supabase.rpc('generate_monthly_allocations', {
        _chama_id: id,
        _month: monthStart.toISOString().slice(0,10)
      })
      if (!generateError) {
        const refreshed = await supabase
          .from('chama_allocation_schedule')
          .select('*, user:users(first_name,last_name)')
          .eq('chama_id', id)
          .eq('allocation_month', monthStart.toISOString().slice(0,10))
          .order('allocation_day', { ascending: true })
        data = refreshed.data
      }
    }
    setAllocations(((data || []) as AllocationRow[]).map(normalizeAllocation))
  }, [calendarMonth, id])

  const fetchSwapRequests = useCallback(async () => {
    if (!id) return
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
    const { data, error } = await supabase
      .from('allocation_swap_requests')
      .select('*, requester:users!allocation_swap_requests_requester_id_fkey(first_name,last_name), target:users!allocation_swap_requests_target_user_id_fkey(first_name,last_name)')
      .eq('chama_id', id)
      .eq('month', monthStart.toISOString().slice(0,10))
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      toast.error('Failed to load swap requests', error.message)
      return
    }
    setSwapRequests(((data || []) as SwapRequestRow[]).map(normalizeSwapRequest))
  }, [calendarMonth, id])

  useEffect(() => {
    if (id) {
      void fetchChamaDetails()
      void fetchMeetings()
      void fetchPrompts()
      void fetchAllocations()
      void fetchSwapRequests()
    }
  }, [fetchAllocations, fetchChamaDetails, fetchMeetings, fetchPrompts, fetchSwapRequests, id])

  const handleGenerateAllocations = async () => {
    if (!id) return
    try {
      setIsGeneratingAllocations(true)
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
      const { error } = await supabase.rpc('generate_monthly_allocations', {
        _chama_id: id,
        _month: monthStart.toISOString().slice(0,10)
      })
      if (error) throw error
      fetchAllocations()
      void notifyAudience({
        audience: 'chama_members',
        chamaId: id,
        title: `${data?.name || 'Chama'} allocations ready`,
        message: `The allocation schedule for ${monthLabel} is ready.`,
        type: 'info',
        link: `/chama/${id}`,
        emailSubject: `${data?.name || 'Chama'} allocations ready`,
      }).catch(() => {})
      toast.success('Allocations generated')
    } catch (err: unknown) {
      toast.error('Failed to generate allocations', getErrorMessage(err))
    } finally {
      setIsGeneratingAllocations(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!id || !data) return
    try {
      const { error } = await supabase
        .from('chamas')
        .update({
          description: descriptionDraft.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setData((current) => current ? { ...current, description: descriptionDraft.trim() || null } : current)
      setEditingDescription(false)
      void notifyAudience({
        audience: 'chama_members',
        chamaId: id,
        title: `${data.name} description updated`,
        message: 'The chama description was updated.',
        type: 'info',
        link: `/chama/${id}`,
        emailSubject: `${data.name} description updated`,
      }).catch(() => {})
      toast.success('Chama description updated')
    } catch (error) {
      toast.error('Failed to update chama description', getErrorMessage(error))
    }
  }

  const sendSwapEmail = useCallback(async (swapId: string, event: 'request_created' | 'approved' | 'rejected') => {
    try {
      await supabase.functions.invoke('send-swap-email', {
        body: { swapId, event },
      })
    } catch (error) {
      if (isMissingSwapEmailFunction(error)) {
        console.warn('Swap email function is not deployed for this Supabase project. Skipping email send.')
        return
      }
      console.error('Failed to send swap email', error)
    }
  }, [])

  const handleCreateSwap = async () => {
    if (!id || !swapTargetUserId || !swapTargetDay) return
    try {
      setCreatingSwap(true)
      if (!navigator.onLine) throw new Error('No internet connection. Reconnect and try again.')
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const myDay = allocations.find(a => a.user_id === user.id)?.allocation_day
      if (!myDay) {
        toast.error('No allocation day found for you this month.')
        return
      }
        const { data, error } = await supabase
          .from('allocation_swap_requests')
          .insert({
            chama_id: id,
            month: monthStart.toISOString().slice(0,10),
            requester_id: user.id,
            requester_day: myDay,
            target_user_id: swapTargetUserId,
            target_day: swapTargetDay
          })
          .select('id')
          .single()
        if (error) throw error
        await sendSwapEmail(data.id, 'request_created')
        toast.success('Swap request sent')
        fetchSwapRequests()
      } catch (err: unknown) {
        toast.error('Failed to create swap request', getSwapErrorMessage(err, 'Failed to create swap request'))
      } finally {
        setCreatingSwap(false)
      }
    }
  
  const handleApproveSwap = async (swapId: string) => {
    try {
      setActingSwapId(swapId)
      if (!navigator.onLine) throw new Error('No internet connection. Reconnect and try again.')
      const { error } = await supabase.rpc('approve_allocation_swap', { _swap_id: swapId })
      if (error) throw error
      await sendSwapEmail(swapId, 'approved')
      toast.success('Swap approved')
      fetchAllocations()
      fetchSwapRequests()
    } catch (err: unknown) {
      toast.error('Failed to approve swap', getSwapErrorMessage(err, 'Failed to approve swap'))
    } finally {
      setActingSwapId(null)
    }
  }
  
  const handleRejectSwap = async (swapId: string) => {
    try {
      setActingSwapId(swapId)
      if (!navigator.onLine) throw new Error('No internet connection. Reconnect and try again.')
      const { error } = await supabase
        .from('allocation_swap_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', swapId)
        .eq('target_user_id', currentUserId)
        .eq('status', 'pending')
      if (error) throw error
      await sendSwapEmail(swapId, 'rejected')
      toast.success('Swap rejected')
      fetchSwapRequests()
    } catch (err: unknown) {
      toast.error('Failed to reject swap', getSwapErrorMessage(err, 'Failed to reject swap'))
    } finally {
      setActingSwapId(null)
    }
  }
  
  const handleCancelSwap = async (swapId: string) => {
    try {
      setActingSwapId(swapId)
      if (!navigator.onLine) throw new Error('No internet connection. Reconnect and try again.')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
  
      const { error } = await supabase
        .from('allocation_swap_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', swapId)
        .eq('requester_id', user.id)
        .eq('status', 'pending')

      if (error) throw error
      const cancelledSwap = swapRequests.find((swap) => swap.id === swapId)
      if (cancelledSwap) {
        void notifyUser({
          targetUserId: cancelledSwap.target_user_id,
          title: `Swap cancelled in ${data?.name || 'your chama'}`,
          message: 'A pending swap request was cancelled.',
          type: 'warning',
          link: '/swaps',
          emailSubject: `Swap cancelled in ${data?.name || 'your chama'}`,
        }).catch(() => {})
      }
      toast.success('Swap cancelled')
      fetchSwapRequests()
    } catch (err: unknown) {
      toast.error('Failed to cancel swap', getSwapErrorMessage(err, 'Failed to cancel swap'))
    } finally {
      setActingSwapId(null)
    }
  }

  const handlePayClick = (prompt: PaymentSelection) => {
      setSelectedPrompt(prompt)
      setPaymentModalOpen(true)
  }

  const handleProcessPayment = async (phoneNumber: string) => {
    if (!selectedPrompt) return

    try {
      setPaymentLoading(selectedPrompt.id)
      setPaymentModalOpen(false)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.functions.invoke('trigger-stk-push', {
        body: {
          amount: selectedPrompt.amount,
          phoneNumber: phoneNumber,
          userId: user.id,
          chamaId: id,
          requestId: selectedPrompt.id,
          type: 'contribution'
        }
      })

      if (error) throw error
      toast.success('STK Push Sent!', 'Please check your phone to complete the contribution.')
      fetchPrompts() // Refresh active prompts
    } catch (err: unknown) {
      console.error('Payment error:', err)
      toast.error('Payment Failed', getErrorMessage(err) || 'Check your connection or phone number format.')
    } finally {
      setPaymentLoading(null)
      setSelectedPrompt(null)
    }
  }

  const handleGenerateQR = async (amount: number) => {
    try {
      setQrLoading(true)
      setQrModalOpen(true)
      const data = await mpesaService.generateQrCode(
        amount,
        'Ratibu Chama',
        `Chama-${id?.slice(0, 8)}`
      )
      // Safaricom returns 'QRCode' (capital), but guard against other casing too
      const qrBase64 = data?.QRCode ?? data?.qrCode ?? data?.qr_code ?? null
      if (qrBase64) {
        setQrCodeData(qrBase64)
      } else {
        alert('QR data missing. Response: ' + JSON.stringify(data))
        setQrModalOpen(false)
      }
    } catch (err: unknown) {
      alert('Failed to generate QR code: ' + getErrorMessage(err))
      setQrModalOpen(false)
    } finally {
      setQrLoading(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
      try {
          const member = data?.members.find((item) => item.id === memberId)
          const { error } = await supabase
              .from('chama_members')
              .update({ role: newRole })
              .eq('id', memberId)
          
          if (error) throw error
          if (member?.user_id) {
            void notifyUser({
              targetUserId: member.user_id,
              title: `Your role changed in ${data?.name || 'the chama'}`,
              message: `Your role was updated to ${newRole}.`,
              type: 'info',
              link: `/chama/${id}`,
              emailSubject: `Your role changed in ${data?.name || 'the chama'}`,
            }).catch(() => {})
          }
          fetchChamaDetails() // Refresh
      } catch (err: unknown) {
          toast.error('Failed to update role', getErrorMessage(err))
      }
  }

  const handleRefreshBalance = async () => {
    if (!data?.mpesa_shortcode) {
        toast.warning('Configuration Missing', 'M-Pesa Shortcode not configured for this Chama.')
        return
    }
    
    try {
      setIsRefreshingBalance(true)
      const { error: balanceError } = await supabase.functions.invoke('get-account-balance', {
        body: { 
            shortCode: data.mpesa_shortcode,
            chamaId: id
        }
      })
      
      if (balanceError) throw balanceError
      void notifyAudience({
        audience: 'chama_admins',
        chamaId: id,
        title: `Balance refresh requested for ${data.name}`,
        message: 'A live M-Pesa balance refresh was requested.',
        type: 'info',
        link: `/chama/${id}`,
        emailSubject: `Balance refresh requested for ${data.name}`,
      }).catch(() => {})
      toast.info('Balance Request Sent', 'Waiting for M-Pesa response...')
      
      if (id) setTimeout(() => fetchRealTimeBalance(id), 5000)
    } catch (err: unknown) {
      toast.error('Refresh Failed', getErrorMessage(err))
    } finally {
      setIsRefreshingBalance(false)
    }
  }

  const handleWithdraw = async (amount: number, phone: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.functions.invoke('payout-b2c', {
        body: {
          amount,
          phoneNumber: phone,
          userId: user.id,
          chamaId: id,
          remarks: reason
        }
      })

      if (error) throw error
      void notifyAudience({
        audience: 'chama_admins',
        chamaId: id,
        title: `Withdrawal initiated in ${data?.name || 'your chama'}`,
        message: `A withdrawal of KES ${amount.toLocaleString()} was initiated.`,
        type: 'warning',
        link: `/chama/${id}`,
        emailSubject: `Withdrawal initiated in ${data?.name || 'your chama'}`,
      }).catch(() => {})
      toast.success('Withdrawal Initiated', 'Your request has been processed successfully.')
      setWithdrawModalOpen(false)
      fetchChamaDetails()
    } catch (err: unknown) {
      toast.error('Withdrawal Failed', getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-slate-500">Chama not found.</div>

  const isAdmin = ['admin', 'treasurer', 'secretary'].includes(userRole)
  const canEditDescription = isAdmin || currentUserId === data.created_by
  const monthLabel = format(calendarMonth, 'MMMM yyyy')
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0)
  const startDay = monthStart.getDay()
  const totalDays = monthEnd.getDate()
  const adminMember = data.members.find((member) => member.role === 'admin')
  const contributionAmount = data.contribution_amount ?? 0
  const calendarCells = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/chamas')}
            aria-label="Back to chamas"
            title="Back to chamas"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chamas
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{data.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase border ${
                isAdmin 
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                {userRole}
              </span>
            </div>
            {editingDescription ? (
              <div className="space-y-3 max-w-2xl">
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/15"
                  placeholder="Write a chama description"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(data.description || '')
                      setEditingDescription(false)
                    }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDescription}
                    className="rounded-xl bg-[#00C853] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-green-500/20"
                  >
                    Save Description
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
                  {data.description || 'No description provided.'}
                </p>
                {canEditDescription && (
                  <button
                    type="button"
                    onClick={() => setEditingDescription(true)}
                    className="text-xs font-bold uppercase tracking-wider text-[#00C853] hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => setStandingOrderModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all border border-slate-200 dark:border-slate-700"
            >
                <Clock className="w-4 h-4 text-[#00C853]" />
                Automate
            </button>
            <button 
                onClick={() => handlePayClick({ amount: contributionAmount, id: 'general', title: 'Manual Deposit' })}
                className="px-6 py-2.5 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
            >
                <Wallet className="w-4 h-4" />
                Deposit
            </button>
            <button 
                onClick={() => handleGenerateQR(contributionAmount)}
                className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-[#00C853] text-[#00C853] rounded-xl font-bold transition-all hover:bg-[#00C853]/5 flex items-center gap-2"
            >
                <div className="w-4 h-4 rounded-sm border-2 border-[#00C853] flex items-center justify-center text-[8px]">QR</div>
                QR Pay
            </button>
            {isAdmin && (
              <button
                aria-label="More chama actions"
                title="More chama actions"
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: Wallet },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'meetings', label: 'Meetings', icon: Calendar },
          { id: 'calendar', label: 'Calendar', icon: Calendar },
          { id: 'allocations', label: 'Allocations', icon: Star },
          { id: 'prompts', label: 'Prompts', icon: Bell }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 md:px-6 py-4 text-sm font-bold transition-all relative flex-shrink-0 ${
              activeTab === tab.id 
                ? 'text-[#00C853]' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00C853]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Group Balance</h3>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                    KES {data.balance?.toLocaleString()}
                                </div>
                                <button 
                                    onClick={handleRefreshBalance}
                                    disabled={isRefreshingBalance}
                                    className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all ${isRefreshingBalance ? 'animate-spin text-[#00C853]' : 'text-slate-400'}`}
                                    title="Refresh Real-time Balance"
                                >
                                    <RefreshCcw className="w-5 h-5" />
                                </button>
                            </div>
                            {realTimeBalance && (
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Live M-Pesa: KES {realTimeBalance.working_balance?.toLocaleString()} (Utility: {realTimeBalance.utility_balance?.toLocaleString()})
                                </p>
                            )}
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Members</h3>
                            <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                {data.members?.length} / {data.member_limit}
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="p-6 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative mb-6">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Wallet className="w-24 h-24" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2">Fund Management</h3>
                                <p className="text-slate-400 text-sm mb-6 max-w-sm">Withdraw funds instantly to any phone number via M-Pesa B2C payout.</p>
                                <button 
                                    onClick={() => setWithdrawModalOpen(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Withdraw Funds
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Financial Guidelines</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 dark:text-slate-400">Contribution Frequency</span>
                                <span className="font-bold text-slate-900 dark:text-white capitalize">{data.contribution_frequency}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 dark:text-slate-400">Target Amount</span>
                                <span className="font-bold text-slate-900 dark:text-white font-mono text-green-500">KES {data.contribution_amount?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-[#00C853]/10 to-green-600/5 rounded-2xl border border-[#00C853]/20">
                        <div className="flex items-center gap-2 mb-4">
                            <Star className="w-5 h-5 text-[#00C853] fill-[#00C853]" />
                            <h3 className="text-sm font-bold text-[#00C853] uppercase tracking-wider">Join Reward</h3>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                +{data.join_points || 500} Points
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Get rewarded instantly for participating in this group.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Group Admin</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#00C853] flex items-center justify-center text-white font-bold text-xl">
                                {adminMember?.users?.first_name?.[0] || 'A'}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {adminMember?.users?.first_name || 'Admin'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Founder & Chairman</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px] sm:min-w-0">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Member</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Role</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Joined</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Contribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.members?.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                                            {member.users?.first_name?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {member.users?.first_name} {member.users?.last_name}
                                            </div>
                                            <div className="text-xs text-slate-500">{member.users?.phone}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {isAdmin && member.user_id !== data.created_by ? (
                                        <>
                                        <label id={`member-role-label-${member.id}`} htmlFor={`member-role-${member.id}`} className="sr-only">
                                            Member role
                                        </label>
                                        <select 
                                            id={`member-role-${member.id}`}
                                            value={member.role}
                                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                            aria-labelledby={`member-role-label-${member.id}`}
                                            aria-label="Member role"
                                            title="Member role"
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-[10px] font-black px-2 py-1 outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-[#00C853] transition-all cursor-pointer"
                                        >
                                            <option value="member">MEMBER</option>
                                            <option value="secretary">SECRETARY</option>
                                            <option value="treasurer">TREASURER</option>
                                            <option value="admin">ADMIN</option>
                                        </select>
                                        </>
                                    ) : (
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                            member.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {member.role}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {format(new Date(member.joined_at), 'MMM d, yyyy')}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                    KES {member.total_contribution?.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chama Meetings</h2>
                    {isAdmin && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
                            <Plus className="w-4 h-4" />
                            Schedule Meeting
                        </button>
                    )}
                </div>

                {meetings.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No meetings scheduled</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-6">Stay tuned for group updates and schedule a voice or physical sync.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {meetings.map((meeting) => (
                            <div key={meeting.id} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-green-500/10 rounded-xl text-[#00C853]">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{format(new Date(meeting.date), 'MMM d')}</div>
                                        <div className="text-xs text-slate-500">{format(new Date(meeting.date), 'p')}</div>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{meeting.title}</h3>
                                <p className="text-sm text-slate-500 mb-6 line-clamp-2">{meeting.description || 'No agenda provided.'}</p>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        {meeting.video_link ? (
                                            <><Video className="w-4 h-4" /> Virtual</>
                                        ) : (
                                            <><MapPin className="w-4 h-4" /> {meeting.venue || 'Physical'}</>
                                        )}
                                    </div>
                                    {meeting.video_link && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openMeetingLink(meeting.video_link ?? '')
                                            }}
                                            className="text-xs font-bold text-[#00C853] flex items-center gap-1 hover:underline"
                                        >
                                            Join Now <ExternalLink className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Monthly Meeting Calendar</h2>
                  <p className="text-xs text-slate-500">{monthLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const prev = new Date(calendarMonth)
                      prev.setMonth(prev.getMonth() - 1)
                      setCalendarMonth(prev)
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => {
                      const next = new Date(calendarMonth)
                      next.setMonth(next.getMonth() + 1)
                      setCalendarMonth(next)
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="p-3" />
                  const hasMeeting = meetings.some(m => new Date(m.date).getDate() === day)
                  return (
                    <div key={day} className={`p-3 rounded-2xl border ${hasMeeting ? 'border-[#00C853] bg-[#00C853]/10' : 'border-slate-200 dark:border-slate-800'} text-center`}>
                      <div className="font-black">{day}</div>
                      {hasMeeting && <div className="text-[10px] text-[#00C853] font-bold">Meeting</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'allocations' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Monthly Allocations</h2>
                {isAdmin && (
                  <button
                    onClick={handleGenerateAllocations}
                    disabled={isGeneratingAllocations}
                    className="px-4 py-2 rounded-lg bg-[#00C853] text-white font-bold"
                  >
                    {isGeneratingAllocations ? 'Generating...' : 'Generate'}
                  </button>
                )}
              </div>
              {allocations.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No allocations yet</h3>
                  <p className="text-slate-500 max-w-xs mx-auto">Generate monthly allocation schedule for members.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allocations.map((a) => (
                    <div key={a.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{a.user?.first_name} {a.user?.last_name}</p>
                          <p className="text-xs text-slate-500">Day {a.allocation_day}</p>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-[#00C853]/10 text-[#00C853] uppercase">{a.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-bold mb-2">Request Swap</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label htmlFor="swap-target-user" className="sr-only">Select member to swap with</label>
                  <select
                    id="swap-target-user"
                    value={swapTargetUserId}
                    onChange={(e) => {
                      const userId = e.target.value
                      setSwapTargetUserId(userId)
                      const targetDay = allocations.find((allocation) => allocation.user_id === userId)?.allocation_day
                      if (targetDay) setSwapTargetDay(targetDay)
                      else setSwapTargetDay(0)
                    }}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="">Select member</option>
                    {data.members?.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.users?.first_name} {m.users?.last_name}
                      </option>
                    ))}
                  </select>
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Target day</span>
                    <span className="font-black">{swapTargetDay || '-'}</span>
                  </div>
                  <button
                    onClick={handleCreateSwap}
                    disabled={creatingSwap}
                    className="px-4 py-3 rounded-xl bg-slate-900 text-white font-bold"
                  >
                    {creatingSwap ? 'Sending...' : 'Request Swap'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h3 className="font-bold mb-3">Swap Requests</h3>
                {swapRequests.length === 0 ? (
                  <div className="text-sm text-slate-500">No swap requests yet.</div>
                ) : (
                  <div className="space-y-3">
                    {swapRequests.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">
                            {(s.requester?.first_name || 'Member')} {(s.requester?.last_name || '')} ↔ {(s.target?.first_name || 'Member')} {(s.target?.last_name || '')}
                          </p>
                          <p className="text-xs text-slate-500">Day {s.requester_day} ↔ Day {s.target_day}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                            s.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                            s.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                            s.status === 'cancelled' ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {s.status}
                          </span>
                          {s.requester_id === currentUserId && s.status === 'pending' && (
                              <button
                                onClick={() => handleCancelSwap(s.id)}
                                disabled={actingSwapId === s.id}
                                className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                              >
                                {actingSwapId === s.id ? 'Working...' : 'Cancel'}
                              </button>
                            )}
                            {isAdmin && s.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveSwap(s.id)}
                                  disabled={actingSwapId === s.id}
                                  className="px-2 py-1 text-xs font-bold bg-[#00C853] text-white rounded-lg"
                                >
                                  {actingSwapId === s.id ? 'Working...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectSwap(s.id)}
                                  disabled={actingSwapId === s.id}
                                  className="px-2 py-1 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                                >
                                  {actingSwapId === s.id ? 'Working...' : 'Decline'}
                                </button>
                              </>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

            {activeTab === 'prompts' && (
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Payment Requests</h2>
                    {isAdmin && (
                        <button 
                            onClick={() => setPromptModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                            <Plus className="w-4 h-4" />
                            New Prompt
                        </button>
                    )}
                </div>

                {prompts.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <CheckCircle2 className="w-12 h-12 text-[#00C853] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">All Clear!</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">There are no pending group-wide payment requests at this time.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prompts.map((prompt) => (
                            <PromptCard key={prompt.id} prompt={prompt} onPay={handlePayClick} loading={paymentLoading === prompt.id} />
                        ))}
                    </div>
                )}
             </div>
          )}
        </motion.div>
      </AnimatePresence>

      {paymentModalOpen && selectedPrompt && (
        <PaymentModal 
            isOpen={paymentModalOpen} 
            onClose={() => setPaymentModalOpen(false)} 
            onConfirm={handleProcessPayment} 
            amount={selectedPrompt.amount}
            title={selectedPrompt.title}
        />
      )}

      {promptModalOpen && id && (
          <CreatePromptModal 
            isOpen={promptModalOpen}
            onClose={() => setPromptModalOpen(false)}
            chamaId={id}
            chamaName={data.name}
            members={data.members}
            onSuccess={() => {
                setPromptModalOpen(false)
                fetchPrompts()
            }}
          />
      )}

      {standingOrderModalOpen && data && (
        <StandingOrderModal 
          isOpen={standingOrderModalOpen}
          onClose={() => setStandingOrderModalOpen(false)}
          chama={data}
        />
      )}

      {data && (
        <WithdrawModal 
            isOpen={withdrawModalOpen}
            onClose={() => setWithdrawModalOpen(false)}
            onWithdraw={handleWithdraw}
            chama={data}
        />
      )}

      {qrModalOpen && (
        <QRModal 
            isOpen={qrModalOpen}
            onClose={() => setQrModalOpen(false)}
            qrCode={qrCodeData}
            amount={contributionAmount}
            loading={qrLoading}
        />
      )}

    </div>
  )
}

function StandingOrderModal({ isOpen, onClose, chama }: { isOpen: boolean, onClose: () => void, chama: ChamaDetailsData }) {
  const [amount, setAmount] = useState(chama?.contribution_amount?.toString() || '')
  const [loading, setLoading] = useState(false)
  const [frequency, setFrequency] = useState('4') // Default Monthly
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [name, setName] = useState(`${chama?.name} Automation`)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userData } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user.id)
        .single()

      if (!userData?.phone) throw new Error('Please set your phone number in profile first')

      const response = await supabase.functions.invoke('create-standing-order', {
        body: {
          amount: Number(amount),
          phoneNumber: userData.phone,
          userId: user.id,
          chamaId: chama.id,
          standingOrderName: name,
          startDate,
          endDate,
          frequency
        }
      })

      if (response.error) throw response.error

      void notifyAudience({
        audience: 'chama_admins',
        chamaId: chama.id,
        title: `${chama.name} standing order started`,
        message: `A standing order for KES ${Number(amount).toLocaleString()} was initiated.`,
        type: 'info',
        link: `/chama/${chama.id}`,
        emailSubject: `${chama.name} standing order started`,
      }).catch(() => {})
      toast.success('Standing Order Initiated!', 'Please check your phone for the M-Pesa PIN prompt to authorize.')
      onClose()
    } catch (err: unknown) {
      toast.error('Setup Failed', getErrorMessage(err) || 'Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Automate</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">M-PESA RATIBA</p>
                </div>
                <button onClick={onClose} aria-label="Close automate modal" title="Close automate modal" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="standing-order-purpose" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Purpose</label>
                  <input 
                    id="standing-order-purpose"
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00C853] transition-all"
                    placeholder="e.g. Monthly Contribution"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="standing-order-amount" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount (KES)</label>
                    <input 
                      id="standing-order-amount"
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00C853] transition-all"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="standing-order-frequency" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frequency</label>
                    <div className="relative">
                      <select 
                        id="standing-order-frequency"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00C853] transition-all appearance-none"
                      >
                        <option value="2">Daily</option>
                        <option value="3">Weekly</option>
                        <option value="4">Monthly</option>
                        <option value="8">Yearly</option>
                      </select>
                      <RefreshCcw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="standing-order-start-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
                    <input 
                      id="standing-order-start-date"
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00C853] transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="standing-order-end-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
                    <input 
                      id="standing-order-end-date"
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00C853] transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed font-bold">
                      You will receive an M-PESA prompt to authorize this standing order. Once approved, payments will be automatically deducted.
                    </p>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  aria-label={loading ? 'Setting up automation' : 'Set up automation'}
                  title={loading ? 'Setting up automation' : 'Set up automation'}
                  className="w-full bg-[#00C853] hover:bg-green-600 disabled:opacity-50 text-white rounded-2xl py-4 font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set Up Automation'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function CreatePromptModal({ isOpen, onClose, chamaId, chamaName, members, onSuccess }: { isOpen: boolean, onClose: () => void, chamaId: string, chamaName: string, members: ChamaMember[], onSuccess: () => void }) {
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [targetAll, setTargetAll] = useState(true)
    const [selectedUsers, setSelectedUsers] = useState<string[]>([])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { error } = await supabase
                .from('payment_requests')
                .insert({
                    chama_id: chamaId,
                    created_by: user.id,
                    title,
                    amount: parseFloat(amount),
                    due_date: dueDate ? new Date(dueDate).toISOString() : null,
                    target_member_ids: targetAll ? null : selectedUsers
                })
            
            if (error) throw error
            if (targetAll) {
                void notifyAudience({
                    audience: 'chama_members',
                    chamaId,
                    title: `${chamaName} payment request`,
                    message: `${title} is now due for payment.`,
                    type: 'warning',
                    link: `/chama/${chamaId}`,
                    emailSubject: `${chamaName} payment request`,
                }).catch(() => {})
            } else {
                const recipients = members.filter((member) => selectedUsers.includes(member.user_id))
                for (const member of recipients) {
                    void notifyUser({
                        targetUserId: member.user_id,
                        title: `${chamaName} payment request`,
                        message: `${title} is now due for payment.`,
                        type: 'warning',
                        link: `/chama/${chamaId}`,
                        emailSubject: `${chamaName} payment request`,
                    }).catch(() => {})
                }
            }
            onSuccess()
        } catch (err: unknown) {
            toast.error('Failed to create prompt', getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg my-auto shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Create Payment Request</h3>
                    <button onClick={onClose} aria-label="Close payment request modal" title="Close payment request modal" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="prompt-title" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Request Title</label>
                            <input 
                                id="prompt-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. February Monthly Deposit"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-[#00C853] outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="prompt-amount" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Amount (KES)</label>
                            <input 
                                id="prompt-amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-[#00C853] outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="prompt-due-date" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Due Date</label>
                            <input 
                                id="prompt-due-date"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-[#00C853] outline-none"
                                required
                            />
                        </div>

                        <fieldset>
                            <legend className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Target Audience</legend>
                            <div className="flex gap-4 mb-4">
                                <button 
                                    type="button"
                                    onClick={() => setTargetAll(true)}
                                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${targetAll ? 'border-[#00C853] bg-[#00C853]/5 text-[#00C853]' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}
                                >
                                    All Members
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setTargetAll(false)}
                                    className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${!targetAll ? 'border-[#00C853] bg-[#00C853]/5 text-[#00C853]' : 'border-slate-200 dark:border-slate-800 text-slate-500'}`}
                                >
                                    Select Members
                                </button>
                            </div>

                            {!targetAll && (
                                <div className="max-h-48 overflow-y-auto space-y-2 p-2 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    {members.map((member) => (
                                        <label key={member.user_id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={selectedUsers.includes(member.user_id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedUsers([...selectedUsers, member.user_id])
                                                    else setSelectedUsers(selectedUsers.filter(uid => uid !== member.user_id))
                                                }}
                                                className="w-4 h-4 rounded text-[#00C853] focus:ring-[#00C853]"
                                            />
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                {member.users?.first_name} {member.users?.last_name}
                                                <span className="ml-2 text-[10px] text-slate-500 uppercase">{member.role}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </fieldset>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading || (!targetAll && selectedUsers.length === 0)}
                        aria-label={loading ? 'Sending payment requests' : 'Send payment requests'}
                        title={loading ? 'Sending payment requests' : 'Send payment requests'}
                        className="w-full py-4 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Send Requests'}
                    </button>
                </form>
            </motion.div>
        </div>
    )
}

function PromptCard({ prompt, onPay, loading }: { prompt: PaymentPrompt, onPay: (p: PaymentSelection) => void, loading: boolean }) {
    const [showContributors, setShowContributors] = useState(false)
    const [contributors, setContributors] = useState<PromptContributor[]>([])
    const [loadingContributors, setLoadingContributors] = useState(false)

    const fetchContributors = async () => {
        if (!showContributors && contributors.length === 0) {
            setLoadingContributors(true)
            const { data, error } = await supabase.rpc('get_payment_prompt_status', { prompt_id: prompt.id })
            if (!error && data) {
                setContributors((data || []) as PromptContributor[])
            }
            setLoadingContributors(false)
        }
        setShowContributors(!showContributors)
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{prompt.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="text-sm font-bold text-green-500">KES {prompt.amount?.toLocaleString()}</div>
                            {prompt.due_date && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    Due {format(new Date(prompt.due_date), 'MMM d, yyyy')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchContributors}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        {showContributors ? 'Hide Status' : 'View Status'}
                    </button>
                    <button
                        onClick={() => onPay(prompt)}
                        disabled={loading}
                        aria-label={loading ? `Processing payment for ${prompt.title}` : `Pay ${prompt.title}`}
                        title={loading ? `Processing payment for ${prompt.title}` : `Pay ${prompt.title}`}
                        className="px-8 py-2.5 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[120px]"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            'Pay Now'
                        )}
                    </button>
                </div>
            </div>

            {showContributors && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 p-4">
                    {loadingContributors ? (
                         <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400"/></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {contributors.map((c) => (
                                <div key={c.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                    <div className={`w-2 h-2 rounded-full ${c.status === 'paid' ? 'bg-green-500' : 'bg-red-400'}`} />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex-1 truncate">
                                        {c.first_name} {c.last_name}
                                    </span>
                                    {c.status === 'paid' && (
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function PaymentModal({ isOpen, onClose, onConfirm, amount, title }: { isOpen: boolean, onClose: () => void, onConfirm: (phone: string) => void, amount: number, title: string }) {
    const [phoneNumber, setPhoneNumber] = useState('')
    const [useMyNumber, setUseMyNumber] = useState(true)
    const [myNumber, setMyNumber] = useState('')
    const [approvalOpen, setApprovalOpen] = useState(false)
    const [pendingPhone, setPendingPhone] = useState('')

    useEffect(() => {
        // Fetch user number
        const fetchUserNumber = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('users').select('phone').eq('id', user.id).single()
                if (data?.phone) {
                    setMyNumber(data.phone.replace('+', ''))
                    setPhoneNumber(data.phone.replace('+', ''))
                }
            }
        }
        fetchUserNumber()
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setPendingPhone(phoneNumber)
        setApprovalOpen(true)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
                <div>
                     <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Payment</h3>
                        <button onClick={onClose} aria-label="Close payment confirmation modal" title="Close payment confirmation modal" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="text-sm text-slate-500 mb-1">Payment for</div>
                            <div className="font-bold text-slate-900 dark:text-white">{title}</div>
                            <div className="mt-2 text-2xl font-bold text-green-500">KES {amount?.toLocaleString()}</div>
                        </div>

                        <div className="space-y-4">
                            <label htmlFor="payment-phone-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                            
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input 
                                        type="radio" 
                                        checked={useMyNumber} 
                                        onChange={() => {
                                            setUseMyNumber(true)
                                            setPhoneNumber(myNumber)
                                        }}
                                        className="w-4 h-4 text-[#00C853] focus:ring-[#00C853]"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">My Number</div>
                                        <div className="text-xs text-slate-500">{myNumber || 'Not set'}</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input 
                                        type="radio" 
                                        checked={!useMyNumber} 
                                        onChange={() => {
                                            setUseMyNumber(false)
                                            setPhoneNumber('')
                                        }}
                                        className="w-4 h-4 text-[#00C853] focus:ring-[#00C853]"
                                    />
                                    <div className="font-medium text-slate-900 dark:text-white">Other Number</div>
                                </label>
                            </div>

                            {!useMyNumber && (
                                <input
                                    id="payment-phone-number"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="2547..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all"
                                    required
                                    pattern="^254\d{9}$"
                                />
                            )}
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit"
                                aria-label={`Pay ${title}`}
                                title={`Pay ${title}`}
                                className="w-full py-3 px-4 bg-[#00C853] hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20"
                            >
                                Pay KES {amount?.toLocaleString()}
                            </button>
                        </div>
                    </form>
                </div>
                <TransactionApprovalModal
                  isOpen={approvalOpen}
                  actionLabel="deposit"
                  amount={amount}
                  onClose={() => {
                    setApprovalOpen(false)
                    setPendingPhone('')
                  }}
                  onApproved={async () => {
                    const phone = pendingPhone
                    setApprovalOpen(false)
                    setPendingPhone('')
                    await onConfirm(phone)
                  }}
                />
            </motion.div>
        </div>
    )
}

function WithdrawModal({ isOpen, onClose, onWithdraw, chama }: { isOpen: boolean, onClose: () => void, onWithdraw: (amt: number, phone: string, reason: string) => void, chama: Pick<ChamaDetailsData, 'balance'> }) {
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [pendingWithdrawal, setPendingWithdrawal] = useState<{ amount: number; phone: string; reason: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !phone) return
    setPendingWithdrawal({ amount: Number(amount), phone, reason })
    setApprovalOpen(true)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white">
          <h3 className="text-lg font-bold">Withdraw Funds</h3>
          <button onClick={onClose} aria-label="Close withdrawal modal" title="Close withdrawal modal" className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-[#00C853]/5 rounded-xl border border-[#00C853]/10">
            <p className="text-[10px] text-[#00C853] font-bold uppercase tracking-wider mb-1">Available to Withdraw</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">KES {chama?.balance?.toLocaleString()}</p>
          </div>

          <div>
            <label htmlFor="withdraw-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recipient Phone Number</label>
            <input
              id="withdraw-phone"
              type="tel"
              required
              placeholder="e.g. 254712345678"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#00C853]/20 focus:border-[#00C853] outline-none transition-all dark:text-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">Include country code (e.g., 254...)</p>
          </div>

          <div>
            <label htmlFor="withdraw-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount to Withdraw (KES)</label>
            <input
              id="withdraw-amount"
              type="number"
              required
              min="10"
              max={chama?.balance || 0}
              placeholder="0.00"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#00C853]/20 focus:border-[#00C853] outline-none transition-all dark:text-white"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="withdraw-reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason (Optional)</label>
            <input
              id="withdraw-reason"
              type="text"
              placeholder="e.g. Purchase for member"
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#00C853]/20 focus:border-[#00C853] outline-none transition-all dark:text-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount || !phone}
            aria-label={loading ? 'Processing withdrawal' : 'Disburse via M-Pesa B2C'}
            title={loading ? 'Processing withdrawal' : 'Disburse via M-Pesa B2C'}
            className="w-full p-4 bg-[#00C853] text-white rounded-xl font-bold shadow-lg shadow-[#00C853]/20 hover:bg-green-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Disburse via M-Pesa B2C</>
            )}
          </button>
          
          <p className="text-center text-[10px] text-slate-500">
            Funds will be disbursed instantly from the Chama's account.
          </p>
        </form>
        <TransactionApprovalModal
          isOpen={approvalOpen}
          actionLabel="withdrawal"
          amount={pendingWithdrawal?.amount ?? 0}
          onClose={() => {
            setApprovalOpen(false)
            setPendingWithdrawal(null)
          }}
          onApproved={async () => {
            if (!pendingWithdrawal) return
            setLoading(true)
            try {
              await onWithdraw(pendingWithdrawal.amount, pendingWithdrawal.phone, pendingWithdrawal.reason)
            } finally {
              setLoading(false)
              setApprovalOpen(false)
              setPendingWithdrawal(null)
            }
          }}
        />
      </motion.div>
    </div>
  )
}

function QRModal({ isOpen, onClose, qrCode, amount, loading }: { isOpen: boolean, onClose: () => void, qrCode: string | null, amount: number, loading: boolean }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
                <div className="p-8 text-center">
                    <div className="flex justify-between items-center mb-6">
                        <div className="text-left">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Scan to Pay</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">M-PESA QR</p>
                        </div>
                        <button onClick={onClose} aria-label="Close QR payment modal" title="Close QR payment modal" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                        </button>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner mb-6 flex items-center justify-center min-h-[240px]">
                        {loading ? (
                            <Loader2 className="w-10 h-10 animate-spin text-[#00C853]" />
                        ) : qrCode ? (
                            <img src={`data:image/png;base64,${qrCode}`} alt="M-Pesa QR Code" className="w-full h-auto" />
                        ) : (
                            <p className="text-slate-400 text-sm">Waiting for QR code generation...</p>
                        )}
                    </div>

                    <div className="space-y-1 mb-8">
                        <div className="text-sm text-slate-500">Amount to contribute</div>
                        <div className="text-3xl font-black text-[#00C853]">KES {amount?.toLocaleString()}</div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full bg-[#00C853] hover:bg-green-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
                    >
                        DONE
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
