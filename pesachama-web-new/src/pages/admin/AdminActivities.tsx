import { useEffect, useState } from 'react'
import {
  Activity, Search, Loader2, ArrowUpRight, ArrowDownLeft, RefreshCw,
  CheckCircle, Clock, XCircle, Filter, Download, Calendar
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface Transaction {
  id: string
  amount: number
  type: string
  status: string
  description?: string
  created_at: string
  user_id?: string
  chama_id?: string
  reference?: string
  // joined fields
  user_email?: string
  user_first_name?: string
  user_last_name?: string
  chama_name?: string
}

interface RawTransaction {
  id: string
  amount: number
  type: string
  status: string
  description?: string
  created_at: string
  user_id?: string
  chama_id?: string
  reference?: string
  users?: { email?: string; first_name?: string; last_name?: string } | null
  chamas?: { name?: string } | null
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  deposit:      { icon: ArrowDownLeft,  color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30' },
  withdrawal:   { icon: ArrowUpRight,   color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30' },
  contribution: { icon: ArrowDownLeft,  color: 'text-blue-600',  bg: 'bg-blue-100 dark:bg-blue-900/30' },
  loan:         { icon: ArrowUpRight,   color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  repayment:    { icon: ArrowDownLeft,  color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  transfer:     { icon: RefreshCw,      color: 'text-slate-600',  bg: 'bg-slate-100 dark:bg-slate-800' },
}

const STATUS_CONFIG: Record<string, { icon: LucideIcon; cls: string; label: string }> = {
  completed: { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Completed' },
  pending:   { icon: Clock,       cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
  failed:    { icon: XCircle,     cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Failed' },
  success:   { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Success' },
}

function exportCsv(data: Transaction[]) {
  const headers = ['Date', 'Reference', 'Type', 'Description', 'Amount (KES)', 'Status', 'User', 'Chama']
  const rows = data.map(t => [
    new Date(t.created_at).toLocaleString(),
    t.reference || t.id.slice(0, 8),
    t.type,
    t.description || '—',
    t.amount,
    t.status,
    t.user_first_name ? `${t.user_first_name} ${t.user_last_name}` : (t.user_email || '—'),
    t.chama_name || '—',
  ])

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `activities_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminActivities() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, amount, type, status, description, created_at, user_id, chama_id, reference,
          users:user_id ( email, first_name, last_name ),
          chamas:chama_id ( name )
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      const mapped: Transaction[] = ((data as unknown as RawTransaction[]) || []).map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        created_at: t.created_at,
        user_id: t.user_id,
        chama_id: t.chama_id,
        reference: t.reference,
        user_email: t.users?.email,
        user_first_name: t.users?.first_name,
        user_last_name: t.users?.last_name,
        chama_name: t.chamas?.name,
      }))

      setTransactions(mapped)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const filtered = transactions.filter(t => {
    const matchType = typeFilter === 'all' || t.type === typeFilter
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchDate = !dateFilter || t.created_at.startsWith(dateFilter)
    const namePart = t.user_first_name
      ? `${t.user_first_name} ${t.user_last_name}`
      : (t.user_email || '')
    const matchSearch =
      namePart.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.chama_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchType && matchStatus && matchDate && matchSearch
  })

  const totalVolume = filtered.reduce((sum, t) => {
    if (t.status === 'completed' || t.status === 'success') return sum + Number(t.amount)
    return sum
  }, 0)

  const types = ['all', ...Array.from(new Set(transactions.map(t => t.type).filter(Boolean)))]
  const statuses = ['all', ...Array.from(new Set(transactions.map(t => t.status).filter(Boolean)))]

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Activities</h1>
          <p className="text-slate-500">{filtered.length} transactions · KES {totalVolume.toLocaleString()} total volume</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => exportCsv(filtered)}
            className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 rounded-xl transition-all"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={fetchTransactions}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: transactions.length, color: 'text-slate-700 dark:text-white' },
          { label: 'Completed', value: transactions.filter(t => t.status === 'completed' || t.status === 'success').length, color: 'text-green-600' },
          { label: 'Pending', value: transactions.filter(t => t.status === 'pending').length, color: 'text-yellow-600' },
          { label: 'Failed', value: transactions.filter(t => t.status === 'failed').length, color: 'text-red-500' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-black ${card.color}`}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <label htmlFor="activities-search" className="sr-only">Search activities</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="activities-search"
            type="text"
            placeholder="Search by name, chama, reference..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-6 py-3 w-64 outline-none focus:border-[#00C853] transition-all text-sm"
          />
        </div>

        <label htmlFor="activities-type-filter" className="sr-only">Filter by transaction type</label>
        <select
          id="activities-type-filter"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853] transition-all"
        >
          {types.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>

        <label htmlFor="activities-status-filter" className="sr-only">Filter by transaction status</label>
        <select
          id="activities-status-filter"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853] transition-all"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        <div className="relative">
          <label htmlFor="activities-date-filter" className="sr-only">Filter by transaction date</label>
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="activities-date-filter"
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-[#00C853] transition-all"
          />
        </div>

        {(typeFilter !== 'all' || statusFilter !== 'all' || dateFilter || searchQuery) && (
          <button
            onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setDateFilter(''); setSearchQuery('') }}
            className="flex items-center gap-1 px-4 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all"
          >
            <Filter className="w-3.5 h-3.5" /> Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Member</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Chama</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(t => {
                const typeConf = TYPE_CONFIG[t.type] ?? TYPE_CONFIG['transfer']
                const statusConf = STATUS_CONFIG[t.status] ?? STATUS_CONFIG['pending']
                const StatusIcon = statusConf.icon
                const TypeIcon = typeConf.icon
                const isDebit = ['withdrawal', 'loan'].includes(t.type)

                return (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConf.bg}`}>
                          <TypeIcon className={`w-4 h-4 ${typeConf.color}`} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white capitalize text-sm">{t.type}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[160px]">
                            {t.description || t.reference || t.id.slice(0, 12) + '...'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t.user_first_name ? `${t.user_first_name} ${t.user_last_name}` : '—'}
                      </p>
                      {t.user_email && (
                        <p className="text-xs text-slate-400">{t.user_email}</p>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{t.chama_name || '—'}</p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className={`text-sm font-black ${isDebit ? 'text-red-500' : 'text-green-600'}`}>
                        {isDebit ? '-' : '+'}KES {Number(t.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusConf.cls}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConf.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-500">
                        {new Date(t.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(t.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold">No activities found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
