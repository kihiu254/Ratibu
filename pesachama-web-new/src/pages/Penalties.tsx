import { useEffect, useState } from 'react'
import { Gavel } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

interface Penalty {
  id: string
  amount: number
  reason: string
  status: string
  created_at: string
  chamas: { name: string } | null
}

interface PenaltyRow {
  id: string
  amount: number
  reason: string
  status: string
  created_at: string
  chamas: Array<{ name: string }> | { name: string } | null
}

function normalizePenalty(row: PenaltyRow): Penalty {
  const chama = Array.isArray(row.chamas) ? row.chamas[0] ?? null : row.chamas

  return {
    id: row.id,
    amount: Number(row.amount),
    reason: row.reason,
    status: row.status,
    created_at: row.created_at,
    chamas: chama ? { name: chama.name } : null,
  }
}

export default function Penalties() {
  const [penalties, setPenalties] = useState<Penalty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('penalties')
        .select('id, amount, reason, status, created_at, chamas(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setPenalties(((data || []) as PenaltyRow[]).map(normalizePenalty))
    } finally {
      setLoading(false)
    }
  }

  const total = penalties
    .filter((penalty) => penalty.status === 'unpaid')
    .reduce((sum, penalty) => sum + Number(penalty.amount), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Penalties</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Outstanding and resolved penalties across your chamas.</p>
      </div>

      {total > 0 && (
        <div className="p-5 bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-semibold">Outstanding Penalties</p>
          <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">KES {total.toLocaleString()}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00C853]" />
        </div>
      ) : penalties.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
          <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-semibold">No penalties</p>
          <p className="text-sm text-slate-400 mt-1">You have no penalties on record.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {penalties.map((penalty) => (
            <div
              key={penalty.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{penalty.reason}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {penalty.chamas?.name} · {format(new Date(penalty.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-900 dark:text-white">KES {Number(penalty.amount).toLocaleString()}</p>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  penalty.status === 'paid' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'
                }`}>
                  {penalty.status === 'paid' ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
