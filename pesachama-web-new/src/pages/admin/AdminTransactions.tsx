import { useEffect, useState } from 'react'
import { Loader2, Search, Download, RefreshCw, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, XCircle, Calendar, Filter } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface Tx {
  id: string
  amount: number
  type: string
  status: string
  description?: string
  reference?: string
  created_at: string
  user_email?: string
  user_first?: string
  user_last?: string
  chama_name?: string
}

interface RawTx {
  id: string
  amount: number
  type: string
  status: string
  description?: string
  reference?: string
  created_at: string
  users?: { email?: string; first_name?: string; last_name?: string } | null
  chamas?: { name?: string } | null
}

const TYPE_ICON: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  deposit:      { icon: ArrowDownLeft, color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
  contribution: { icon: ArrowDownLeft, color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  repayment:    { icon: ArrowDownLeft, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  withdrawal:   { icon: ArrowUpRight,  color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30' },
  loan:         { icon: ArrowUpRight,  color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  transfer:     { icon: ArrowUpRight,  color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800' },
}
const STATUS_MAP: Record<string, { cls: string; icon: LucideIcon; label: string }> = {
  completed: { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Completed' },
  success:   { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Success' },
  pending:   { icon: Clock,       cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
  failed:    { icon: XCircle,     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Failed' },
}

function exportCsv(rows: Tx[]) {
  const headers = ['Date', 'Reference', 'Type', 'Description', 'Amount (KES)', 'Status', 'Member', 'Chama']
  const body = rows.map(r => [
    new Date(r.created_at).toLocaleString(),
    r.reference || r.id.slice(0, 8),
    r.type,
    r.description || '',
    r.amount,
    r.status,
    r.user_first ? `${r.user_first} ${r.user_last}` : (r.user_email || ''),
    r.chama_name || '',
  ])
  const csv = [headers, ...body].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `transactions_${new Date().toISOString().slice(0, 10)}.csv` })
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function AdminTransactions() {
  const [data, setData] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [dateF, setDateF] = useState('')

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try {
      setLoading(true)
      const { data: raw, error } = await supabase
        .from('transactions')
        .select('id, amount, type, status, description, reference, created_at, users:user_id(email,first_name,last_name), chamas:chama_id(name)')
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      setData(((raw as unknown as RawTx[]) || []).map(r => ({
        id: r.id, amount: r.amount, type: r.type, status: r.status,
        description: r.description, reference: r.reference, created_at: r.created_at,
        user_email: r.users?.email, user_first: r.users?.first_name, user_last: r.users?.last_name,
        chama_name: r.chamas?.name,
      })))
    } catch { toast.error('Failed to load transactions') }
    finally { setLoading(false) }
  }

  const filtered = data.filter(t => {
    const matchType = typeF === 'all' || t.type === typeF
    const matchStatus = statusF === 'all' || t.status === statusF
    const matchDate = !dateF || t.created_at.startsWith(dateF)
    const name = t.user_first ? `${t.user_first} ${t.user_last}` : (t.user_email || '')
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.chama_name || '').toLowerCase().includes(search.toLowerCase())
    return matchType && matchStatus && matchDate && matchSearch
  })

  const totalVol = filtered.filter(t => t.status === 'completed' || t.status === 'success').reduce((s, t) => s + Number(t.amount), 0)
  const types = ['all', ...Array.from(new Set(data.map(t => t.type).filter(Boolean)))]
  const statuses = ['all', ...Array.from(new Set(data.map(t => t.status).filter(Boolean)))]

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#00C853]" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Transactions</h1>
          <p className="text-slate-500">{filtered.length} records · KES {totalVol.toLocaleString()} volume</p>
        </div>
        <div className="flex gap-3">
          <button aria-label="Export transactions as CSV" title="Export transactions as CSV" onClick={() => exportCsv(filtered)} className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 rounded-xl transition-all">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button aria-label="Refresh transactions" title="Refresh transactions" onClick={fetch} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: data.length, cls: 'text-slate-900 dark:text-white' },
          { label: 'Completed', value: data.filter(t => t.status === 'completed' || t.status === 'success').length, cls: 'text-green-600' },
          { label: 'Pending', value: data.filter(t => t.status === 'pending').length, cls: 'text-yellow-600' },
          { label: 'Failed', value: data.filter(t => t.status === 'failed').length, cls: 'text-red-500' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className={`text-2xl font-black ${c.cls}`}>{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <label htmlFor="admin-transactions-search" className="sr-only">Search transactions</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input id="admin-transactions-search" type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:border-[#00C853] transition-all w-56" />
        </div>
        <label htmlFor="admin-transactions-type-filter" className="sr-only">Filter by transaction type</label>
        <select id="admin-transactions-type-filter" value={typeF} onChange={e => setTypeF(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853]">
          {types.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <label htmlFor="admin-transactions-status-filter" className="sr-only">Filter by transaction status</label>
        <select id="admin-transactions-status-filter" value={statusF} onChange={e => setStatusF(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853]">
          {statuses.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <div className="relative">
          <label htmlFor="admin-transactions-date-filter" className="sr-only">Filter by transaction date</label>
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input id="admin-transactions-date-filter" type="date" value={dateF} onChange={e => setDateF(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-[#00C853]" />
        </div>
        {(typeF !== 'all' || statusF !== 'all' || dateF || search) && (
          <button aria-label="Clear transaction filters" title="Clear transaction filters" onClick={() => { setTypeF('all'); setStatusF('all'); setDateF(''); setSearch('') }}
            className="flex items-center gap-1 px-4 py-3 text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <Filter className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                {['Transaction', 'Member', 'Chama', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className={`py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(t => {
                const tc = TYPE_ICON[t.type] ?? TYPE_ICON['transfer']
                const sc = STATUS_MAP[t.status] ?? STATUS_MAP['pending']
                const TIcon = tc.icon; const SIcon = sc.icon
                const isDebit = ['withdrawal', 'loan'].includes(t.type)
                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tc.bg}`}>
                          <TIcon className={`w-4 h-4 ${tc.color}`} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">{t.type}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[150px]">{t.description || t.reference || t.id.slice(0, 12)+'...'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.user_first ? `${t.user_first} ${t.user_last}` : '—'}</p>
                      {t.user_email && <p className="text-xs text-slate-400">{t.user_email}</p>}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500">{t.chama_name || '—'}</td>
                    <td className="py-4 px-6 text-right">
                      <span className={`text-sm font-black ${isDebit ? 'text-red-500' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}KES {Number(t.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${sc.cls}`}>
                        <SIcon className="w-3 h-3" />{sc.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-500">{new Date(t.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{new Date(t.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <p className="font-bold">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}
