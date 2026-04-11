import { useEffect, useState } from 'react'
import { Activity, Loader2, RefreshCw, Search, MessageSquareText, ArrowDownLeft, ArrowUpRight, ShieldCheck, Calendar, Filter } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface UssdRequestRow {
  id: string
  session_id: string
  phone_number: string
  request_text: string
  response_text: string | null
  created_at: string
}

interface UssdTransactionRow {
  id: string
  amount: number
  type: string
  status: string
  description?: string | null
  payment_method?: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
  user_email?: string
  user_first_name?: string
  user_last_name?: string
  chama_name?: string
}

interface UssdAuditRow {
  id: string
  action: string
  resource_type: string
  created_at: string
  new_value?: Record<string, unknown> | null
  user_email?: string
  user_first_name?: string
  user_last_name?: string
}

interface RawTransaction {
  id: string
  amount: number
  type: string
  status: string
  description?: string | null
  payment_method?: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
  users?: { email?: string; first_name?: string; last_name?: string } | null
  chamas?: { name?: string } | null
}

interface RawAudit {
  id: string
  action: string
  resource_type: string
  created_at: string
  new_value?: Record<string, unknown> | null
  users?: { email?: string; first_name?: string; last_name?: string } | null
}

const EVENT_MAP: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  request: { label: 'Request', icon: MessageSquareText, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  transaction: { label: 'Txn', icon: ArrowDownLeft, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  withdrawal: { label: 'Txn', icon: ArrowUpRight, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  audit: { label: 'Audit', icon: ShieldCheck, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
}

function exportCsv(rows: EventRow[]) {
  const headers = ['Date', 'Kind', 'Actor', 'Details', 'Amount (KES)', 'Status']
  const csv = [
    headers,
    ...rows.map((row) => [
      new Date(row.created_at).toLocaleString(),
      row.kind,
      row.actor,
      row.details,
      row.amount ?? '',
      row.status ?? '',
    ]),
  ].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ussd_activity_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface EventRow {
  id: string
  kind: 'request' | 'transaction' | 'withdrawal' | 'audit'
  title: string
  actor: string
  details: string
  amount?: number | null
  status?: string | null
  created_at: string
}

export default function AdminUssd() {
  const [requests, setRequests] = useState<UssdRequestRow[]>([])
  const [transactions, setTransactions] = useState<UssdTransactionRow[]>([])
  const [audits, setAudits] = useState<UssdAuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('all')

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [requestRes, txRes, auditRes] = await Promise.all([
        supabase
          .from('ussd_request_log')
          .select('id, session_id, phone_number, request_text, response_text, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('transactions')
          .select('id, amount, type, status, description, payment_method, created_at, metadata, users:user_id(email,first_name,last_name), chamas:chama_id(name)')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('audit_logs')
          .select('id, action, resource_type, created_at, new_value, users:user_id(email,first_name,last_name)')
          .ilike('action', 'ussd_%')
          .order('created_at', { ascending: false })
          .limit(300),
      ])

      if (requestRes.error) throw requestRes.error
      if (txRes.error) throw txRes.error
      if (auditRes.error) throw auditRes.error

      setRequests(requestRes.data || [])
      setTransactions(((txRes.data as unknown as RawTransaction[]) || []).map((row) => ({
        id: row.id,
        amount: row.amount,
        type: row.type,
        status: row.status,
        description: row.description,
        payment_method: row.payment_method,
        created_at: row.created_at,
        metadata: row.metadata,
        user_email: row.users?.email,
        user_first_name: row.users?.first_name,
        user_last_name: row.users?.last_name,
        chama_name: row.chamas?.name,
      })))
      setAudits(((auditRes.data as unknown as RawAudit[]) || []).map((row) => ({
        id: row.id,
        action: row.action,
        resource_type: row.resource_type,
        created_at: row.created_at,
        new_value: row.new_value,
        user_email: row.users?.email,
        user_first_name: row.users?.first_name,
        user_last_name: row.users?.last_name,
      })))
    } catch (err) {
      console.error(err)
      toast.error('Failed to load USSD activity')
    } finally {
      setLoading(false)
    }
  }

  const ussdTransactions = transactions.filter((tx) => {
    const metadata = (tx.metadata || {}) as Record<string, unknown>
    const isUssd =
      tx.payment_method === 'ussd' ||
      metadata['channel'] === 'ussd' ||
      metadata['origin'] === 'ussd'
    return isUssd
  })

  const combined: EventRow[] = [
    ...requests.map((row) => ({
      id: `req-${row.id}`,
      kind: 'request' as const,
      title: row.request_text || 'USSD request',
      actor: row.phone_number,
      details: row.response_text || 'No response',
      created_at: row.created_at,
    })),
    ...ussdTransactions.map((row) => {
      const debit = ['withdrawal', 'loan'].includes(row.type)
      return {
        id: `tx-${row.id}`,
        kind: debit ? 'withdrawal' as const : 'transaction' as const,
        title: row.description || row.type,
        actor: row.user_first_name ? `${row.user_first_name} ${row.user_last_name || ''}`.trim() : (row.user_email || 'Member'),
        details: row.chama_name || row.description || row.type,
        amount: row.amount,
        status: row.status,
        created_at: row.created_at,
      }
    }),
    ...audits.map((row) => ({
      id: `audit-${row.id}`,
      kind: 'audit' as const,
      title: row.action,
      actor: row.user_first_name ? `${row.user_first_name} ${row.user_last_name || ''}`.trim() : (row.user_email || 'System'),
      details: row.resource_type,
      created_at: row.created_at,
    })),
  ]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

  const filtered = combined.filter((row) => {
    const matchesKind = kindFilter === 'all' || row.kind === kindFilter
    const matchesDate = !dateFilter || row.created_at.startsWith(dateFilter)
    const haystack = `${row.title} ${row.actor} ${row.details} ${row.status || ''}`.toLowerCase()
    const matchesSearch = haystack.includes(search.toLowerCase())
    return matchesKind && matchesDate && matchesSearch
  })

  const totalAmount = ussdTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">USSD Activity</h1>
          <p className="text-slate-500">{filtered.length} events · KES {totalAmount.toLocaleString()} in USSD transactions</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => exportCsv(filtered)}
            className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 rounded-xl transition-all"
          >
            <Filter className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Requests', value: requests.length, color: 'text-slate-900 dark:text-white' },
          { label: 'USSD Txns', value: ussdTransactions.length, color: 'text-[#00C853]' },
          { label: 'Audits', value: audits.length, color: 'text-blue-600' },
          { label: 'Total KES', value: totalAmount.toLocaleString(), color: 'text-purple-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <label htmlFor="ussd-search" className="sr-only">Search USSD activity</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="ussd-search"
            type="text"
            placeholder="Search phone, action, or detail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:border-[#00C853] transition-all w-72"
          />
        </div>
        <label htmlFor="ussd-kind-filter" className="sr-only">Filter by kind</label>
        <select
          id="ussd-kind-filter"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853]"
        >
          <option value="all">All Events</option>
          <option value="request">Requests</option>
          <option value="transaction">Transactions</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="audit">Audit Logs</option>
        </select>
        <div className="relative">
          <label htmlFor="ussd-date-filter" className="sr-only">Filter by date</label>
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="ussd-date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-[#00C853]"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Event</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Actor</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((row) => {
                const conf = EVENT_MAP[row.kind]
                const Icon = conf.icon
                const isDebit = row.kind === 'withdrawal'
                return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${conf.cls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{conf.label}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{row.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-700 dark:text-slate-300">{row.actor}</td>
                    <td className="py-4 px-6 text-sm text-slate-500">{row.details}</td>
                    <td className="py-4 px-6 text-right">
                      {typeof row.amount === 'number' ? (
                        <span className={`text-sm font-black ${isDebit ? 'text-red-500' : 'text-green-600'}`}>
                          {isDebit ? '-' : '+'}KES {Number(row.amount).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500 capitalize">{row.status || row.kind}</td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-slate-500">{new Date(row.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
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
            <p className="font-bold">No USSD activity found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
