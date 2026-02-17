import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  CreditCard,
  Settings,
  LogOut, 
  Menu, 
  User,
  ShieldAlert,
  ChevronRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RatibuLogo } from '../components/RatibuLogo'
import { motion, AnimatePresence } from 'framer-motion'

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState<any>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
       navigate('/login')
       return
    }
    
    // Double check admin status
    const { data: profile } = await supabase
      .from('users')
      .select('system_role')
      .eq('id', user.id)
      .single()

    if (profile?.system_role !== 'admin' && profile?.system_role !== 'super_admin') {
      navigate('/dashboard')
      return
    }
    
    setUser(user)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const menuItems = [
    { name: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { name: 'Users', icon: Users, path: '/admin/users' },
    { name: 'Chamas', icon: Target, path: '/admin/chamas' },
    { name: 'Transactions', icon: CreditCard, path: '/admin/transactions' },
    { name: 'Settings', icon: Settings, path: '/admin/settings' },
  ]

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-[#00C853]/30">
      
      {/* Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-20 hidden md:flex`}
      >
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <Link to="/admin" className="flex items-center gap-3 overflow-hidden">
             <div className="w-8 h-8 rounded-lg bg-[#00C853] flex items-center justify-center text-black font-black">
                A
             </div>
             {sidebarOpen && (
               <div>
                  <h1 className="font-black text-white leading-none">ADMIN</h1>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Portal</span>
               </div>
             )}
          </Link>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-lg shadow-black/20' 
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                
                {!sidebarOpen && (
                  <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
             <div className="flex items-center gap-3 px-2 py-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-[#00C853]" />
                {sidebarOpen && <span className="text-xs text-[#00C853] font-bold uppercase tracking-widest">Super Admin</span>}
             </div>
             {sidebarOpen && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full mb-2 flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:bg-white/5 rounded-lg transition-colors border border-dashed border-slate-700 hover:border-slate-500"
              >
                Exit to User App
              </button>
             )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-black">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors hidden md:block"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumbs */}
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
               <span className="hover:text-slate-900 dark:hover:text-white cursor-pointer" onClick={() => navigate('/admin')}>Admin</span>
               <ChevronRight className="w-4 h-4" />
               <span className="font-bold text-slate-900 dark:text-white capitalize">
                 {location.pathname.split('/').pop() || 'Overview'}
               </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                 {user?.email?.[0].toUpperCase()}
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
