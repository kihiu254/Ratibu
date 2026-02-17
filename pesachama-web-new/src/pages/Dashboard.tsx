import { useState, useEffect } from 'react'
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'

interface DashboardStats {
  totalBalance: number
  activeChamas: number
  pendingPayments: number
  recentTransactions: any[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    activeChamas: 0,
    pendingPayments: 0,
    recentTransactions: []
  })
  const [loading, setLoading] = useState(true)

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

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
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

      {/* Recent Activity Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Transactions</h3>
            <button className="text-sm text-[#00C853] hover:text-green-600 font-medium">View All</button>
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
