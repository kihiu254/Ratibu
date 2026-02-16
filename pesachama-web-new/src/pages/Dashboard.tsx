import { Plus, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Dashboard() {
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
                <h3 className="text-3xl font-bold mb-4">KES 124,500</h3>
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 w-fit px-2 py-1 rounded-lg">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>+12.5% this month</span>
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
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">3</h3>
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
             <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">KES 2,400</h3>
        </motion.div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Transactions</h3>
            <button className="text-sm text-[#00C853] hover:text-green-600 font-medium">View All</button>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                            {i % 2 === 0 ? <ArrowUpRight className="w-5 h-5 text-green-500" /> : <ArrowDownLeft className="w-5 h-5 text-red-500" />}
                        </div>
                        <div>
                            <p className="font-medium text-slate-900 dark:text-white">Monthly Contribution</p>
                            <p className="text-sm text-slate-500">Family Chama • Today, 10:23 AM</p>
                        </div>
                    </div>
                    <span className={`font-bold ${i % 2 === 0 ? 'text-green-500' : 'text-slate-900 dark:text-white'}`}>
                        {i % 2 === 0 ? '+ KES 5,000' : '- KES 2,000'}
                    </span>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}
