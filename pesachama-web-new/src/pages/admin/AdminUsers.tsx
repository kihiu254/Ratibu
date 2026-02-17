import { useState, useEffect } from 'react'
import { 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  User,
  Loader2,
  XCircle,
  Mail
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  system_role: string;
  created_at: string;
  avatar_url?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      // Optimistically define user deletion. 
      // Note: In Supabase, deleting from public.users requires `ON DELETE CASCADE` from auth.users OR explicit policy.
      // Since we added a policy for public.users, this deletes the profile.
      // However, the auth user remains unless we use Admin API (Edge Function).
      // For now, removing the profile effectively renders them "gone" from the app perspective, but they might still exist in Auth.
      // A complete solution requires an Edge Function to delete from Auth.
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('User profile deleted successfully')
      setUsers(users.filter(u => u.id !== id))
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user profile')
    }
  }

  const filteredUsers = users.filter(user => 
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Directory</h1>
          <p className="text-slate-500">Manage all registered users in the network.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by name, email..." 
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
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user.first_name?.[0] || <User className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                      user.system_role === 'admin' || user.system_role === 'super_admin' 
                        ? 'bg-[#00C853]/10 text-[#00C853]' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {user.system_role || 'user'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button className="p-2 text-slate-400 hover:text-[#00C853] hover:bg-[#00C853]/10 rounded-lg transition-all" title="View Profile">
                         <Eye className="w-4 h-4" />
                       </button>
                       
                       {deleteConfirm === user.id ? (
                         <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-lg">
                           <button 
                             onClick={() => handleDelete(user.id)}
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
                           onClick={() => setDeleteConfirm(user.id)}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                           title="Delete User"
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
        
        {filteredUsers.length === 0 && (
           <div className="p-12 text-center text-slate-500">
              <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No users found matching your search.</p>
           </div>
        )}
      </div>
    </div>
  )
}
