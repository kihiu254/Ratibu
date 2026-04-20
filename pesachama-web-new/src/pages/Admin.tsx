import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  Target,
  TrendingUp,
  ArrowRight,
  KeyRound,
  MoreVertical,
  Wallet,
  HandCoins,
  MessageSquareText,
  Landmark,
  BadgeDollarSign,
  ShieldCheck,
  CreditCard,
  Clock3,
  Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AdminStats {
  users: number
  chamas: number
  volume: number
  loans: number
  loanRequests: number
  pendingRoles: number
  marketplaceProfiles: number
  walletTransfers: number
  walletVolume: number
  ussdRequests: number
}

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: string
  created_at: string
}

interface Chama {
  id: string
  name: string
  balance: number
  category: string
  created_at: string
}

interface LoanRow {
  id: string
  amount: number
  status: string
  created_at: string
  chama_name: string | null
}

interface RoleApplicationRow {
  id: string
  role_type: string
  status: string
  business_name: string | null
  display_name: string | null
  required_score: number
  score_snapshot: number
  created_at: string
}

interface WalletTransferRow {
  id: string
  amount: number
  note: string | null
  channel: string
  status: string
  created_at: string
}

interface UssdLogRow {
  id: string
  phone_number: string
  request_text: string
  created_at: string
}

function fmtDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value?: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-sm relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <Icon className="w-20 h-20" />
      </div>
      <div className={`w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{value ?? '0'}</p>
    </motion.div>
  )
}

function SectionList({
  title,
  subtitle,
  ctaLabel,
  ctaPath,
  rows,
  emptyLabel,
  renderRow,
}: {
  title: string
  subtitle: string
  ctaLabel: string
  ctaPath: string
  rows: unknown[]
  emptyLabel: string
  renderRow: (row: any) => React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ctaPath)}
          className="text-[#00C853] text-xs font-bold flex items-center gap-2 hover:gap-3 transition-all"
        >
          {ctaLabel} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length > 0 ? rows.map((row, i) => (
            <div key={(row as any).id ?? i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              {renderRow(row)}
            </div>
          )) : (
            <div className="p-6 text-slate-500">{emptyLabel}</div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats>({
    users: 0,
    chamas: 0,
    volume: 0,
    loans: 0,
    loanRequests: 0,
    pendingRoles: 0,
    marketplaceProfiles: 0,
    walletTransfers: 0,
    walletVolume: 0,
    ussdRequests: 0,
  })
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([])
  const [recentChamas, setRecentChamas] = useState<Chama[]>([])
  const [recentLoans, setRecentLoans] = useState<LoanRow[]>([])
  const [recentRoleApps, setRecentRoleApps] = useState<RoleApplicationRow[]>([])
  const [recentTransfers, setRecentTransfers] = useState<WalletTransferRow[]>([])
  const [recentUssd, setRecentUssd] = useState<UssdLogRow[]>([])

  useEffect(() => {
    void fetchAdminData()
  }, [])

  async function fetchAdminData() {
    try {
      const [
        usersCountRes,
        chamasCountRes,
        transactionsRes,
        loansCountRes,
        loanRequestsCountRes,
        pendingRolesRes,
        marketplaceProfilesRes,
        walletTransfersRes,
        walletTransfersVolumeRes,
        ussdRequestsRes,
        recentUsersRes,
        recentChamasRes,
        recentLoansRes,
        recentRoleAppsRes,
        recentTransfersRes,
        recentUssdRes,
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('chamas').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('amount'),
        supabase.from('loans').select('*', { count: 'exact', head: true }),
        supabase.from('loan_requests').select('*', { count: 'exact', head: true }),
        supabase.from('marketplace_role_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('marketplace_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('wallet_transfers').select('*', { count: 'exact', head: true }),
        supabase.from('wallet_transfers').select('amount'),
        supabase.from('ussd_request_log').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('id, email, first_name, last_name, system_role, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('chamas').select('id, name, balance, category, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('loans').select('id, amount, status, created_at, chama:chamas(name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('marketplace_role_applications').select('id, role_type, status, business_name, display_name, required_score, score_snapshot, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('wallet_transfers').select('id, amount, note, channel, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('ussd_request_log').select('id, phone_number, request_text, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      const totalVolume = transactionsRes.data?.reduce((sum, row) => sum + Number((row as any).amount ?? 0), 0) ?? 0
      const walletVolume = walletTransfersVolumeRes.data?.reduce((sum, row) => sum + Number((row as any).amount ?? 0), 0) ?? 0

      setStats({
        users: usersCountRes.count ?? 0,
        chamas: chamasCountRes.count ?? 0,
        volume: totalVolume,
        loans: loansCountRes.count ?? 0,
        loanRequests: loanRequestsCountRes.count ?? 0,
        pendingRoles: pendingRolesRes.count ?? 0,
        marketplaceProfiles: marketplaceProfilesRes.count ?? 0,
        walletTransfers: walletTransfersRes.count ?? 0,
        walletVolume,
        ussdRequests: ussdRequestsRes.count ?? 0,
      })

      setRecentUsers((recentUsersRes.data ?? []) as UserProfile[])
      setRecentChamas((recentChamasRes.data ?? []) as Chama[])
      setRecentLoans((recentLoansRes.data ?? []).map((row: any) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        status: row.status ?? 'pending',
        created_at: row.created_at,
        chama_name: row.chama?.name ?? null,
      })))
      setRecentRoleApps((recentRoleAppsRes.data ?? []) as RoleApplicationRow[])
      setRecentTransfers((recentTransfersRes.data ?? []) as WalletTransferRow[])
      setRecentUssd((recentUssdRes.data ?? []) as UssdLogRow[])
    } catch (err) {
      console.error('Data fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users', value: stats.users.toLocaleString(), icon: Users, color: 'text-blue-500' },
    { label: 'Active Chamas', value: stats.chamas.toLocaleString(), icon: Target, color: 'text-[#00C853]' },
    { label: 'Network Volume', value: `KES ${stats.volume.toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Loans', value: stats.loans.toLocaleString(), icon: HandCoins, color: 'text-amber-500' },
    { label: 'Loan Requests', value: stats.loanRequests.toLocaleString(), icon: CreditCard, color: 'text-orange-400' },
    { label: 'Pending Roles', value: stats.pendingRoles.toLocaleString(), icon: ShieldCheck, color: 'text-cyan-400' },
    { label: 'Wallet Transfers', value: stats.walletTransfers.toLocaleString(), icon: Wallet, color: 'text-emerald-400' },
    { label: 'USSD Requests', value: stats.ussdRequests.toLocaleString(), icon: MessageSquareText, color: 'text-pink-400' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Admin Control Center</h1>
        <p className="text-slate-500">A single view for web, mobile, USSD, wallet, loans, and marketplace operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} color={stat.color} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[32px] shadow-sm border border-slate-700 overflow-hidden relative"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_#00C853,_transparent_45%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#00C853]">Operations</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Member recovery, loan routing, and channel health</h2>
            <p className="mt-2 text-slate-300 max-w-xl">
              Use this area to move quickly between PIN recovery, role approvals, loan requests, and the USSD / payment channels that support the Ratibu ecosystem.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/users')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              <KeyRound className="w-4 h-4" />
              PIN tools
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/roles')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
            >
              <ShieldCheck className="w-4 h-4" />
              Role review
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#00C853]">Finance</p>
              <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Wallet and loans</h3>
            </div>
            <Landmark className="w-5 h-5 text-[#00C853]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Wallet volume</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">KES {stats.walletVolume.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Marketplace profiles</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{stats.marketplaceProfiles.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Loan requests</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{stats.loanRequests.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Active loans</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{stats.loans.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#00C853]">Marketplace</p>
              <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Applications</h3>
            </div>
            <BadgeDollarSign className="w-5 h-5 text-[#00C853]" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <span className="text-sm font-medium text-slate-500">Pending role applications</span>
              <span className="font-black text-slate-900 dark:text-white">{stats.pendingRoles.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <span className="text-sm font-medium text-slate-500">Wallet transfers</span>
              <span className="font-black text-slate-900 dark:text-white">{stats.walletTransfers.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
              <span className="text-sm font-medium text-slate-500">USSD requests</span>
              <span className="font-black text-slate-900 dark:text-white">{stats.ussdRequests.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#00C853]">USSD</p>
              <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Channel health</h3>
            </div>
            <MessageSquareText className="w-5 h-5 text-[#00C853]" />
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">Recent sessions</p>
            <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{stats.ussdRequests.toLocaleString()}</p>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            This is the quick view for USSD traffic. The dedicated USSD admin page still has the full session and error logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <SectionList
          title="Recent Loan Applications"
          subtitle="Loan requests, approvals, and disbursement activity."
          ctaLabel="Open activities"
          ctaPath="/admin/activities"
          rows={recentLoans}
          emptyLabel="No recent loans yet."
          renderRow={(loan: LoanRow) => (
            <>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">KES {loan.amount.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{loan.chama_name || 'Personal Loan'} · {loan.status}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {fmtDate(loan.created_at)}
              </span>
            </>
          )}
        />

        <SectionList
          title="Recent Role Applications"
          subtitle="Vendor, rider, and agent applications by credit score."
          ctaLabel="Review roles"
          ctaPath="/admin/roles"
          rows={recentRoleApps}
          emptyLabel="No recent marketplace applications."
          renderRow={(app: RoleApplicationRow) => (
            <>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {app.role_type.toUpperCase()} · {app.business_name || app.display_name || 'Application'}
                </p>
                <p className="text-xs text-slate-500">Score {app.score_snapshot}/{app.required_score} · {app.status}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {fmtDate(app.created_at)}
              </span>
            </>
          )}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <SectionList
          title="Recent Wallet Transfers"
          subtitle="Internal member-to-member movements and related wallet traffic."
          ctaLabel="Open transactions"
          ctaPath="/admin/transactions"
          rows={recentTransfers}
          emptyLabel="No wallet transfers yet."
          renderRow={(transfer: WalletTransferRow) => (
            <>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">KES {Number(transfer.amount).toLocaleString()} · {transfer.channel}</p>
                <p className="text-xs text-slate-500">{transfer.note || 'Wallet transfer'} · {transfer.status}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {fmtDate(transfer.created_at)}
              </span>
            </>
          )}
        />

        <SectionList
          title="Recent USSD Activity"
          subtitle="Latest menu requests and user interactions."
          ctaLabel="Open USSD admin"
          ctaPath="/admin/ussd"
          rows={recentUssd}
          emptyLabel="No recent USSD requests yet."
          renderRow={(row: UssdLogRow) => (
            <>
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{row.phone_number}</p>
                <p className="text-xs text-slate-500">{row.request_text}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {fmtDate(row.created_at)}
              </span>
            </>
          )}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <SectionList
          title="Recent Onboarding"
          subtitle="The newest users on the platform."
          ctaLabel="View directory"
          ctaPath="/admin/users"
          rows={recentUsers}
          emptyLabel="No recent users."
          renderRow={(user: UserProfile) => (
            <>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[#00C853]">
                  {(user.first_name || 'U').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider ${user.system_role === 'super_admin' ? 'bg-[#00C853] text-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                  {user.system_role || 'user'}
                </span>
                <button aria-label={`More actions for ${user.first_name} ${user.last_name}`} title={`More actions for ${user.first_name} ${user.last_name}`} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        />

        <SectionList
          title="Recent Chamas"
          subtitle="Newest groups in the system."
          ctaLabel="Open registry"
          ctaPath="/admin/chamas"
          rows={recentChamas}
          emptyLabel="No recent chamas."
          renderRow={(chama: Chama) => (
            <>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{chama.name}</p>
                  <p className="text-xs text-slate-500">KES {Number(chama.balance || 0).toLocaleString()} · {chama.category || 'Group'}</p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {fmtDate(chama.created_at)}
              </span>
            </>
          )}
        />
      </div>
    </div>
  )
}
