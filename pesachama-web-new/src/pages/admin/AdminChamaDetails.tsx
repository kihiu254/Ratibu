import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Users, 
  Target, 
  Calendar, 
  Trash2,
  Loader2,
  XCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface ChamaDetails {
  id: string;
  name: string;
  description: string;
  category: string;
  balance: number;
  created_at: string;
  status: string;
  member_count?: number;
}

interface ChamaMember {
  user_id: string;
  role: string;
  joined_at: string;
  users: {
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string;
  }
}

export default function AdminChamaDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [chama, setChama] = useState<ChamaDetails | null>(null)
  const [members, setMembers] = useState<ChamaMember[]>([])
  const [loading, setLoading] = useState(true)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchChamaDetails()
  }, [id])

  async function fetchChamaDetails() {
    try {
      setLoading(true)
      
      // Fetch Chama
      const { data: chamaData, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .eq('id', id)
        .single()

      if (chamaError) throw chamaError
      setChama(chamaData)

      // Fetch Members
      const { data: membersData, error: membersError } = await supabase
        .from('chama_members')
        .select('*, users(first_name, last_name, email, avatar_url)')
        .eq('chama_id', id)

      if (membersError) throw membersError
      setMembers(membersData || [])

    } catch (error) {
      console.error('Error fetching details:', error)
      toast.error('Failed to load chama details')
      navigate('/admin/chamas')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const { error } = await supabase
        .from('chama_members')
        .delete()
        .eq('chama_id', id)
        .eq('user_id', userId)

      if (error) throw error

      toast.success('Member removed successfully')
      setMembers(members.filter(m => m.user_id !== userId))
      setRemoveMemberId(null)
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  if (!chama) return null

  return (
    <div className="space-y-8">
      {/* Header / Back */}
      <div>
        <button 
          onClick={() => navigate('/admin/chamas')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Chamas
        </button>
        <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{chama.name}</h1>
             <div className="flex items-center gap-4 text-sm text-slate-500">
               <span className="flex items-center gap-1"><Target className="w-4 h-4" /> {chama.category}</span>
               <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Created {new Date(chama.created_at).toLocaleDateString()}</span>
               <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${chama.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-500'}`}>
                 {chama.status}
               </span>
             </div>
           </div>
           
           <div className="text-right">
              <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Total Balance</p>
              <p className="text-3xl font-black font-mono text-[#00C853]">KES {chama.balance?.toLocaleString()}</p>
           </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
             <Users className="w-5 h-5" /> Members ({members.length})
           </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
           <ul className="divide-y divide-slate-100 dark:divide-slate-800">
             {members.map((member) => (
               <li key={member.user_id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                       {member.users.avatar_url ? (
                         <img src={member.users.avatar_url} alt="" className="w-full h-full object-cover" />
                       ) : (
                         member.users.first_name[0]
                       )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {member.users.first_name} {member.users.last_name}
                        {member.role === 'admin' && <span className="ml-2 text-xs text-[#00C853] bg-[#00C853]/10 px-2 py-0.5 rounded-full">Admin</span>}
                      </p>
                      <p className="text-xs text-slate-500">{member.users.email}</p>
                    </div>
                 </div>

                 <div>
                   {removeMemberId === member.user_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-500 font-bold">Remove?</span>
                        <button 
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={() => setRemoveMemberId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                   ) : (
                      <button 
                        onClick={() => setRemoveMemberId(member.user_id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all flex items-center gap-2 group"
                      >
                         <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Remove</span>
                         <Trash2 className="w-4 h-4" />
                      </button>
                   )}
                 </div>
               </li>
             ))}
           </ul>
           {members.length === 0 && (
             <div className="p-8 text-center text-slate-500">
               No members found in this chama.
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
