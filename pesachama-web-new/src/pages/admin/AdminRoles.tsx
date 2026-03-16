import { useEffect, useState } from 'react'
import { 
  Shield, 
  Search, 
  Loader2, 
  UserPlus, 
  UserMinus, 
  ChevronRight,
  Target,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Building
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface SystemAdmin {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: string
  created_at: string
}

interface ChamaAdmin {
  user_id: string
  user_email: string
  user_first: string
  user_last: string
  chama_name: string
  role: string
  chama_id: string
}

export default function AdminRoles() {
  const [systemAdmins, setSystemAdmins] = useState<SystemAdmin[]>([])
  const [chamaAdmins, setChamaAdmins] = useState<ChamaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPromoteModal, setShowPromoteModal] = useState(false)
  const [usersToPromote, setUsersToPromote] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    fetchAdmins()
  }, [])

  async function fetchAdmins() {
    try {
      setLoading(true)
      
      // Fetch system admins
      const { data: systemData, error: systemError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, system_role, created_at')
        .in('system_role', ['admin', 'super_admin'])
        .order('system_role', { ascending: false })
      
      if (systemError) throw systemError
      setSystemAdmins(systemData || [])

      // Fetch chama admins (joined from chama_members and chamas and users)
      const { data: chamaData, error: chamaError } = await supabase
        .from('chama_members')
        .select(`
          user_id,
          role,
          chama_id,
          users:user_id (email, first_name, last_name),
          chamas:chama_id (name)
        `)
        .eq('role', 'admin')

      if (chamaError) throw chamaError

      const mappedChamaAdmins = (chamaData || []).map((item: any) => ({
        user_id: item.user_id,
        user_email: item.users?.email,
        user_first: item.users?.first_name,
        user_last: item.users?.last_name,
        chama_name: item.chamas?.name,
        role: item.role,
        chama_id: item.chama_id
      }))

      setChamaAdmins(mappedChamaAdmins)

    } catch (err) {
      console.error(err)
      toast.error('Failed to load admin roles')
    } finally {
      setLoading(false)
    }
  }

  async function searchUsers() {
    if (!userSearch) return
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, system_role')
        .or(`email.ilike.%${userSearch}%,first_name.ilike.%${userSearch}%,last_name.ilike.%${userSearch}%`)
        .eq('system_role', 'user')
        .limit(5)
      
      if (error) throw error
      setUsersToPromote(data || [])
    } catch {
      toast.error('Search failed')
    }
  }

  async function updateSystemRole(userId: string, role: string) {
    setUpdating(userId)
    try {
      const { error } = await supabase
        .from('users')
        .update({ system_role: role })
        .eq('id', userId)
      
      if (error) throw error
      toast.success(`User role updated to ${role}`)
      fetchAdmins()
      setShowPromoteModal(false)
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  const filteredSystem = systemAdmins.filter(u => 
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredChama = chamaAdmins.filter(u => 
    `${u.user_first} ${u.user_last} ${u.user_email} ${u.chama_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Roles Management</h1>
          <p className="text-slate-500">Manage platform administrators and monitor chama leadership.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-6 py-3 w-full md:w-64 outline-none focus:border-[#00C853] transition-all"
            />
          </div>
          <button 
            onClick={() => setShowPromoteModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-xl shadow-lg shadow-green-500/20 transition-all"
          >
            <UserPlus className="w-5 h-5" />
            Add Admin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* System Admins Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">System Administrators</h2>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSystem.map((user) => (
                <div key={user.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      user.system_role === 'super_admin' ? 'bg-[#00C853] text-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {user.system_role}
                    </span>
                    {user.system_role !== 'super_admin' && (
                      <button 
                        onClick={() => updateSystemRole(user.id, 'user')}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Demote to User"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredSystem.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  No system admins found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chama Admins Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00C853]" />
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Chama Administrators</h2>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredChama.map((item, i) => (
                <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{item.user_first} {item.user_last}</p>
                      <p className="text-xs text-[#00C853] font-bold flex items-center gap-1">
                        <Target className="w-3 h-3" /> {item.chama_name}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.user_email}</p>
                    </div>
                  </div>
                  <div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500">
                      CHAMA ADMIN
                    </span>
                  </div>
                </div>
              ))}
              {filteredChama.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  No chama admins identified.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Promote Admin Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Add System Admin</h2>
                <button onClick={() => setShowPromoteModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <UserPlus className="w-6 h-6 text-slate-400 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search users by email or name..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-[#00C853] rounded-2xl pl-12 pr-4 py-4 outline-none transition-all"
                  />
                  <button 
                    onClick={searchUsers}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#00C853] text-white text-xs font-bold rounded-lg"
                  >
                    Search
                  </button>
                </div>

                <div className="space-y-2">
                  {usersToPromote.map(user => (
                    <div key={user.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => updateSystemRole(user.id, 'admin')}
                        disabled={!!updating}
                        className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-black rounded-xl hover:gap-3 transition-all flex items-center gap-2"
                      >
                        {updating === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Promote'}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
