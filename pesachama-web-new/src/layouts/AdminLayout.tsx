import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileCheck,
  CreditCard,
  Settings,
  Menu,
  ShieldAlert,
  Activity,
  MessageSquareText,
  BarChart2,
  ShieldCheck,
  Target,
  LogOut,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { RatibuInsignia } from '../components/RatibuInsignia'
import { motion, AnimatePresence } from 'framer-motion'

type MenuItem = { name: string; icon: React.ElementType; path: string }
type MenuGroup = { label: string; items: MenuItem[] }
type AdminUserProfile = {
  system_role?: string
  first_name?: string
  last_name?: string
  email?: string
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
      { name: 'Analytics', icon: BarChart2, path: '/admin/analytics' },
    ],
  },
  {
    label: 'Members',
    items: [
      { name: 'Users', icon: Users, path: '/admin/users' },
      { name: 'KYC Documents', icon: FileCheck, path: '/admin/kyc-documents' },
      { name: 'Roles', icon: ShieldCheck, path: '/admin/roles' },
    ],
  },
  {
    label: 'Chamas',
    items: [
      { name: 'All Chamas', icon: Target, path: '/admin/chamas' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Transactions', icon: CreditCard, path: '/admin/transactions' },
      { name: 'Activities', icon: Activity, path: '/admin/activities' },
      { name: 'USSD', icon: MessageSquareText, path: '/admin/ussd' },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', icon: Settings, path: '/admin/settings' },
    ],
  },
]

const allItems = menuGroups.flatMap(g => g.items)

function pathLabel(pathname: string) {
  const found = allItems.find(i => i.path === pathname)
  if (found) return found.name
  if (pathname.startsWith('/admin/chamas/')) return 'Chama Details'
  return pathname.split('/').pop()?.replace(/-/g, ' ') ?? 'Overview'
}

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [user, setUser] = useState<AdminUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  const checkAdmin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('system_role, first_name, last_name, email')
        .eq('id', user.id)
        .single()

      if (profile?.system_role !== 'admin' && profile?.system_role !== 'super_admin') {
        navigate('/dashboard')
        return
      }
      setUser(profile || user)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { void checkAdmin() }, [checkAdmin])

  const toggleGroup = (label: string) =>
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))

  const isActive = (path: string) =>
    path === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(path)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  const NavLink = ({ item, onClick, compact = false }: {
    item: MenuItem; onClick?: () => void; compact?: boolean
  }) => {
    const active = isActive(item.path)
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative ${
          active
            ? 'bg-[#00C853]/15 text-[#00C853] border border-[#00C853]/20'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        {!compact && <span className="text-sm font-medium whitespace-nowrap">{item.name}</span>}
        {compact && (
          <div className="absolute left-14 bg-slate-800 border border-slate-700 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
            {item.name}
          </div>
        )}
      </Link>
    )
  }

  const SidebarContent = ({ compact = false, onNav }: { compact?: boolean; onNav?: () => void }) => (
    <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
      {compact ? (
        <div className="space-y-1">
          {allItems.map(item => <NavLink key={item.path} item={item} compact onClick={onNav} />)}
        </div>
      ) : (
        menuGroups.map(group => {
          const isCollapsed = collapsed[group.label]
          return (
            <div key={group.label} className="mb-3">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
              >
                {group.label}
                {isCollapsed
                  ? <ChevronRight className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mt-1">
                  {group.items.map(item => <NavLink key={item.path} item={item} onClick={onNav} />)}
                </div>
              )}
            </div>
          )
        })
      )}
    </nav>
  )

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 selection:bg-[#00C853]/30">

      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-20 hidden md:flex flex-shrink-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-slate-800 flex-shrink-0">
          <Link to="/admin" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#00C853] flex items-center justify-center flex-shrink-0">
              <RatibuInsignia className="h-5 w-5 text-black" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="font-black text-white text-sm leading-none">RATIBU</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest">Admin Portal</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
            title={sidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-colors flex-shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <SidebarContent compact={!sidebarOpen} />

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 flex-shrink-0 space-y-1">
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-2 py-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-[#00C853] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#00C853] truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                  {user?.system_role?.replace('_', ' ')}
                </p>
              </div>
            </div>
          )}
          <Link
            to="/dashboard"
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <ArrowLeft className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Exit to App</span>}
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open admin navigation menu"
              title="Open admin navigation menu"
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link to="/admin" className="hover:text-slate-300 transition-colors font-medium">Admin</Link>
              {location.pathname !== '/admin' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-bold text-slate-200 capitalize">
                    {pathLabel(location.pathname)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#00C853]/10 rounded-xl border border-[#00C853]/20">
              <ShieldAlert className="w-3.5 h-3.5 text-[#00C853]" />
              <span className="text-xs font-bold text-[#00C853] uppercase tracking-wider">
                {user?.system_role?.replace('_', ' ')}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#00C853]/20 border border-[#00C853]/30 flex items-center justify-center font-black text-sm text-[#00C853]">
              {(user?.first_name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-slate-900 z-40 md:hidden flex flex-col border-r border-slate-800"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#00C853] flex items-center justify-center">
                    <RatibuInsignia className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="font-black text-white text-sm leading-none">RATIBU</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Admin Portal</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close admin navigation menu"
                  title="Close admin navigation menu"
                  className="p-2 text-slate-400"
                >
                  <Menu className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <SidebarContent onNav={() => setMobileOpen(false)} />

              <div className="p-4 border-t border-slate-800 space-y-2">
                <Link to="/dashboard" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors text-sm">
                  <ArrowLeft className="w-4 h-4" /> Exit to App
                </Link>
                <button
                  onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
