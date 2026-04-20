import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { toast } from '../utils/toast'
import { supabase } from '../lib/supabase'
import { notifyUser } from '../lib/notify'
import { resetTransactionPin } from '../lib/transactionAuth'
import { isDuplicatePhoneError, isMissingOrUnauthorizedSavingsTargets } from '../lib/supabaseErrors'
import { getKenyanPhoneVariants } from '../lib/phone'
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Save, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Wallet,
  Gift,
  Gavel,
  Plus,
  X,
  Coins,
  RotateCcw
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type SavingsPurpose = 'rent' | 'daily_payments' | 'bill_payment' | 'withdrawal' | 'custom'
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
  savings_period_months?: number
  savings_period_started_at?: string
  early_withdrawal_penalty_percent?: number
  is_locked?: boolean
  lock_period_months?: number
  lock_until?: string
  lock_started_at?: string
}

interface GamificationStats {
  points?: number
  referral_points?: number
  penalty_points?: number
  total_contributions?: number
}

interface PenaltyEvent {
  id: string
  event_type: string
  created_at: string
  points_penalty: number
}

interface PenaltyRule {
  id: string
  name: string
  description: string
  points_penalty: number
  monetary_penalty: number
}

interface UserChama {
  id: string
  name: string
  role: string
}

interface ChamaMembershipRow {
  chama: UserChama | UserChama[] | null
  role: string
}

