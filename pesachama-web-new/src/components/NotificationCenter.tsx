import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  created_at: string
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
      (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          
          // Play notification sound
          try {
            // Simple 'pop' sound base64
            const audioData = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + 'A'.repeat(100)
            // Ideally use a real file, but for now lets try a simple beep concept or rely on a standard URL if internet is available.
            // Using a hosted sound file is better.
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
            audio.play().catch(e => console.log('Audio play blocked:', e))
          } catch (e) {
            console.error('Error playing sound:', e)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (error) throw error
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  async function markAllAsRead() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      default: return <Info className="w-5 h-5 text-[#00C853]" />
    }
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border border-white dark:border-slate-900 font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 outline-none" 
              onClick={() => setOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-bold text-[#00C853] hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-1">No new notifications.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        className={`p-4 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative ${!n.is_read && 'bg-[#00C853]/5'}`}
                      >
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {n.message}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full bg-[#00C853] absolute right-4 top-5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center">
                <button className="text-xs font-bold text-slate-500 hover:text-[#00C853] transition-colors">
                  View All Activity
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
