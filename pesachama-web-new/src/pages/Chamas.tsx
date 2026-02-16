import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Users, ArrowRight, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Chamas() {
  const [chamas, setChamas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchChamas()
  }, [])

  async function fetchChamas() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch chamas where user is a member
      const { data: members, error } = await supabase
        .from('chama_members')
        .select(`
          chama:chamas (
            id,
            name,
            description,
            balance,
            member_limit,
            contribution_frequency,
            created_at,
            total_members
          ),
          role,
          status
        `)
        .eq('user_id', user.id)

      if (error) {
          console.error('Error fetching chamas:', error)
          return
      }

      const activeChamas = members?.map((m: any) => ({
        ...m.chama,
        userRole: m.role,
        status: m.status
      })) || []

      setChamas(activeChamas)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Chamas</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your investment groups</p>
        </div>
        <Link 
            to="/create-chama"
            className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20"
        >
            <Plus className="w-4 h-4" />
            New Chama
        </Link>
      </div>

      {chamas.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No Chamas Found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                You haven't joined any chamas yet. Create a new one or ask to be invited.
            </p>
            <Link 
                to="/create-chama"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
                <Plus className="w-4 h-4" />
                Create First Chama
            </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chamas.map((chama) => (
                <motion.div
                    key={chama.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -5 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
                    onClick={() => navigate(`/chama/${chama.id}`)}
                >
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                                {chama.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                                chama.userRole === 'admin' 
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                                {chama.userRole}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-[#00C853] transition-colors">
                            {chama.name}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 mb-6 h-10">
                            {chama.description || 'No description provided.'}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                                <Users className="w-4 h-4" />
                                <span>{chama.total_members} Members</span>
                             </div>
                             <div className="flex items-center gap-1 text-[#00C853] font-medium text-sm">
                                Open 
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                             </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
      )}
    </div>
  )
}
