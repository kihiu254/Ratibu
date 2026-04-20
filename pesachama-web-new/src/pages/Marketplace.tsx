import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRightLeft, BadgeCheck, BriefcaseBusiness, Building2, Loader2, Package, RadioTower, ShieldCheck, Truck, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Seo from '../components/Seo'
import { toast } from '../utils/toast'

type MarketplaceRole = 'vendor' | 'agent' | 'rider'

type MarketplaceOverview = {
  ok: boolean
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone: string | null
    wallet_balance: number
    credit_score: number
    credit_tier: string
    marketplace_status?: Record<string, unknown>
  }
  eligible_roles?: Record<MarketplaceRole, boolean>
  chama_roles?: Array<{ chama_id: string; chama_name: string; role: string }>
  applications?: Array<{
    role: MarketplaceRole
    business_name: string | null
    display_name: string | null
    service_category: string | null
    status: string
    required_score: number
    score_snapshot: number
    created_at: string
  }>
  profiles?: Array<{
    role: MarketplaceRole
    business_name: string | null
    display_name: string | null
    service_category: string | null
    till_number: string | null
    agent_number: string | null
    rider_code: string | null
    delivery_zone: string | null
    is_active: boolean
  }>
}

const ROLE_META: Record<MarketplaceRole, { title: string; icon: typeof BadgeCheck; minScore: number; description: string }> = {
  vendor: {
    title: 'Vendor',
    icon: Building2,
    minScore: 600,
    description: 'Sell services and products with a till number and route settlements through Ratibu.',
  },
  agent: {
    title: 'Agent',
    icon: RadioTower,
    minScore: 700,
    description: 'Register as a Ratibu agent to handle onboarding, support, and collections.',
  },
  rider: {
    title: 'Rider',
    icon: Truck,
    minScore: 650,
    description: 'Receive delivery jobs from chama vendors and get paid when deliveries are confirmed.',
  },
}

function roleLabel(role: MarketplaceRole) {
  return ROLE_META[role].title
}

