import { useState, useEffect } from 'react'
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet, PiggyBank, BadgeDollarSign, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isMissingOrUnauthorizedSavingsTargets } from '../lib/supabaseErrors'
import { formatDistanceToNow } from 'date-fns'

interface DashboardStats {
  totalBalance: number
  activeChamas: number
  pendingPayments: number
  recentTransactions: TransactionSummary[]
}

interface TransactionSummary {
  id: string
  amount: number
  type: string
  status: string
  created_at: string
  description?: string | null
}

interface SavingsTarget {
  id: string
  name: string
  purpose: 'rent' | 'daily_payments' | 'bill_payment' | 'withdrawal' | 'custom'
  destination_label: string | null
  target_amount: number
  current_amount: number
  allocation_type: 'percentage' | 'fixed_amount'
  allocation_value: number
  status: 'active' | 'paused' | 'completed'
}

const productCards = [
  {
    title: 'Savings',
    description: 'Create goals, track progress, and manage personal or group savings.',
    href: '/personal-savings',
    cta: 'Open Savings',
    icon: PiggyBank,
  },
  {
    title: 'KCB M-PESA',
    description: 'Open the KCB M-PESA hub for savings, loans, and linked bill payments.',
    href: '/kcb-mpesa',
    cta: 'Open Hub',
    icon: BadgeDollarSign,
  },
  {
    title: 'Loans & Credit',
    description: 'Review your loan records and repayment timelines in one secure view.',
    href: '/loans',
    cta: 'Open Loans',
    icon: Wallet,
  },
  {
    title: 'Marketplace',
    description: 'Check your credit score, apply for vendor, agent, or rider roles, and send money to members.',
    href: '/marketplace',
    cta: 'Open Marketplace',
    icon: BadgeDollarSign,
  },
  {
    title: 'KPLC Bills',
    description: 'Pay for prepaid tokens or postpaid electricity bills from one place.',
    href: '/kplc-bill',
    cta: 'Pay KPLC',
    icon: BadgeDollarSign,
  },
]

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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    activeChamas: 0,
    pendingPayments: 0,
    recentTransactions: []
  })
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch Active Chamas Count
      const { count: activeChamas } = await supabase
        .from('chama_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')

      // 2. Fetch Pending Payments (Sum)
      // Note: Assuming 'payment_requests' exists or similar table. 
      // If not standard, we might need adjustments. 
      // For now, let's try to count pending payment requests if the table exists, 
      // otherwise default to 0 to avoid breaking.
      // We will check 'transactions' for pending status instead if requests don't exist.
      // Or strictly matching schema: 'transactions' with status = 'pending'.
      
      const { data: pendingData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending')
      
      const pendingPayments = pendingData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0

      // 3. Fetch Recent Transactions
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      // 4. Calculate Total Balance
      // Sum of all completed deposits minus withdrawals
      // Or if there's a strict 'wallet' concept.
      // For Chama context, it's usually sum of 'transactions' (completed).
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user.id)
        .eq('status', 'completed')

      const totalBalance = allTransactions?.reduce((acc, curr) => {
        if (curr.type === 'deposit') return acc + Number(curr.amount)
        if (curr.type === 'withdrawal') return acc - Number(curr.amount)
        return acc
      }, 0) || 0

      setStats({
        totalBalance,
        activeChamas: activeChamas || 0,
        pendingPayments,
        recentTransactions: recentTransactions || []
      })

      const { data: goals, error: goalsError } = await supabase
        .from('user_savings_targets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (goalsError && !isMissingOrUnauthorizedSavingsTargets(goalsError)) {
        throw goalsError
      }

      setSavingsTargets((goals || []) as SavingsTarget[])

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const formatPurpose = (purpose: SavingsTarget['purpose']) => {
    switch (purpose) {
      case 'daily_payments':
        return 'Daily payments'
      case 'bill_payment':
        return 'Bill payment'
      default:
        return purpose.charAt(0).toUpperCase() + purpose.slice(1)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Welcome back, here's your financial overview.</p>
        </div>
        <Link 
            to="/chamas"
            className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20"
        >
            <Plus className="w-4 h-4" />
            New Chama
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance Card */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wallet className="w-24 h-24" />
            </div>
            <div className="relative z-10">
                <p className="text-slate-400 font-medium mb-1">Total Balance</p>
                <h3 className="text-3xl font-bold mb-4">KES {stats.totalBalance.toLocaleString()}</h3>
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 w-fit px-2 py-1 rounded-lg">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Calculated from history</span>
                </div>
            </div>
        </motion.div>

        {/* Active Chamas Card */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm"
        >
             <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <Wallet className="w-6 h-6" />
                </div>
             </div>
             <p className="text-slate-500 dark:text-slate-400 font-medium">Active Chamas</p>
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.activeChamas}</h3>
        </motion.div>

        {/* Pending Contributions */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm"
        >
             <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                    <ArrowDownLeft className="w-6 h-6" />
                </div>
             </div>
             <p className="text-slate-500 dark:text-slate-400 font-medium">Pending Payments</p>
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">KES {stats.pendingPayments.toLocaleString()}</h3>
        </motion.div>
      </div>

      {/* Products */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Products</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Quick access to savings and loan tools.</p>
          </div>
          <Link to="/products" className="text-sm text-[#00C853] hover:text-green-600 font-medium inline-flex items-center gap-1">
            Explore all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productCards.map((product, index) => (
              <motion.div
                key={product.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 text-[#00C853] flex items-center justify-center">
                    <product.icon className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00C853]/10 text-[#00C853]">
                    Live
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white text-lg">{product.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{product.description}</p>
                </div>
                <div className="mt-auto">
                  <Link
                    to={product.href}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00C853] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-600"
                  >
                    {product.cta}
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Personal Savings Targets</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Set individual goals and define how funds should be routed when they mature.</p>
          </div>
          <Link to="/profile" className="text-sm text-[#00C853] hover:text-green-600 font-medium">
            Manage in Profile
          </Link>
        </div>
        <div className="p-6">
          {savingsTargets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-slate-500">
              No personal savings targets yet. Create one in your profile for rent, daily payments, bill payments, or withdrawals.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {savingsTargets.slice(0, 4).map((target) => {
                const progress = Math.min((Number(target.current_amount) / Number(target.target_amount)) * 100, 100)
                return (
                  <div key={target.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{target.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Route to {target.destination_label || formatPurpose(target.purpose)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        target.status === 'completed'
                          ? 'bg-green-500/10 text-green-600'
                          : target.status === 'paused'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-blue-500/10 text-blue-600'
                      }`}>
                        {target.status}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">KES {Number(target.current_amount).toLocaleString()}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">KES {Number(target.target_amount).toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-3">
                      <div className={`h-full bg-[#00C853] ${progressWidthClass(progress)}`} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Auto allocation: {target.allocation_type === 'percentage'
                        ? `${Number(target.allocation_value)}% of matched savings`
                        : `KES ${Number(target.allocation_value).toLocaleString()} per matched savings event`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Transactions</h3>
            <Link to="/statement?account=all&name=All%20Transactions" className="text-sm text-[#00C853] hover:text-green-600 font-medium">View All</Link>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {stats.recentTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                    No recent transactions found.
                </div>
            ) : (
                stats.recentTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                {tx.type === 'deposit' ? <ArrowUpRight className="w-5 h-5 text-green-500" /> : <ArrowDownLeft className="w-5 h-5 text-red-500" />}
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white capitalize">{tx.description || tx.type}</p>
                                <p className="text-sm text-slate-500">
                                    {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                        <span className={`font-bold ${tx.type === 'deposit' ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
                            {tx.type === 'deposit' ? '+' : '-'} KES {Number(tx.amount).toLocaleString()}
                        </span>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}
