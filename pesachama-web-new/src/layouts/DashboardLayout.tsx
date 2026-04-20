import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  LayoutDashboard,
  Users,
  Compass,
  LogOut,
  Menu,
  User,
  Loader2,
  Trophy,
  PiggyBank,
  Wallet,
  Calendar,
  Gavel,
  Plus,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  BadgeDollarSign,
  Package,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RatibuLogo, RatibuLogoDark } from '../components/RatibuLogo'
import { RatibuInsignia } from '../components/RatibuInsignia'
import NotificationCenter from '../components/NotificationCenter'
import { motion, AnimatePresence } from 'framer-motion'

type MenuItem = {
  name: string
  icon: React.ElementType
  path: string
}

type MenuGroup = {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'My Wallet', icon: Wallet, path: '/wallet' },
      { name: 'Accounts', icon: Wallet, path: '/accounts' },
    ],
  },
  {
    label: 'Chamas',
    items: [
      { name: 'My Chamas', icon: Users, path: '/chamas' },
      { name: 'Discover', icon: Compass, path: '/explore' },
      { name: 'Create Chama', icon: Plus, path: '/create-chama' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Personal Savings', icon: PiggyBank, path: '/personal-savings' },
      { name: 'Products', icon: Package, path: '/products' },
      { name: 'KCB M-PESA', icon: BadgeDollarSign, path: '/kcb-mpesa' },
      { name: 'KPLC Bills', icon: Wallet, path: '/kplc-bill' },
          { name: 'Rewards', icon: Trophy, path: '/rewards' },
          { name: 'Penalties', icon: Gavel, path: '/penalties' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { name: 'Meetings', icon: Calendar, path: '/meetings' },
      { name: 'Swaps', icon: ArrowLeftRight, path: '/swaps' },
      { name: 'Profile', icon: User, path: '/profile' },
    ],
  },
]

// Flat list for mobile bottom nav and active detection
const allItems = menuGroups.flatMap(g => g.items)

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [user, setUser] = useState<(SupabaseUser & { avatar_url?: string | null; first_name?: string; last_name?: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  const getProfile = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
      setUser(data || user)

      const kycStatus = data?.kyc_status ?? 'not_started'
      const onboardingRoutes = ['/onboarding', '/verify-otp', '/membership-kyc']

      if (['pending', 'approved'].includes(kycStatus)) {
        if (onboardingRoutes.includes(location.pathname)) navigate('/dashboard')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      console.error('Error loading user data!', error)
    } finally {
      setLoading(false)
    }
  }, [location.pathname, navigate])

  useEffect(() => { void getProfile() }, [getProfile])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const onboardingRoutes = ['/onboarding', '/verify-otp', '/membership-kyc']
  const isOnboarding = onboardingRoutes.includes(location.pathname)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  const NavLink = ({ item, onClick, compact = false }: { item: MenuItem; onClick?: () => void; compact?: boolean }) => {
    const isActive = location.pathname === item.path ||
      (item.path !== '/dashboard' && location.pathname.startsWith(item.path))
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
          isActive
            ? 'bg-[#00C853] text-white shadow-lg shadow-green-500/20'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        {!compact && <span className="font-medium text-sm whitespace-nowrap">{item.name}</span>}
        {compact && (
          <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
            {item.name}
          </div>
        )}
      </Link>
    )
  }

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-[#00C853]/30 ${isOnboarding ? 'overflow-auto' : ''}`}>
      {!isOnboarding && (
        <>
          <div className="fixed top-4 left-4 z-30 md:hidden">
            <button onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              title="Open navigation menu"
              className="w-10 h-10 rounded-xl bg-[#00C853] flex items-center justify-center text-white shadow-lg">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          <div className="fixed top-4 right-4 z-30">
            <NotificationCenter />
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      {!isOnboarding && (
        <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-20 hidden md:flex`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Link to="/" className="flex items-center gap-2 overflow-hidden">
              {sidebarOpen ? (
                <><RatibuLogo className="h-10 w-auto" /><RatibuLogoDark className="h-10 w-auto" /></>
              ) : (
                <div className="w-full flex justify-center">
                  <RatibuInsignia className="h-7 w-7 text-slate-900 dark:text-white" />
                </div>
              )}
            </Link>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors flex-shrink-0">
              <Menu className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
            {sidebarOpen ? (
              menuGroups.map(group => {
                const collapsed = collapsedGroups[group.label]
                return (
                  <div key={group.label} className="mb-2">
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {group.label}
                      {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {!collapsed && (
                      <div className="space-y-0.5 mt-1">
                        {group.items.map(item => <NavLink key={item.path} item={item} />)}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="space-y-1">
                {allItems.map(item => <NavLink key={item.path} item={item} compact />)}
              </div>
            )}
          </nav>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <Link to="/profile"
              className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-all`}>
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                {user?.avatar_url
                  ? (
                    <img
                      src={user.avatar_url}
                      alt={`${user.first_name || 'User'} ${user.last_name || ''} profile`.trim()}
                      className="w-full h-full object-cover"
                    />
                  )
                  : <User className="w-4 h-4" />}
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
              <button onClick={handleSignOut}
                className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className={`flex-1 overflow-y-auto scroll-smooth ${isOnboarding ? 'p-0' : 'p-4 md:p-8 pb-24 md:pb-8'}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {!isOnboarding && mobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-40 md:hidden flex flex-col border-r border-slate-200 dark:border-slate-800"
            >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                <RatibuLogo className="h-10 w-auto" />
                <RatibuLogoDark className="h-10 w-auto" />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  title="Close navigation menu"
                  className="p-2 text-slate-500"
                >
                  <Menu className="w-5 h-5 rotate-90" />
                </button>
              </div>
              <nav className="flex-1 py-4 px-4 overflow-y-auto space-y-4">
                {menuGroups.map(group => (
                  <div key={group.label}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">{group.label}</p>
                    <div className="space-y-0.5">
                      {group.items.map(item => (
                        <NavLink key={item.path} item={item} onClick={() => setMobileMenuOpen(false)} />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <button onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl font-bold transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav — shows 4 most important items */}
      {!isOnboarding && (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-20 md:hidden">
          {[
            { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Chamas', icon: Users, path: '/chamas' },
            { name: 'Accounts', icon: Wallet, path: '/accounts' },
            { name: 'Profile', icon: User, path: '/profile' },
          ].map(item => {
            const isActive = location.pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#00C853]' : 'text-slate-500'}`}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileMenuOpen(true)}
            aria-label="Open more navigation options"
            title="Open more navigation options"
            className="flex flex-col items-center gap-1 text-slate-500">
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-bold">More</span>
          </button>
        </nav>
      )}
    </div>
  )
}
