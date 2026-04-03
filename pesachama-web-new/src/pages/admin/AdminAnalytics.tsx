import { useEffect, useState } from 'react'
import {
  TrendingUp, Users, Target, CreditCard, ArrowUpRight, ArrowDownLeft,
  Loader2, Calendar, BarChart2, PieChart as PieIcon, Activity
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Stats {
  totalUsers: number
  kycPending: number
  kycApproved: number
  kycRejected: number
  totalChamas: number
  activeChamas: number
  totalTransactions: number
  totalVolume: number
  depositVolume: number
  withdrawalVolume: number
  newUsersThisMonth: number
  newChamasThisMonth: number
}

interface DayStat { day: string; amount: number; count: number }
interface TransactionRow { amount: number; type: string; status: string; created_at: string }
interface TopChama { id: string; name: string; balance: number | null; member_count: number | null }
type KycBarColor = 'bg-green-500' | 'bg-yellow-400' | 'bg-red-500'

function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon; color: string; trend?: number
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function KycDonutBar({ pending, approved, rejected }: { pending: number; approved: number; rejected: number }) {
  const total = pending + approved + rejected || 1
  const bars: Array<{ label: string; value: number; color: KycBarColor; pct: number }> = [
    { label: 'Approved', value: approved, color: 'bg-green-500', pct: Math.round(approved / total * 100) },
    { label: 'Pending',  value: pending,  color: 'bg-yellow-400', pct: Math.round(pending / total * 100) },
    { label: 'Rejected', value: rejected, color: 'bg-red-500',   pct: Math.round(rejected / total * 100) },
  ]
  const segmentColors = {
    'bg-green-500': '#22c55e',
    'bg-yellow-400': '#facc15',
    'bg-red-500': '#ef4444',
  } as const
  let xOffset = 0
  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label="KYC status distribution"
      >
        {bars.map((bar) => {
          const rect = (
            <rect
              key={bar.label}
              x={xOffset}
              y="0"
              width={bar.pct}
              height="12"
              fill={segmentColors[bar.color]}
            />
          )
          xOffset += bar.pct
          return rect
        })}
      </svg>
      <div className="flex gap-6">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${b.color}`} />
            <span className="text-xs text-slate-500">{b.label} <span className="font-bold text-slate-900 dark:text-white">{b.value}</span></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniBar({ data }: { data: DayStat[] }) {
  const max = Math.max(...data.map(d => d.amount)) || 1
  return (
    <div className="flex items-end gap-1 h-20">
      {data.slice(-14).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
            role="img"
            aria-label={`Daily volume for ${d.day}: KES ${d.amount.toLocaleString()}`}
          >
            <rect
              x="0"
              y={Math.max(0, 100 - Math.max(4, Math.round((d.amount / max) * 100)))}
              width="100"
              height={Math.max(4, Math.round((d.amount / max) * 100))}
              rx="6"
              fill="rgba(0, 200, 83, 0.2)"
            />
          </svg>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            KES {d.amount.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [dailyData, setDailyData] = useState<DayStat[]>([])
  const [loading, setLoading] = useState(true)
  const [topChamas, setTopChamas] = useState<TopChama[]>([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    try {
      setLoading(true)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        { count: totalUsers },
        { count: kycPending },
        { count: kycApproved },
        { count: kycRejected },
        { count: totalChamas },
        { count: newUsers },
        { count: newChamas },
        { data: txData },
        { data: chamasData },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
        supabase.from('users').select('*', { count: 'exact', head: true }).in('kyc_status', ['approved', 'verified']),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('kyc_status', 'rejected'),
        supabase.from('chamas').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('chamas').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('transactions').select('amount, type, status, created_at').order('created_at', { ascending: true }),
        supabase.from('chamas').select('id, name, balance, member_count').order('balance', { ascending: false }).limit(5),
      ])

      const completedTx = ((txData || []) as TransactionRow[]).filter((t) => t.status === 'completed' || t.status === 'success')
      const totalVolume = completedTx.reduce((s, t) => s + Number(t.amount), 0)
      const depositVolume = completedTx.filter(t => ['deposit', 'contribution', 'repayment'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0)
      const withdrawalVolume = completedTx.filter(t => ['withdrawal', 'loan'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0)

      // Build daily stats (last 30 days)
      const dayMap: Record<string, DayStat> = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        dayMap[key] = { day: key, amount: 0, count: 0 }
      }
      completedTx.forEach(t => {
        const key = t.created_at.slice(0, 10)
        if (dayMap[key]) {
          dayMap[key].amount += Number(t.amount)
          dayMap[key].count += 1
        }
      })

      setDailyData(Object.values(dayMap))
      setTopChamas((chamasData || []) as TopChama[])
      setStats({
        totalUsers: totalUsers || 0,
        kycPending: kycPending || 0,
        kycApproved: kycApproved || 0,
        kycRejected: kycRejected || 0,
        totalChamas: totalChamas || 0,
        activeChamas: totalChamas || 0,
        totalTransactions: (txData || []).length,
        totalVolume,
        depositVolume,
        withdrawalVolume,
        newUsersThisMonth: newUsers || 0,
        newChamasThisMonth: newChamas || 0,
      })
    } catch (err) {
      console.error('Analytics fetch error:', err)
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

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Analytics</h1>
          <p className="text-slate-500">Platform performance overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Members" value={stats.totalUsers.toLocaleString()} sub={`+${stats.newUsersThisMonth} this month`} icon={Users} color="bg-blue-100 dark:bg-blue-900/30 text-blue-600" />
        <StatCard label="Total Chamas" value={stats.totalChamas.toLocaleString()} sub={`+${stats.newChamasThisMonth} this month`} icon={Target} color="bg-green-100 dark:bg-green-900/30 text-[#00C853]" />
        <StatCard label="Network Volume" value={`KES ${(stats.totalVolume / 1000).toFixed(1)}K`} sub={`${stats.totalTransactions} transactions`} icon={TrendingUp} color="bg-purple-100 dark:bg-purple-900/30 text-purple-600" />
        <StatCard label="Transactions" value={stats.totalTransactions.toLocaleString()} icon={Activity} color="bg-orange-100 dark:bg-orange-900/30 text-orange-500" />
      </div>

      {/* Volume and KYC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Volume (30 days)</h2>
              <p className="text-xs text-slate-400">Daily transaction volume</p>
            </div>
            <BarChart2 className="w-5 h-5 text-slate-400" />
          </div>
          <MiniBar data={dailyData} />
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Inflow</p>
              <p className="text-lg font-black text-green-600">+KES {stats.depositVolume.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Outflow</p>
              <p className="text-lg font-black text-red-500">-KES {stats.withdrawalVolume.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* KYC Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">KYC Status</h2>
              <p className="text-xs text-slate-400">Member verification breakdown</p>
            </div>
            <PieIcon className="w-5 h-5 text-slate-400" />
          </div>
          <KycDonutBar pending={stats.kycPending} approved={stats.kycApproved} rejected={stats.kycRejected} />
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {[
              { label: 'Pending', value: stats.kycPending, color: 'text-yellow-600' },
              { label: 'Approved', value: stats.kycApproved, color: 'text-green-600' },
              { label: 'Rejected', value: stats.kycRejected, color: 'text-red-500' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Chamas */}
      {topChamas.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Top Chamas by Balance</h2>
              <p className="text-xs text-slate-400">Highest-performing groups</p>
            </div>
            <CreditCard className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-3">
            {topChamas.map((c, i) => {
              const maxBal = Number(topChamas[0]?.balance ?? 0) || 1
              const balance = Number(c.balance ?? 0)
              return (
                <div key={c.id} className="flex items-center gap-4">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-sm font-black text-[#00C853]">KES {balance.toLocaleString()}</p>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <svg
                        viewBox="0 0 100 6"
                        preserveAspectRatio="none"
                        className="h-full w-full"
                        role="img"
                        aria-label={`${c.name} balance bar`}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={(balance / maxBal) * 100}
                          height="6"
                          rx="3"
                          fill="#00C853"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