export default function Marketplace() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [overview, setOverview] = useState<MarketplaceOverview | null>(null)
  const [roleType, setRoleType] = useState<MarketplaceRole>('vendor')
  const [businessName, setBusinessName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [serviceCategory, setServiceCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)

  useEffect(() => {
    void loadOverview()
  }, [])

  async function loadOverview() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.rpc('get_marketplace_overview', {
        p_user_id: user.id,
      })
      if (error) throw error
      setOverview((data as MarketplaceOverview) || null)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load marketplace overview')
    } finally {
      setLoading(false)
    }
  }

  async function requestRole(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase.rpc('request_marketplace_role', {
        p_user_id: user.id,
        p_role: roleType,
        p_business_name: businessName.trim() || null,
        p_display_name: displayName.trim() || null,
        p_service_category: serviceCategory.trim() || null,
        p_notes: notes.trim() || null,
      })
      if (error) throw error
      const result = data as { ok?: boolean; message?: string }
      if (!result?.ok) throw new Error(result?.message || 'Application failed')
      toast.success(result.message || 'Application submitted')
      setBusinessName('')
      setDisplayName('')
      setServiceCategory('')
      setNotes('')
      await loadOverview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendMoney(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(transferAmount)
    if (!receiverPhone.trim()) return toast.error('Enter a recipient phone number')
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid amount')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setTransferLoading(true)
    try {
      const { data, error } = await supabase.rpc('internal_wallet_transfer', {
        p_sender_user_id: user.id,
        p_receiver_phone: receiverPhone.trim(),
        p_amount: amount,
        p_note: transferNote.trim() || null,
      })
      if (error) throw error
      const result = data as { ok?: boolean; message?: string }
      if (!result?.ok) throw new Error(result?.message || 'Transfer failed')
      toast.success(result.message || 'Transfer completed')
      setReceiverPhone('')
      setTransferAmount('')
      setTransferNote('')
      await loadOverview()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send money')
    } finally {
      setTransferLoading(false)
    }
  }

  const user = overview?.user
  const eligibleRoles = overview?.eligible_roles || { vendor: false, agent: false, rider: false }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <Seo
        title="Ratibu Marketplace"
        description="Manage your Ratibu credit score, marketplace roles, internal wallet transfers, and chama role access."
        canonicalPath="/marketplace"
      />

      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#00C853]">Ratibu Marketplace</p>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-2">Credit-powered roles, payments, and delivery.</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Vendors, agents, and riders are unlocked by your credit score. You can also send money to other Ratibu members from the same wallet layer.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#00C853]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 shadow-2xl shadow-green-500/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em]">Credit Score</p>
                  <h2 className="text-5xl font-black mt-2">{user?.credit_score ?? 500}</h2>
                  <p className="text-sm text-white/70 mt-2">Tier: {user?.credit_tier ?? 'starter'}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <ShieldCheck className="h-8 w-8 text-[#00C853]" />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-white/60">Wallet Balance</span>
                <span className="font-bold">KES {Number(user?.wallet_balance ?? 0).toLocaleString()}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Chama Roles</p>
              <div className="mt-4 space-y-3">
                {(overview?.chama_roles?.length || 0) > 0 ? overview?.chama_roles?.map((item) => (
                  <div key={`${item.chama_id}-${item.role}`} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{item.chama_name}</p>
                      <p className="text-xs text-slate-500 uppercase font-bold">{item.role}</p>
                    </div>
                    <BadgeCheck className="h-5 w-5 text-[#00C853]" />
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500">
                    Your chama roles will show here when you join or create chamas.
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Role Eligibility</p>
              <div className="mt-4 space-y-3">
                {(['vendor', 'agent', 'rider'] as MarketplaceRole[]).map((role) => (
                  <div key={role} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{roleLabel(role)}</p>
                      <p className="text-xs text-slate-500">Min score {ROLE_META[role].minScore}</p>
                    </div>
                    <span className={`text-xs font-black uppercase px-2 py-1 rounded-full ${eligibleRoles[role] ? 'bg-[#00C853]/10 text-[#00C853]' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      {eligibleRoles[role] ? 'Eligible' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Package className="h-5 w-5 text-[#00C853]" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Apply for a Role</h2>
              </div>

              <form onSubmit={requestRole} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Role</span>
                    <select
                      value={roleType}
                      onChange={(e) => setRoleType(e.target.value as MarketplaceRole)}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                    >
                      <option value="vendor">Vendor</option>
                      <option value="agent">Agent</option>
                      <option value="rider">Rider</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Business Name</span>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Display Name</span>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Service Category</span>
                    <input
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                      placeholder="E-commerce, delivery, retail..."
                    />
                  </label>
                </div>
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-500 uppercase">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                    placeholder="Tell us what you want to offer"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#00C853] px-5 py-3 font-black text-white disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BriefcaseBusiness className="h-4 w-4" />}
                  Submit Application
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <ArrowRightLeft className="h-5 w-5 text-[#00C853]" />
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Send Money</h2>
              </div>

              <form onSubmit={sendMoney} className="space-y-4">
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-500 uppercase">Recipient Phone</span>
                  <input
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                    placeholder="07XX..., 2547..., or +2547..."
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-500 uppercase">Amount</span>
                  <input
                    type="number"
                    min="1"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                    placeholder="KES"
                  />
                </label>
                <label className="space-y-1 block">
                  <span className="text-xs font-bold text-slate-500 uppercase">Note</span>
                  <input
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white"
                    placeholder="Optional"
                  />
                </label>
                <button
                  type="submit"
                  disabled={transferLoading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/10 px-5 py-3 font-black text-[#00C853] disabled:opacity-60"
                >
                  {transferLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  Send to Ratibu Member
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-5 w-5 text-[#00C853]" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Marketplace Profiles</h2>
            </div>

            {(overview?.profiles?.length || 0) > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {overview?.profiles?.map((profile, index) => {
                  const meta = ROLE_META[profile.role]
                  const Icon = meta.icon
                  return (
                    <div key={`${profile.role}-${index}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="rounded-2xl bg-[#00C853]/10 p-3 text-[#00C853]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#00C853]">{profile.is_active ? 'Active' : 'Paused'}</span>
                      </div>
                      <p className="mt-4 font-bold text-slate-900 dark:text-white">{profile.display_name || profile.business_name || meta.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{profile.service_category || meta.description}</p>
                      <div className="mt-4 space-y-1 text-xs text-slate-500">
                        {profile.till_number && <p>Till: {profile.till_number}</p>}
                        {profile.agent_number && <p>Agent: {profile.agent_number}</p>}
                        {profile.rider_code && <p>Rider code: {profile.rider_code}</p>}
                        {profile.delivery_zone && <p>Zone: {profile.delivery_zone}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
                Approved vendor, agent, and rider profiles will appear here after review.
              </div>
            )}
          </div>

          <div className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="h-5 w-5 text-[#00C853]" />
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Applications</h2>
            </div>
            {(overview?.applications?.length || 0) > 0 ? (
              <div className="space-y-3">
                {overview?.applications?.map((app) => (
                  <div key={`${app.role}-${app.created_at}`} className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{roleLabel(app.role)}</p>
                      <p className="text-sm text-slate-500">{app.business_name || app.display_name || 'No business name'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-widest text-[#00C853]">{app.status}</p>
                      <p className="text-[10px] text-slate-500">Score {app.score_snapshot} / {app.required_score}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
                You have no marketplace applications yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