function firstChama(value: ChamaMembershipRow['chama']): UserChama | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [stats, setStats] = useState<GamificationStats | null>(null)
  const [penalties, setPenalties] = useState<PenaltyEvent[]>([])
  const [rules, setRules] = useState<PenaltyRule[]>([])
  const [loadingRules, setLoadingRules] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    event_type: 'late_contribution',
    points_penalty: 0,
    monetary_penalty: 0
  })
  const [selectedChamaId, setSelectedChamaId] = useState<string | null>(null)
  const [userChamas, setUserChamas] = useState<UserChama[]>([])
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([])
  const [loadingSavingsTargets, setLoadingSavingsTargets] = useState(false)
  const [creatingSavingsTarget, setCreatingSavingsTarget] = useState(false)
  const [showSavingsTargetForm, setShowSavingsTargetForm] = useState(false)
  const [showPinResetForm, setShowPinResetForm] = useState(false)
  const [newTransactionPin, setNewTransactionPin] = useState('')
  const [confirmTransactionPin, setConfirmTransactionPin] = useState('')
  const [resettingPin, setResettingPin] = useState(false)
  const [reversalTransactionId, setReversalTransactionId] = useState('')
  const [reversalAmount, setReversalAmount] = useState('')
  const [reversalReceiverParty, setReversalReceiverParty] = useState('')
  const [reversalRemarks, setReversalRemarks] = useState('Payment reversal')
  const [requestingReversal, setRequestingReversal] = useState(false)
  const [newSavingsTarget, setNewSavingsTarget] = useState({
    name: '',
    purpose: 'rent' as SavingsPurpose,
    destination_label: '',
    target_amount: 0,
    current_amount: 0,
    auto_allocate: true,
    allocation_type: 'percentage' as AllocationType,
    allocation_value: 100,
    notes: '',
    savings_period_months: 12,
    early_withdrawal_penalty_percent: 5,
    lock_period_months: 12,
  })
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    referral_code: '',
    kyc_status: 'pending',
    system_role: 'user',
    member_category: [] as string[]
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      const { data: userStats } = await supabase
        .from('gamification_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setStats((userStats || null) as GamificationStats | null)

      const { data: chamas } = await supabase
        .from('chama_members')
        .select('chama:chamas(id,name), role')
        .eq('user_id', user.id)
      const mappedChamas = ((chamas || []) as ChamaMembershipRow[])
        .map((membership) => {
          const chama = firstChama(membership.chama)
          return chama ? { ...chama, role: membership.role } : null
        })
        .filter((chama): chama is UserChama => Boolean(chama))
      setUserChamas(mappedChamas)
      if (mappedChamas.length > 0) setSelectedChamaId(mappedChamas[0].id)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          referral_code: data.referral_code || '',
          kyc_status: data.kyc_status || 'pending',
          system_role: data.system_role || 'user',
          member_category: data.member_category || []
        })
      }

      // Fetch penalties for user
      const { data: penaltyEvents } = await supabase
        .from('penalty_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setPenalties(penaltyEvents || [])

      await fetchSavingsTargets(user.id)
    } catch (err: unknown) {
      console.error('Error fetching profile:', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [navigate])

  async function handleRequestReversal(e: FormEvent) {
    e.preventDefault()
    if (!['admin', 'super_admin'].includes(profile.system_role)) return
    if (!reversalTransactionId.trim() || !reversalAmount.trim() || !reversalReceiverParty.trim()) {
      toast.error('Fill in the transaction ID, amount, and receiver shortcode.')
      return
    }
    setRequestingReversal(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await supabase.functions.invoke('request-mpesa-reversal', {
        body: {
          transactionId: reversalTransactionId.trim(),
          amount: Number(reversalAmount),
          receiverParty: reversalReceiverParty.trim(),
          remarks: reversalRemarks.trim() || 'Payment reversal',
        },
      })
      if (response.error) throw response.error
      toast.success('Reversal request sent successfully.')
      setReversalTransactionId('')
      setReversalAmount('')
      setReversalReceiverParty('')
      setReversalRemarks('Payment reversal')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setRequestingReversal(false)
    }
  }

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  async function fetchRules(chamaId: string) {
    try {
      setLoadingRules(true)
      const { data } = await supabase
        .from('penalty_rules')
        .select('*')
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false })
      setRules((data || []) as PenaltyRule[])
    } finally {
      setLoadingRules(false)
    }
  }

  useEffect(() => {
    if (selectedChamaId) fetchRules(selectedChamaId)
  }, [selectedChamaId])

  async function fetchSavingsTargets(userId: string) {
    try {
      setLoadingSavingsTargets(true)
      const { data, error } = await supabase
        .from('user_savings_targets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        if (isMissingOrUnauthorizedSavingsTargets(error)) {
          setSavingsTargets([])
          return
        }

        throw error
      }
      setSavingsTargets((data || []) as SavingsTarget[])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load savings targets')
    } finally {
      setLoadingSavingsTargets(false)
    }
  }

  async function handleCreateSavingsTarget(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    try {
      setCreatingSavingsTarget(true)
      const savingsPeriodMonths = Number(newSavingsTarget.savings_period_months || 12)
      const { error } = await supabase
        .from('user_savings_targets')
        .insert({
          user_id: user.id,
          name: newSavingsTarget.name.trim(),
          purpose: newSavingsTarget.purpose,
          destination_label: newSavingsTarget.destination_label.trim() || null,
          target_amount: Number(newSavingsTarget.target_amount),
          current_amount: Number(newSavingsTarget.current_amount) || 0,
          auto_allocate: newSavingsTarget.auto_allocate,
          allocation_type: newSavingsTarget.allocation_type,
          allocation_value: Number(newSavingsTarget.allocation_value),
          notes: newSavingsTarget.notes.trim() || null,
          savings_period_months: savingsPeriodMonths,
          savings_period_started_at: new Date().toISOString(),
          early_withdrawal_penalty_percent: Number(newSavingsTarget.early_withdrawal_penalty_percent || 5),
        })

      if (error && isMissingOrUnauthorizedSavingsTargets(error)) {
        toast.error('Personal savings is not available until the latest database changes are applied.')
        return
      }
      if (error) throw error
      await notifyUser({
        targetUserId: user.id,
        title: 'Savings target created',
        message: `Your savings target "${newSavingsTarget.name}" was created successfully.`,
        type: 'success',
        link: '/personal-savings',
        emailSubject: 'Your savings target is ready',
      })

      setNewSavingsTarget({
        name: '',
        purpose: 'rent',
        destination_label: '',
        target_amount: 0,
        current_amount: 0,
        auto_allocate: true,
        allocation_type: 'percentage',
        allocation_value: 100,
        notes: '',
        savings_period_months: 12,
        early_withdrawal_penalty_percent: 5,
        lock_period_months: 12,
      })
      setShowSavingsTargetForm(false)
      await fetchSavingsTargets(user.id)
      toast.success('Savings target created')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to create savings target')
    } finally {
      setCreatingSavingsTarget(false)
    }
  }

  async function handleSavingsTargetStatusChange(id: string, status: SavingsStatus) {
    try {
      if (!user) return
      const { error } = await supabase
        .from('user_savings_targets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      setSavingsTargets((current) => current.map((target) =>
        target.id === id ? { ...target, status } : target
      ))
      await notifyUser({
        targetUserId: user.id,
        title: 'Savings target updated',
        message: `Your savings target "${savingsTargets.find((target) => target.id === id)?.name || 'target'}" is now ${status}.`,
        type: 'info',
        link: '/personal-savings',
        emailSubject: 'Your savings target status changed',
      })
      toast.success(`Savings target ${status}`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to update savings target')
    }
  }

  const formatSavingsPurpose = (purpose: SavingsPurpose) => {
    switch (purpose) {
      case 'daily_payments':
        return 'Daily payments'
      case 'bill_payment':
        return 'Bill payment'
      default:
        return purpose.charAt(0).toUpperCase() + purpose.slice(1)
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedChamaId || !user) return
    try {
      setCreatingRule(true)
      const { error } = await supabase
        .from('penalty_rules')
        .insert({
          chama_id: selectedChamaId,
          name: newRule.name,
          description: newRule.description,
          event_type: newRule.event_type,
          points_penalty: Number(newRule.points_penalty) || 0,
          monetary_penalty: Number(newRule.monetary_penalty) || 0,
          created_by: user.id
        })
      if (error) throw error
      setNewRule({ name: '', description: '', event_type: 'late_contribution', points_penalty: 0, monetary_penalty: 0 })
      setShowRuleForm(false)
      fetchRules(selectedChamaId)
      toast.success('Rule created')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to create rule')
    } finally {
      setCreatingRule(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage(null)

    try {
      const phoneVariants = getKenyanPhoneVariants(profile.phone)
      if (phoneVariants.length === 0) {
        throw new Error('Please enter a valid phone number.')
      }

      const { data: existingPhones, error: lookupError } = await supabase
        .from('users')
        .select('id')
        .in('phone', phoneVariants)
        .neq('id', user.id)
        .limit(1)

      if (lookupError) throw lookupError

      if (existingPhones?.length) {
        throw new Error('This phone number is already linked to another Ratibu account.')
      }

      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          ...profile,
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }
      await notifyUser({
        targetUserId: user.id,
        title: 'Profile updated',
        message: 'Your profile changes were saved successfully.',
        type: 'success',
        emailSubject: 'Your Ratibu profile was updated',
      })
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'code' in err && 'message' in err && isDuplicatePhoneError(err as { code?: string; message?: string; details?: string; hint?: string })
        ? 'This phone number is already linked to another Ratibu account.'
        : getErrorMessage(err)
      setMessage({ type: 'error', text: message })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!user) return
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      setSaving(true)
      
      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Update Profile state and DB
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError
      await notifyUser({
        targetUserId: user.id,
        title: 'Avatar updated',
        message: 'Your profile photo was updated successfully.',
        type: 'success',
        emailSubject: 'Your Ratibu profile photo was updated',
      })
      
      setMessage({ type: 'success', text: 'Avatar updated!' })
    } catch (err: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  async function handleResetTransactionPin(e: React.FormEvent) {
    e.preventDefault()
    if (newTransactionPin.length < 4 || newTransactionPin.length > 6) {
      toast.error('Enter a 4 to 6 digit PIN')
      return
    }
    if (newTransactionPin !== confirmTransactionPin) {
      toast.error('PINs do not match')
      return
    }

    try {
      setResettingPin(true)
      await resetTransactionPin(newTransactionPin)
      if (user) {
        await notifyUser({
          targetUserId: user.id,
          title: 'Transaction PIN updated',
          message: 'Your transaction PIN was changed successfully.',
          type: 'success',
          emailSubject: 'Your Ratibu PIN was updated',
        })
      }
      setShowPinResetForm(false)
      setNewTransactionPin('')
      setConfirmTransactionPin('')
      toast.success('Transaction PIN updated')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setResettingPin(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          aria-label="Go back"
          title="Go back"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
      </div>

      <div className="mb-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#00C853]">My Wallet</p>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Send money and review transfer history</h2>
            <p className="text-sm text-slate-500">Open your wallet for Ratibu member-to-member transfers and balance checks.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="inline-flex items-center justify-center rounded-2xl bg-[#00C853] px-5 py-3 font-bold text-white"
        >
          Open Wallet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar Section */}
        <div className="lg:col-span-1">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="relative inline-block group mb-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#00C853]/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload profile photo"
                title="Upload profile photo"
                className="absolute bottom-0 right-0 p-2 bg-[#00C853] text-white rounded-full shadow-lg hover:scale-110 transition-transform"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                className="hidden" 
                accept="image/*"
                aria-label="Choose profile photo"
                title="Choose profile photo"
              />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : 'Unnamed User'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{user?.email}</p>
            
            <div className="text-left space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                {profile.kyc_status === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                    <span>Verified Member</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>{profile.kyc_status.charAt(0).toUpperCase() + profile.kyc_status.slice(1)} Verification</span>
                  </>
                )}
              </div>
            </div>

            {profile.kyc_status === 'not_started' || profile.kyc_status === 'rejected' ? (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => navigate('/onboarding')}
                  className="w-full flex items-center justify-between p-4 bg-[#00C853]/5 hover:bg-[#00C853]/10 text-[#00C853] rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-bold text-sm">
                      {profile.kyc_status === 'rejected' ? 'Re-submit KYC' : 'Verify Profile'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : profile.kyc_status === 'pending' ? (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-amber-500 text-center font-medium">
                  Your documents are under review (24–48 hrs)
                </p>
              </div>
            ) : null}

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
               <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-[#00C853]/30">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Referral Code</p>
                  <div className="flex items-center justify-between">
                     <span className="font-black text-[#00C853] tracking-widest">{profile.referral_code}</span>
                     <button 
                        onClick={() => {
                           navigator.clipboard.writeText(profile.referral_code)
                           toast.success('Code copied!')
                        }}
                        aria-label="Copy referral code"
                        title="Copy referral code"
                        className="p-2 hover:bg-[#00C853]/10 rounded-lg transition-colors"
                     >
                        <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                     </button>
                  </div>
               </div>
            </div>
           <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-left">Member Categories</p>
              <div className="flex flex-wrap gap-2">
                {profile.member_category.length > 0 ? profile.member_category.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                    {cat}
                  </span>
                )) : (
                  <span className="text-sm text-slate-400 italic">No categories selected</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                  message.type === 'success' 
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="profile-first-name" className="text-sm font-bold text-slate-700 dark:text-slate-300">First Name</label>
                  <input
                    id="profile-first-name"
                    type="text"
                    value={profile.first_name}
                    onChange={e => setProfile({...profile, first_name: e.target.value})}
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="profile-last-name" className="text-sm font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                  <input
                    id="profile-last-name"
                    type="text"
                    value={profile.last_name}
                    onChange={e => setProfile({...profile, last_name: e.target.value})}
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="profile-phone" className="text-sm font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="profile-phone"
                      type="tel"
                      value={profile.phone}
                      onChange={e => setProfile({...profile, phone: e.target.value})}
                      placeholder="e.g. 254700000000"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="profile-bio" className="text-sm font-bold text-slate-700 dark:text-slate-300">Bio</label>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    value={profile.bio}
                    onChange={e => setProfile({...profile, bio: e.target.value})}
                    placeholder="Tell us a bit about yourself..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all resize-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Security</h3>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Transaction PIN</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Reset the PIN used for deposits and withdrawals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinResetForm(true)}
                  className="px-4 py-2 rounded-xl bg-[#00C853] text-white font-bold text-sm"
                >
                  Reset PIN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Referral + Penalties */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#00C853]" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Personal Savings Targets</h3>
              </div>
              <button
                onClick={() => setShowSavingsTargetForm(!showSavingsTargetForm)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00C853]/10 text-[#00C853] text-xs font-black uppercase tracking-widest"
              >
                {showSavingsTargetForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showSavingsTargetForm ? 'Close' : 'Add Target'}
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Configure personal targets and define whether funds should ultimately support rent, daily payments, bills, or withdrawals.
            </p>

            {showSavingsTargetForm && (
              <form onSubmit={handleCreateSavingsTarget} className="p-4 mb-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <label htmlFor="savings-target-name" className="sr-only">Savings target name</label>
                <input
                  id="savings-target-name"
                  value={newSavingsTarget.name}
                  onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Savings target name"
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label htmlFor="savings-purpose" className="sr-only">Savings target purpose</label>
                  <select
                    id="savings-purpose"
                    value={newSavingsTarget.purpose}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, purpose: e.target.value as SavingsPurpose }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="rent">Rent</option>
                    <option value="daily_payments">Daily payments</option>
                    <option value="bill_payment">Bill payment</option>
                    <option value="withdrawal">Withdrawal reserve</option>
                    <option value="custom">Custom</option>
                  </select>
                  <label htmlFor="savings-destination-label" className="sr-only">Savings destination label</label>
                  <input
                    id="savings-destination-label"
                    value={newSavingsTarget.destination_label}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, destination_label: e.target.value }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Destination label e.g. House rent"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label htmlFor="savings-target-amount" className="sr-only">Savings target amount</label>
                  <input
                    id="savings-target-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={newSavingsTarget.target_amount || ''}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, target_amount: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Target amount (KES)"
                    required
                  />
                  <label htmlFor="savings-current-amount" className="sr-only">Current savings amount</label>
                  <input
                    id="savings-current-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSavingsTarget.current_amount || ''}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, current_amount: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Current saved (KES)"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label htmlFor="savings-allocation-type" className="sr-only">Savings allocation type</label>
                  <select
                    id="savings-allocation-type"
                    value={newSavingsTarget.allocation_type}
                    onChange={(e) => setNewSavingsTarget(prev => ({
                      ...prev,
                      allocation_type: e.target.value as AllocationType,
                      allocation_value: e.target.value === 'percentage' ? 100 : prev.allocation_value
                    }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="percentage">Allocate by percentage</option>
                    <option value="fixed_amount">Allocate by fixed amount</option>
                  </select>
                  <label htmlFor="savings-allocation-value" className="sr-only">Savings allocation value</label>
                  <input
                    id="savings-allocation-value"
                    type="number"
                    min="1"
                    step="0.01"
                    value={newSavingsTarget.allocation_value || ''}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, allocation_value: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder={newSavingsTarget.allocation_type === 'percentage' ? 'Allocation %' : 'Allocation amount (KES)'}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label htmlFor="savings-period-months" className="sr-only">Savings period</label>
                  <select
                    id="savings-period-months"
                    value={newSavingsTarget.savings_period_months}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, savings_period_months: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value={3}>Savings period: 3 months</option>
                    <option value={6}>Savings period: 6 months</option>
                    <option value={12}>Savings period: 12 months</option>
                    <option value={24}>Savings period: 24 months</option>
                    <option value={36}>Savings period: 36 months</option>
                  </select>
                  <label htmlFor="savings-penalty-percent" className="sr-only">Early withdrawal penalty</label>
                  <input
                    id="savings-penalty-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newSavingsTarget.early_withdrawal_penalty_percent}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, early_withdrawal_penalty_percent: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Early withdrawal penalty (%)"
                  />
                </div>
                <label htmlFor="savings-notes" className="sr-only">Savings target notes</label>
                <textarea
                  id="savings-notes"
                  value={newSavingsTarget.notes}
                  onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Notes for this savings target"
                  rows={2}
                />
                <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSavingsTarget.auto_allocate}
                    onChange={(e) => setNewSavingsTarget(prev => ({ ...prev, auto_allocate: e.target.checked }))}
                  />
                  Enable automatic allocation toward this target
                </label>
                <button
                  type="submit"
                  disabled={creatingSavingsTarget}
                  className="w-full py-3 bg-[#00C853] text-white rounded-xl font-black"
                >
                  {creatingSavingsTarget ? 'Creating...' : 'Create Savings Target'}
                </button>
              </form>
            )}

            {loadingSavingsTargets ? (
              <div className="text-sm text-slate-500">Loading savings targets...</div>
            ) : savingsTargets.length === 0 ? (
              <div className="text-sm text-slate-500">No savings targets yet. Create one for rent, daily payments, bill payments, or a withdrawal reserve.</div>
            ) : (
              <div className="grid gap-3">
                {savingsTargets.map((target) => {
                  const progress = Math.min((Number(target.current_amount) / Number(target.target_amount)) * 100, 100)
                  const savingsPeriodEndsAt = target.savings_period_months && target.savings_period_started_at
                    ? new Date(new Date(target.savings_period_started_at).getTime() + Number(target.savings_period_months) * 30 * 24 * 60 * 60 * 1000)
                    : null
                  const isSavingsPeriodActive = Boolean(savingsPeriodEndsAt && savingsPeriodEndsAt > new Date())
                  return (
                    <div key={target.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{target.name}</p>
                          <p className="text-xs text-slate-500">
                            Route to {target.destination_label || formatSavingsPurpose(target.purpose)}
                          </p>
                          {target.savings_period_months && savingsPeriodEndsAt && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              Savings period: {target.savings_period_months} months
                              {isSavingsPeriodActive ? ' - early withdrawal penalty applies' : ' - penalty-free now'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                            target.status === 'completed'
                              ? 'bg-green-500/10 text-green-600'
                              : target.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-blue-500/10 text-blue-600'
                          }`}>
                            {target.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSavingsTargetStatusChange(target.id, target.status === 'active' ? 'paused' : 'active')}
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-200/70 dark:bg-slate-700"
                          >
                            {target.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                      </div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">KES {Number(target.current_amount).toLocaleString()}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">KES {Number(target.target_amount).toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3">
                        <svg
                          viewBox="0 0 100 8"
                          preserveAspectRatio="none"
                          className="h-full w-full"
                          role="img"
                          aria-label={`${target.name} savings progress`}
                        >
                          <rect
                            x="0"
                            y="0"
                            width={progress}
                            height="8"
                            rx="4"
                            fill="#00C853"
                          />
                        </svg>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {target.auto_allocate ? 'Auto allocation on' : 'Manual tracking'}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {target.allocation_type === 'percentage'
                            ? `${Number(target.allocation_value)}% per allocation`
                            : `KES ${Number(target.allocation_value).toLocaleString()} per allocation`}
                        </span>
                        {target.early_withdrawal_penalty_percent !== undefined && (
                          <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            {Number(target.early_withdrawal_penalty_percent).toFixed(1)}% early penalty
                          </span>
                        )}
                      </div>
                      {target.notes && (
                        <p className="mt-3 text-xs text-slate-500">{target.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#00C853]" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Referral & Points</h3>
              </div>
              <span className="text-xs font-bold text-[#00C853] bg-[#00C853]/10 px-3 py-1 rounded-full">
                {stats?.points?.toLocaleString() || 0} pts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Referral Points</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.referral_points?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Penalty Points</p>
                <p className="text-xl font-black text-amber-500">{stats?.penalty_points?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Contributions</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.total_contributions || 0}</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Penalty Rules</h3>
              </div>
              {['admin', 'treasurer', 'secretary'].includes(
                userChamas.find(c => c.id === selectedChamaId)?.role ?? ''
              ) && (
                <button
                  onClick={() => setShowRuleForm(!showRuleForm)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-black uppercase tracking-widest"
                >
                  {showRuleForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showRuleForm ? 'Close' : 'Add Rule'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold text-slate-500">Chama</span>
              <label htmlFor="profile-chama-select" className="sr-only">Select chama</label>
              <select
                id="profile-chama-select"
                value={selectedChamaId || ''}
                onChange={(e) => setSelectedChamaId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
              >
                {userChamas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {showRuleForm && (
              <form onSubmit={handleCreateRule} className="p-4 mb-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <label htmlFor="penalty-rule-name" className="sr-only">Penalty rule name</label>
                <input
                  id="penalty-rule-name"
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Rule name (e.g. Late contribution)"
                  required
                />
                <label htmlFor="penalty-rule-description" className="sr-only">Penalty rule description</label>
                <textarea
                  id="penalty-rule-description"
                  value={newRule.description}
                  onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Description"
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label htmlFor="penalty-event-type" className="sr-only">Penalty event type</label>
                  <select
                    id="penalty-event-type"
                    value={newRule.event_type}
                    onChange={(e) => setNewRule(prev => ({ ...prev, event_type: e.target.value }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="late_contribution">Late Contribution</option>
                    <option value="missed_meeting">Missed Meeting</option>
                    <option value="missed_payment">Missed Payment</option>
                    <option value="other">Other</option>
                  </select>
                  <label htmlFor="penalty-points" className="sr-only">Penalty points amount</label>
                  <input
                    id="penalty-points"
                    type="number"
                    value={newRule.points_penalty}
                    onChange={(e) => setNewRule(prev => ({ ...prev, points_penalty: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Points penalty"
                  />
                  <label htmlFor="penalty-monetary" className="sr-only">Penalty amount in Kenyan shillings</label>
                  <input
                    id="penalty-monetary"
                    type="number"
                    value={newRule.monetary_penalty}
                    onChange={(e) => setNewRule(prev => ({ ...prev, monetary_penalty: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="KES penalty"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingRule}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-black"
                >
                  {creatingRule ? 'Creating...' : 'Create Rule'}
                </button>
              </form>
            )}

            {loadingRules ? (
              <div className="text-sm text-slate-500">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="text-sm text-slate-500">No rules yet for this chama.</div>
            ) : (
              <div className="grid gap-3">
                {rules.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600">-{r.points_penalty} pts</span>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">KES {r.monetary_penalty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-[#00C853]" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Recent Penalties</h3>
            </div>
            {penalties.length === 0 ? (
              <div className="text-sm text-slate-500">No penalties applied.</div>
            ) : (
              <div className="grid gap-3">
                {penalties.map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{p.event_type.replace('_',' ')}</p>
                        <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-xs font-bold text-amber-600">-{p.points_penalty} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {['admin', 'super_admin'].includes(profile.system_role) && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw className="w-5 h-5 text-[#00C853]" />
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">M-Pesa Reversals</h3>
          </div>
          <form onSubmit={handleRequestReversal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={reversalTransactionId}
              onChange={(e) => setReversalTransactionId(e.target.value)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
              placeholder="Transaction ID"
            />
            <input
              value={reversalAmount}
              onChange={(e) => setReversalAmount(e.target.value)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
              placeholder="Amount (KES)"
            />
            <input
              value={reversalReceiverParty}
              onChange={(e) => setReversalReceiverParty(e.target.value)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white md:col-span-2"
              placeholder="Receiver shortcode"
            />
            <input
              value={reversalRemarks}
              onChange={(e) => setReversalRemarks(e.target.value)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white md:col-span-2"
              placeholder="Remarks"
            />
            <button
              type="submit"
              disabled={requestingReversal}
              className="md:col-span-2 rounded-2xl bg-[#00C853] px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              {requestingReversal ? 'Sending...' : 'Request Reversal'}
            </button>
          </form>
        </div>
      )}

      {showPinResetForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#00C853]">Security Check</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Reset Transaction PIN</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Create a new 4 to 6 digit PIN for approvals.
              </p>
            </div>
            <form onSubmit={handleResetTransactionPin} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newTransactionPin}
                onChange={(e) => setNewTransactionPin(e.target.value.replace(/\s+/g, ''))}
                placeholder="New PIN"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmTransactionPin}
                onChange={(e) => setConfirmTransactionPin(e.target.value.replace(/\s+/g, ''))}
                placeholder="Confirm PIN"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinResetForm(false)
                    setNewTransactionPin('')
                    setConfirmTransactionPin('')
                  }}
                  className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPin}
                  className="flex-1 rounded-2xl bg-[#00C853] px-4 py-3 font-bold text-white disabled:opacity-60"
                >
                  {resettingPin ? 'Saving...' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
