import { useState, useEffect } from 'react'
import {
  Search, Filter, Trash2, Eye, User, Loader2, XCircle, Mail,
  X, CheckCircle, Clock, AlertCircle, ShieldCheck, FileText, KeyRound, RefreshCw
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  system_role: string
  created_at: string
  avatar_url?: string
  kyc_status?: string
  id_number?: string
  kra_pin?: string
  dob?: string
  gender?: string
  county?: string
  sub_county?: string
  ward?: string
  occupation?: string
  income_source?: string
  bank_name?: string
  account_number?: string
  next_of_kin_name?: string
  next_of_kin_phone?: string
  next_of_kin_relation?: string
  member_category?: string[]
  id_front_url?: string
  id_back_url?: string
  selfie_url?: string
  phone?: string
  transaction_pin_enabled?: boolean
  transaction_pin_failed_attempts?: number
  transaction_pin_locked_until?: string
  transaction_pin_hash?: string | null
}

function KycModal({ user, onClose, onStatusChange }: { user: UserProfile, onClose: () => void, onStatusChange: (id: string, status: string) => void }) {
  const [updating, setUpdating] = useState(false)
  const [resettingPin, setResettingPin] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  async function updateKycStatus(status: string) {
    setUpdating(true)
    try {
      const { error } = await supabase.from('users').update({ kyc_status: status }).eq('id', user.id)
      if (error) throw error
      toast.success(`KYC status updated to ${status}`)
      onStatusChange(user.id, status)
      onClose()
    } catch {
      toast.error('Failed to update KYC status')
    } finally {
      setUpdating(false)
    }
  }

  async function resetTransactionPin() {
    const confirmed = window.confirm(`Reset the PIN for ${user.first_name} ${user.last_name}?`)
    if (!confirmed) return

    setResettingPin(true)
    try {
      const { error } = await supabase.functions.invoke('transaction-auth', {
        body: {
          action: 'admin_reset',
          targetUserId: user.id,
        },
      })

      if (error) throw error

      toast.success('PIN reset')
      onStatusChange(user.id, user.kyc_status || 'not_started')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset PIN')
    } finally {
      setResettingPin(false)
    }
  }

  async function resetPassword() {
    const confirmed = window.confirm(`Send a password reset email to ${user.email}?`)
    if (!confirmed) return

    setResettingPassword(true)
    try {
      const { error } = await supabase.functions.invoke('transaction-auth', {
        body: {
          action: 'admin_password_reset',
          targetUserId: user.id,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      })

      if (error) throw error

      toast.success('Password reset email sent')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send password reset email')
    } finally {
      setResettingPassword(false)
    }
  }

  const row = (label: string, value?: string | null) =>
    value ? (
      <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white text-right max-w-[60%]">{value}</span>
      </div>
    ) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-2xl my-auto shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853] font-black text-xl">
              {user.first_name?.[0] || <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{user.first_name} {user.last_name}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close user details"
            title="Close user details"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* KYC Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Update KYC:</span>
            {['approved', 'pending', 'rejected', 'not_started'].map(s => (
              <button
                key={s}
                disabled={updating || user.kyc_status === s}
                onClick={() => updateKycStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                  s === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                  s === 'pending'  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                  s === 'rejected' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                  'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : s.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {/* Personal Info */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <User className="w-3 h-3" /> Personal Details
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
              {row('ID Number', user.id_number)}
              {row('KRA PIN', user.kra_pin)}
              {row('Date of Birth', user.dob)}
              {row('Gender', user.gender)}
              {row('Phone', user.phone)}
              {row('Occupation', user.occupation)}
              {row('Income Source', user.income_source)}
            </div>
          </div>

          {/* Transaction PIN */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <KeyRound className="w-3 h-3" /> Member PIN
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  user.transaction_pin_hash
                    ? (user.transaction_pin_enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {user.transaction_pin_hash
                    ? (user.transaction_pin_enabled ? 'Set' : 'Locked')
                    : 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Attempts</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {user.transaction_pin_failed_attempts ?? 0}
                </span>
              </div>
              {user.transaction_pin_locked_until && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Locked until</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {new Date(user.transaction_pin_locked_until).toLocaleString()}
                  </span>
                </div>
              )}
              {user.transaction_pin_hash && (
                <button
                  type="button"
                  onClick={resetTransactionPin}
                  disabled={resettingPin}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C853]/10 text-[#00C853] font-bold text-sm hover:bg-[#00C853]/20 transition-colors disabled:opacity-60"
                >
                  {resettingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Mail className="w-3 h-3" /> Account Password
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Email</span>
                <span className="font-bold text-slate-900 dark:text-white text-right max-w-[60%]">
                  {user.email || 'Not available'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Send a password reset link to the member's registered email.
              </p>
              {user.email && (
                <button
                  type="button"
                  onClick={resetPassword}
                  disabled={resettingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00C853]/10 text-[#00C853] font-bold text-sm hover:bg-[#00C853]/20 transition-colors disabled:opacity-60"
                >
                  {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {resettingPassword ? 'Sending...' : 'Send reset email'}
                </button>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <FileText className="w-3 h-3" /> Address
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
              {row('County', user.county)}
              {row('Sub-County', user.sub_county)}
              {row('Ward', user.ward)}
            </div>
          </div>

          {/* Next of Kin */}
          {(user.next_of_kin_name || user.next_of_kin_phone) && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Next of Kin
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                {row('Name', user.next_of_kin_name)}
                {row('Phone', user.next_of_kin_phone)}
                {row('Relation', user.next_of_kin_relation)}
              </div>
            </div>
          )}

          {/* Bank */}
          {(user.bank_name || user.account_number) && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bank Details</h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                {row('Bank', user.bank_name)}
                {row('Account', user.account_number)}
              </div>
            </div>
          )}

          {/* Categories */}
          {user.member_category && user.member_category.length > 0 && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Member Categories</h3>
              <div className="flex flex-wrap gap-2">
                {user.member_category.map(c => (
                  <span key={c} className="px-3 py-1 bg-[#00C853]/10 text-[#00C853] rounded-full text-xs font-bold">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* ID Documents */}
          {(user.id_front_url || user.id_back_url || user.selfie_url) && (
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Identity Documents</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'ID Front', url: user.id_front_url },
                  { label: 'ID Back',  url: user.id_back_url },
                  { label: 'Selfie',   url: user.selfie_url },
                ].map(({ label, url }) => url ? (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-[#00C853] transition-all">
                    <img src={url} alt={label} className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{label}</span>
                    </div>
                  </a>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [kycFilter, setKycFilter] = useState<string>('all')

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('users').delete().eq('id', id)
      if (error) throw error
      toast.success('User deleted')
      setUsers(users.filter(u => u.id !== id))
      setDeleteConfirm(null)
    } catch {
      toast.error('Failed to delete user')
    }
  }

  function handleStatusChange(id: string, status: string) {
    setUsers(users.map(u => u.id === id ? { ...u, kyc_status: status } : u))
  }

  const kycBadge = (status?: string) => {
    const map: Record<string, { icon: LucideIcon, cls: string, label: string }> = {
      approved:    { icon: CheckCircle,  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   label: 'Approved' },
      pending:     { icon: Clock,        cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
      rejected:    { icon: AlertCircle,  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           label: 'Rejected' },
      not_started: { icon: User,         cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',      label: 'Not Started' },
    }
    const normalized = status === 'verified' ? 'approved' : (status ?? 'not_started')
    const s = map[normalized] ?? map['not_started']
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${s.cls}`}>
        <Icon className="w-3 h-3" />{s.label}
      </span>
    )
  }

  const filtered = users.filter(u => {
    const matchSearch =
      u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const normalizedKyc = u.kyc_status === 'verified' ? 'approved' : (u.kyc_status ?? 'not_started')
    const matchKyc = kycFilter === 'all' || normalizedKyc === kycFilter
    return matchSearch && matchKyc
  })

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Directory</h1>
          <p className="text-slate-500">{users.length} registered members</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* KYC filter */}
          <label htmlFor="admin-users-kyc-filter" className="sr-only">Filter users by KYC status</label>
          <select
            id="admin-users-kyc-filter"
            value={kycFilter}
            onChange={e => setKycFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853] transition-all"
          >
            <option value="all">All KYC</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="not_started">Not Started</option>
          </select>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-6 py-3 w-full md:w-64 outline-none focus:border-[#00C853] transition-all"
            />
          </div>
          <button
            aria-label="Filter users"
            title="Filter users"
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <Filter className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">KYC Status</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold overflow-hidden flex-shrink-0">
                        {user.avatar_url
                          ? (
                            <img
                              src={user.avatar_url}
                              alt={`${user.first_name || 'User'} ${user.last_name || ''} profile`.trim()}
                              className="w-full h-full object-cover"
                            />
                          )
                          : (user.first_name?.[0] || <User className="w-5 h-5" />)
                        }
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{user.first_name} {user.last_name}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">{kycBadge(user.kyc_status)}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                      user.system_role === 'admin' || user.system_role === 'super_admin'
                        ? 'bg-[#00C853]/10 text-[#00C853]'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {user.system_role || 'user'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 text-slate-400 hover:text-[#00C853] hover:bg-[#00C853]/10 rounded-lg transition-all"
                        title="View KYC Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {deleteConfirm === user.id ? (
                        <div className="flex items-center gap-2 bg-red-500/10 p-1 rounded-lg">
                          <button onClick={() => handleDelete(user.id)} className="text-xs font-bold text-red-500 px-2 hover:underline">
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            aria-label="Cancel user deletion"
                            title="Cancel user deletion"
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(user.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No users found.</p>
          </div>
        )}
      </div>

      {/* KYC Modal */}
      {selectedUser && (
        <KycModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
