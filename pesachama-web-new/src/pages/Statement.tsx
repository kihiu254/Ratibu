import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, ArrowLeft, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'

interface TxRow {
  id: string
  type: string
  amount: number
  status: string
  description: string | null
  reference: string | null
  created_at: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load statement'
}

export default function Statement() {
  const [params] = useSearchParams()
  const account = params.get('account') // 'chama' | 'savings_target' | 'mshwari'
  const id = params.get('id')
  const name = params.get('name') ?? 'Account'

  const [rows, setRows] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [account, id])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let q = supabase
        .from('transactions')
        .select('id, type, amount, status, description, reference, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (account === 'chama' && id) q = q.eq('chama_id', id)
      else if (account === 'savings_target' && id) q = q.eq('savings_target_id', id)
      // mshwari: filter by description keyword since it goes via STK push
      else if (account === 'mshwari') q = q.ilike('description', '%mshwari%')

      const { data, error } = await q
      if (error) throw error
      setRows((data ?? []) as TxRow[])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => `KES ${Number(n).toLocaleString()}`
  const fmtDate = (s: string) =>
    new Date(s).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link to="/accounts" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Transaction statement</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-slate-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="p-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No transactions yet for this account.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {rows.map(tx => {
            const isCredit = tx.type === 'deposit' || tx.type === 'credit'
            return (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-4">
                <div className={`p-2 rounded-xl flex-shrink-0 ${isCredit ? 'bg-[#00C853]/10' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  {isCredit
                    ? <ArrowDownCircle className="w-5 h-5 text-[#00C853]" />
                    : <ArrowUpCircle className="w-5 h-5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                    {tx.description ?? tx.type}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmtDate(tx.created_at)}</p>
                  {tx.reference && (
                    <p className="text-xs text-slate-400">Ref: {tx.reference}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-sm ${isCredit ? 'text-[#00C853]' : 'text-red-500'}`}>
                    {isCredit ? '+' : '-'}{fmt(tx.amount)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tx.status === 'completed' ? 'bg-[#00C853]/10 text-[#00C853]' :
                    tx.status === 'pending' ? 'bg-orange-100 text-orange-500' :
                    'bg-red-100 text-red-500'
                  }`}>{tx.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
