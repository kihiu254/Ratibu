import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  Trophy, 
  Star, 
  TrendingUp, 
  Users, 
  Award, 
  Loader2, 
  Share2,
  Copy,
  CheckCircle2
} from 'lucide-react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import ReferralList from '../components/ReferralList'

export default function Rewards() {
  const [stats, setStats] = useState<any>(null)
  const [badges, setBadges] = useState<any[]>([])
  const [userBadges, setUserBadges] = useState<Set<string>>(new Set())
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [referralCode, setReferralCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user stats
      const { data: userStats } = await supabase
        .from('gamification_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      setStats(userStats)

      // Fetch referral code from users table
      const { data: userData } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single()
      
      setReferralCode(userData?.referral_code || '')

      // Fetch all badges
      const { data: allBadges } = await supabase
        .from('badges')
        .select('*')
      
      setBadges(allBadges || [])

      // Fetch user's earned badges
      const { data: earnedBadges } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user.id)
      
      setUserBadges(new Set(earnedBadges?.map(b => b.badge_id) || []))

      // Fetch leaderboard (Top 5)
      const { data: topUsers } = await supabase
        .from('gamification_stats')
        .select(`
          points,
          user:users (first_name, last_name, avatar_url)
        `)
        .order('points', { ascending: false })
        .limit(5)
      
      setLeaderboard(topUsers || [])

    } catch (err) {
      console.error('Error fetching rewards data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-[#00C853]" />
      </div>
    )
  }

  const levelProgress = ((stats?.points % 1000) / 1000) * 100

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[#00C853] to-[#009624] text-white relative overflow-hidden shadow-2xl shadow-green-500/20"
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h1 className="text-4xl font-black tracking-tight mb-2">Level {stats?.level || 1} Saver</h1>
                  <p className="text-white/80 font-medium">Keep contributing to reach Silver status!</p>
                </div>
                <div className="bg-white/20 backdrop-blur-xl p-4 rounded-3xl">
                  <Trophy className="w-8 h-8 text-yellow-300" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-5xl font-black">{stats?.points?.toLocaleString() || 0} <span className="text-xl font-bold opacity-70">pts</span></span>
                  <span className="text-sm font-bold opacity-80">{1000 - (stats?.points % 1000)} pts to Level {stats?.level + 1}</span>
                </div>
                <div className="h-4 bg-black/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${levelProgress}%` }}
                    className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                  />
                </div>
              </div>
            </div>
            
            {/* Background elements */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          </motion.div>

          {/* Referral Card */}
          <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative group">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Refer & Earn KES 500</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">Share your code with friends and earn rewards when they join and make their first contribution.</p>
                
                {/* Social Sharing Icons */}
                <div className="flex items-center gap-4 mt-6 justify-center md:justify-start">
                    <button 
                        onClick={() => window.open(`https://wa.me/?text=Join%20me%20on%20Ratibu!%20Use%20my%20code%20${referralCode}%20at%20${window.location.origin}/ref/${referralCode}`, '_blank')}
                        className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white hover:scale-110 transition-transform"
                    >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </button>
                    <button 
                        onClick={() => window.open(`https://twitter.com/intent/tweet?text=Join%20me%20on%20Ratibu!%20The%20best%20way%20to%20save%20together.%20Use%20code%20${referralCode}%20at%20${window.location.origin}/ref/${referralCode}`, '_blank')}
                        className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white hover:scale-110 transition-transform"
                    >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </button>
                    <button 
                        onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${window.location.origin}/ref/${referralCode}`, '_blank')}
                        className="w-10 h-10 rounded-full bg-[#0077b5] flex items-center justify-center text-white hover:scale-110 transition-transform"
                    >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 w-full md:w-64">
                    <span className="flex-1 text-center font-black text-[#00C853] tracking-widest">{referralCode}</span>
                    <button 
                        onClick={handleCopy}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:scale-105 transition-transform"
                    >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-[#00C853]" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>
                <Button 
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/ref/${referralCode}`;
                    if (navigator.share) {
                        navigator.share({
                            title: 'Join me on Ratibu',
                            text: 'The ultimate digital banking platform for Chamas.',
                            url: shareUrl
                        });
                    } else {
                        handleCopy();
                    }
                  }}
                  variant="outline" 
                  className="w-full flex items-center gap-2"
                >
                    <Share2 className="w-4 h-4" /> Share Link
                </Button>
              </div>
            </div>
            <div className="absolute right-0 bottom-0 opacity-5 -rotate-12 translate-x-4 translate-y-4">
                <Users className="w-48 h-48" />
            </div>
          </div>

          {/* Referral Tracking List */}
          <div className="lg:col-span-2">
            <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <ReferralList />
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Top Savers</h3>
            <span className="text-[10px] font-black text-[#00C853] px-2 py-1 bg-[#00C853]/10 rounded-lg">LIVE</span>
          </div>

          <div className="flex-grow space-y-6">
            {leaderboard.map((item, index) => (
              <div key={index} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' : 
                    index === 1 ? 'bg-slate-300 text-slate-700' :
                    index === 2 ? 'bg-orange-300 text-orange-900' : 'text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent group-hover:border-[#00C853] transition-all">
                    {item.user?.avatar_url ? (
                        <img src={item.user.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-400">
                            <User className="w-5 h-5" />
                        </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.user?.first_name} {item.user?.last_name?.substring(0, 1)}.</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.points.toLocaleString()} PTS</p>
                  </div>
                </div>
                {index === 0 && <Award className="w-5 h-5 text-yellow-400" />}
              </div>
            ))}
          </div>

          <Button variant="secondary" className="w-full mt-8 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
            View Full List
          </Button>
        </div>
      </div>

      {/* Badges Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Unlocked Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {badges.map((badge) => {
                const isEarned = userBadges.has(badge.id)
                const Icon = badge.icon_type === 'trophy' ? Trophy : 
                             badge.icon_type === 'star' ? Star : 
                             badge.icon_type === 'trending-up' ? TrendingUp : 
                             badge.icon_type === 'users' ? Users : Award

                return (
                    <motion.div 
                        key={badge.id}
                        whileHover={isEarned ? { y: -5, scale: 1.05 } : {}}
                        className={`p-6 rounded-3xl border text-center space-y-4 transition-all duration-500 ${
                            isEarned 
                                ? 'bg-white dark:bg-slate-900 border-[#00C853]/30 shadow-xl shadow-[#00C853]/5' 
                                : 'bg-slate-50/50 dark:bg-slate-900/30 border-transparent grayscale opacity-40'
                        }`}
                    >
                        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg transition-all duration-700 ${
                            isEarned 
                                ? 'bg-gradient-to-br from-[#00C853] to-[#00E676] text-white rotate-0' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 rotate-12'
                        }`}>
                            <Icon className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{badge.name}</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-1">{badge.description}</p>
                        </div>
                    </motion.div>
                )
            })}
        </div>
      </div>
    </div>
  )
}

function User(props: any) {
    return (
        <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
        >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        </svg>
    )
}
