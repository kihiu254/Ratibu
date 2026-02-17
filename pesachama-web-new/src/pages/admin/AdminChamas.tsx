import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  Target,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

interface Chama {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  balance: number;
  created_at: string;
  is_verified?: boolean;
  status: 'active' | 'suspended' | 'pending';
  // Add other fields as necessary
}

export default function AdminChamas() {
  const [chamas, setChamas] = useState<Chama[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchChamas()
  }, [])

  async function fetchChamas() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('chamas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setChamas(data || [])
    } catch (error) {
      console.error('Error fetching chamas:', error)
      toast.error('Failed to load chamas')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('chamas')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Chama deleted successfully')
      setChamas(chamas.filter(c => c.id !== id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting chama:', error)
      toast.error('Failed to delete chama. It may have related records.')
    }
  }

  const filteredChamas = chamas.filter(chama => 
    chama.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chama.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Chamas</h1>
          <p className="text-slate-500">Manage all registered chamas in the network.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search chamas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-6 py-3 w-full md:w-64 outline-none focus:border-[#00C853] transition-all"
            />
          </div>
          <button className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <Filter className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredChamas.map((chama) => (
                <tr key={chama.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853] font-bold">
                        {chama.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{chama.name}</p>
                        <p className="text-xs text-slate-500">ID: {chama.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      {chama.category || 'Standard'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                    KES {chama.balance?.toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                     {chama.status === 'active' ? (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wide">
                         <CheckCircle className="w-3 h-3" /> Active
                       </span>
                     ) : (
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-500 text-xs font-bold uppercase tracking-wide">
                         {chama.status || 'Unknown'}
                       </span>
                     )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => navigate(`/admin/chamas/${chama.id}`)}
                         className="p-2 text-slate-400 hover:text-[#00C853] hover:bg-[#00C853]/10 rounded-lg transition-all"
                         title="View Details"
                       >
                         <Eye className="w-4 h-4" />
                       </button>
                       
                       {deleteConfirm === chama.id ? (
                         <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-lg">
                           <button 
                             onClick={() => handleDelete(chama.id)}
                             className="text-xs font-bold text-red-500 px-2 hover:underline"
                           >
                             Confirm
                           </button>
                           <button 
                             onClick={() => setDeleteConfirm(null)}
                             className="p-1 text-slate-400 hover:text-slate-600"
                           >
                             <XCircle className="w-4 h-4" />
                           </button>
                         </div>
                       ) : (
                         <button 
                           onClick={() => setDeleteConfirm(chama.id)}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                           title="Delete Chama"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredChamas.length === 0 && (
           <div className="p-12 text-center text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No chamas found matching your search.</p>
           </div>
        )}
      </div>
    </div>
  )
}
