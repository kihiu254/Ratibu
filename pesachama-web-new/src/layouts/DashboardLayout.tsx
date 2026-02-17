import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Activity, 
  LogOut, 
  Menu, 
  User,
  Loader2,
  Trophy
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RatibuLogo } from '../components/RatibuLogo'
import { RatibuInsignia } from '../components/RatibuInsignia'
import NotificationCenter from '../components/NotificationCenter'
import { motion, AnimatePresence } from 'framer-motion'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
         navigate('/login')
         return
      }
      
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setUser(data || user)
    } catch (error) {
      console.error('Error loading user data!', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const menuItems = [
    { name: 'Home', icon: LayoutDashboard, path: '/' },
    { name: 'Dashboard Overview', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'My Chamas', icon: Users, path: '/chamas' },
    { name: 'Discover', icon: Users, path: '/explore' },
    { name: 'Rewards', icon: Trophy, path: '/rewards' },
    { name: 'Activity', icon: Activity, path: '/activity' },
    { name: 'Profile', icon: User, path: '/profile' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-[#00C853]/30">
      
      {/* Sidebar */}
      <aside 
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-20 hidden md:flex`}
      >
        <div className="h-20 flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            {sidebarOpen ? (
              <RatibuLogo className="h-8 w-auto text-slate-900 dark:text-white" />
            ) : (
              <div className="w-full flex justify-center">
                <RatibuInsignia className="h-8 w-8 text-slate-900 dark:text-white" />
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
                    ? 'bg-[#00C853] text-white shadow-lg shadow-green-500/20' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
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

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <Link 
             to="/profile" 
             className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-all`}
           >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'User'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              )}
           </Link>
           {sidebarOpen && (
             <button 
               onClick={handleSignOut}
               className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
             >
               <LogOut className="w-4 h-4" />
               Sign Out
             </button>
           )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors hidden md:block"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2 md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="w-8 h-8 rounded-lg bg-[#00C853] flex items-center justify-center text-white font-bold"
              >
                R
              </button>
          </div>

          <div className="flex items-center gap-4">
             <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-40 md:hidden flex flex-col border-r border-slate-200 dark:border-slate-800"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                <RatibuLogo className="h-8 w-auto" />
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-slate-500">
                  <Menu className="w-6 h-6 rotate-90" />
                </button>
              </div>
              <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive 
                          ? 'bg-[#00C853] text-white shadow-lg shadow-green-500/20' 
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-bold">{item.name}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl font-bold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-20 md:hidden">
        {menuItems.filter(item => ['Home', 'My Chamas', 'Profile'].includes(item.name)).map(item => {
          const isActive = location.pathname === item.path
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#00C853]' : 'text-slate-500'}`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold">{item.name}</span>
            </Link>
          )
        })}
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 text-slate-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-bold">More</span>
        </button>
      </nav>

    </div>
  )
}
