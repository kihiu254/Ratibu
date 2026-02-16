import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, CheckCircle2, Clock, User } from 'lucide-react'

export default function ReferralList() {
  const [referrals, setReferrals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReferrals()
  }, [])

  async function fetchReferrals() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('referrals')
        .select(`
          id,
          status,
          created_at,
          referred:users!referrals_referred_id_fkey (
            first_name,
            last_name,
            avatar_url,
            email
          )
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setReferrals(data || [])
    } catch (err) {
      console.error('Error fetching referrals:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      ))}
    </div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Your Referrals</h3>
        <span className="text-xs font-bold text-[#00C853] bg-[#00C853]/10 px-3 py-1 rounded-full">
          {referrals.filter(r => r.status === 'completed').length} Earned
        </span>
      </div>

      {referrals.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No referrals yet. Start sharing to earn!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {referrals.map((ref) => (
            <div 
              key={ref.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl group hover:border-[#00C853]/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-transparent group-hover:border-[#00C853] transition-all">
                  {ref.referred?.avatar_url ? (
                    <img src={ref.referred.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {ref.referred?.first_name} {ref.referred?.last_name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                ref.status === 'completed' 
                  ? 'bg-green-500/10 text-green-500' 
                  : 'bg-amber-500/10 text-amber-500'
              }`}>
                {ref.status === 'completed' ? (
                  <><CheckCircle2 className="w-3 h-3" /> Completed</>
                ) : (
                  <><Clock className="w-3 h-3" /> Pending</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
