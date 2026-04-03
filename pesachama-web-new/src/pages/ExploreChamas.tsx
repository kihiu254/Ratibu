import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, Users, Loader2, CheckCircle2, Star } from 'lucide-react'
import { motion } from 'framer-motion'
import Button from '../components/Button'

interface ChamaSummary {
  id: string
  name: string
  description: string | null
  category: string | null
  total_members: number | null
  contribution_frequency?: string | null
  join_points?: number | null
  created_at: string
}

interface ChamaMemberRow {
  chama_id: string
}

export default function ExploreChamas() {
  const [chamas, setChamas] = useState<ChamaSummary[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const navigate = useNavigate()

  const categories = [
    'All', 'Bodabodas', 'House-helps', 'Sales-people', 'Grocery Owners', 
    'Waiters', 'Health Workers', 'Caretakers', 'Drivers', 
    'Fundis', 'Conductors', 'Others'
  ]

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch all public chamas
      const { data: allChamas, error: chamasError } = await supabase
        .from('chamas')
        .select('*')
        .order('created_at', { ascending: false })

      if (chamasError) throw chamasError

      // Fetch user's joined IDs
      const { data: members, error: membersError } = await supabase
        .from('chama_members')
        .select('chama_id')
        .eq('user_id', user.id)

      if (membersError) throw membersError
      
      setJoinedIds(new Set((members as ChamaMemberRow[] | null)?.map((member) => member.chama_id) || []))
      setChamas((allChamas || []) as ChamaSummary[])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(chamaId: string) {
    try {
      setJoiningId(chamaId)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login?redirectTo=/explore')
        return
      }

      const { error } = await supabase
        .from('chama_members')
        .insert({
          chama_id: chamaId,
          user_id: user.id,
          role: 'member',
          status: 'active'
        })

      if (error) throw error

      setJoinedIds(prev => new Set([...prev, chamaId]))
      
      // Update local chama member count (optimistic)
      setChamas(prev => prev.map(c => 
        c.id === chamaId ? { ...c, total_members: (c.total_members || 0) + 1 } : c
      ))

      // Notify about points
      const joinedChama = chamas.find(c => c.id === chamaId)
      if (joinedChama?.join_points) {
        alert(`Successfully joined ${joinedChama.name}! You've earned ${joinedChama.join_points} points.`)
      } else {
        alert(`Successfully joined ${joinedChama?.name || 'the group'}!`)
      }

    } catch (err) {
      console.error('Error joining chama:', err)
      alert('Failed to join group. Please try again.')
    } finally {
      setJoiningId(null)
    }
  }

  const filteredChamas = chamas.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Discover Chamas</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Find and join investment groups that match your goals</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text"
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00C853] transition-all"
          />
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
        <div className="flex items-center gap-3 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-2xl text-sm font-black transition-all duration-300 border-2 ${
                selectedCategory === cat
                  ? 'bg-[#00C853] border-[#00C853] text-white shadow-xl shadow-green-500/20 scale-105'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-[#00C853]/30 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="tracking-tight uppercase">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {filteredChamas.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Groups Found</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try a different search term or be the first to start a group!
          </p>
          <Button 
            variant="primary" 
            className="mt-8"
            onClick={() => navigate('/create-chama')}
          >
            Create New Chama
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredChamas.map((chama) => {
            const isJoined = joinedIds.has(chama.id)
            const isJoining = joiningId === chama.id

            return (
              <motion.div
                key={chama.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-2xl hover:shadow-[#00C853]/5 hover:border-[#00C853]/30 transition-all duration-500"
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00C853] to-[#00E676] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#00C853]/20 group-hover:scale-110 transition-transform duration-500">
                      {chama.name.substring(0, 2).toUpperCase()}
                    </div>
                    {chama.join_points && (
                      <div className="px-3 py-1 bg-[#00C853]/10 rounded-full border border-[#00C853]/20 flex items-center gap-1.5 animate-pulse">
                        <Star className="w-3.5 h-3.5 text-[#00C853] fill-[#00C853]" />
                        <span className="text-[10px] font-black text-[#00C853] uppercase letter-spacing-widest">
                          +{chama.join_points} Join Bonus
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-[#00C853] transition-colors line-clamp-1">
                    {chama.name}
                  </h3>
                  
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 line-clamp-3 leading-relaxed min-h-[4.5rem]">
                    {chama.description || "A group of forward-looking investors saving together for a brighter future. Join us today!"}
                  </p>

                  <div className="flex items-center gap-6 mb-8 py-4 border-y border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Members</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#00C853]" />
                        {chama.total_members || 0}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Frequency</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {chama.contribution_frequency || 'Weekly'}
                      </span>
                    </div>
                  </div>

                  {isJoined ? (
                    <Button 
                      variant="secondary" 
                      className="w-full flex items-center justify-center gap-2 cursor-default bg-slate-50 dark:bg-slate-800 text-slate-500 border-none"
                      disabled
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                      Member
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      className="w-full flex items-center justify-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoin(chama.id);
                      }}
                      loading={isJoining}
                    >
                      {isJoining ? 'Joining...' : 'Join Group'}
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
