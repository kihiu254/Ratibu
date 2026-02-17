import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Target, 
  TrendingUp, 
  ArrowRight,
  MoreVertical,
  Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AdminStats {
  users: number | null;
  chamas: number | null;
  volume: number;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  system_role: string;
  created_at: string;
}

interface Chama {
  id: string;
  name: string;
  balance: number;
  category: string;
  created_at: string;
}

export default function Admin() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([])
  const [recentChamas, setRecentChamas] = useState<Chama[]>([])

  useEffect(() => {
    fetchAdminData()
  }, [])

  async function fetchAdminData() {
    try {
      // Fetch stats
      const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
      const { count: chamaCount } = await supabase.from('chamas').select('*', { count: 'exact', head: true })
      const { data: transData } = await supabase.from('transactions').select('amount')
      
      const totalVolume = transData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0

      setStats({
        users: userCount,
        chamas: chamaCount,
        volume: totalVolume
      })

      // Fetch recent items
      const { data: users } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(5)
      const { data: chamas } = await supabase.from('chamas').select('*').order('created_at', { ascending: false }).limit(5)

      setRecentUsers(users || [])
      setRecentChamas(chamas || [])
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

  return (
    <div className="space-y-8">
      
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Dashboard Overview</h1>
        <p className="text-slate-500">Welcome back to the control center.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Users', value: stats?.users?.toLocaleString(), icon: Users, color: 'text-blue-500' },
          { label: 'Active Chamas', value: stats?.chamas?.toLocaleString(), icon: Target, color: 'text-[#00C853]' },
          { label: 'Network Volume', value: `KES ${stats?.volume?.toLocaleString()}`, icon: TrendingUp, color: 'text-purple-500' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] relative overflow-hidden group shadow-sm hover:shadow-md transition-all"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className={`w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Recent Users */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Recent Onboarding</h2>
            <button className="text-[#00C853] text-xs font-bold flex items-center gap-2 hover:gap-3 transition-all">
              View Directory <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentUsers.map((user, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[#00C853]">
                      {user.first_name?.[0]}
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
                    <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Chamas */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">New Chamas</h2>
            <button className="text-[#00C853] text-xs font-bold flex items-center gap-2 hover:gap-3 transition-all">
              Global Registry <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentChamas.map((chama, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
                      <Target className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{chama.name}</p>
                      <p className="text-xs text-slate-500">KES {chama.balance?.toLocaleString()} Balance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500`}>
                      {chama.category || 'Group'}
                    </span>
                    <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
