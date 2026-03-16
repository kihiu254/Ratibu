import { useEffect, useState } from 'react'
import {
  FileCheck, Search, Eye, User, Mail, Loader2, CheckCircle, Clock,
  AlertCircle, X, Download, Phone, MapPin, Users, CreditCard,
  Briefcase, Building, ShieldCheck, ImageOff
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'

interface KycUser {
  id: string
  email: string
  first_name?: string
  middle_name?: string
  last_name?: string
  phone?: string
  created_at: string
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
  category_other_specification?: string
  id_front_url?: string
  id_back_url?: string
  selfie_url?: string
}

// Download a remote image via blob fetch (works cross-origin)
async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Network response was not ok')
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank')
  }
}

// Download KYC as text/HTML summary
function downloadKycSummary(user: KycUser) {
  const name = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')
  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>KYC Summary – ${name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; max-width: 800px; margin: auto; }
    h1 { color: #00C853; font-size: 24px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    section { margin-bottom: 20px; }
    h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #777; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .label { font-weight: bold; color: #555; }
    .pill { display: inline-block; background: #e8f5e9; color: #00C853; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: bold; margin: 2px; }
    .status-approved { color: green; font-weight: bold; }
    .status-pending { color: orange; font-weight: bold; }
    .status-rejected { color: red; font-weight: bold; }
    .img-grid { display: flex; gap: 12px; flex-wrap: wrap; }
    .img-grid a { text-decoration: none; }
    .img-grid img { width: 200px; height: 130px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; }
    .img-label { font-size: 11px; color: #555; text-align: center; margin-top: 4px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>KYC Document – ${name}</h1>
  <div class="sub">Generated: ${new Date().toLocaleString()} | Email: ${user.email}</div>

  <section>
    <h2>KYC Status</h2>
    <div class="row"><span class="label">Status</span><span class="status-${user.kyc_status || 'not_started'}">${(user.kyc_status || 'not_started').replace('_', ' ').toUpperCase()}</span></div>
    <div class="row"><span class="label">Submitted</span><span>${new Date(user.created_at).toLocaleDateString()}</span></div>
  </section>

  <section>
    <h2>Personal Details</h2>
    ${user.id_number ? `<div class="row"><span class="label">ID Number</span><span>${user.id_number}</span></div>` : ''}
    ${user.kra_pin ? `<div class="row"><span class="label">KRA PIN</span><span>${user.kra_pin}</span></div>` : ''}
    ${user.phone ? `<div class="row"><span class="label">Phone</span><span>${user.phone}</span></div>` : ''}
    ${user.dob ? `<div class="row"><span class="label">Date of Birth</span><span>${user.dob}</span></div>` : ''}
    ${user.gender ? `<div class="row"><span class="label">Gender</span><span>${user.gender}</span></div>` : ''}
    ${user.occupation ? `<div class="row"><span class="label">Occupation</span><span>${user.occupation}</span></div>` : ''}
    ${user.income_source ? `<div class="row"><span class="label">Income Source</span><span>${user.income_source}</span></div>` : ''}
  </section>

  ${user.county || user.sub_county || user.ward ? `
  <section>
    <h2>Address</h2>
    ${user.county ? `<div class="row"><span class="label">County</span><span>${user.county}</span></div>` : ''}
    ${user.sub_county ? `<div class="row"><span class="label">Sub-County</span><span>${user.sub_county}</span></div>` : ''}
    ${user.ward ? `<div class="row"><span class="label">Ward</span><span>${user.ward}</span></div>` : ''}
  </section>` : ''}

  ${user.next_of_kin_name ? `
  <section>
    <h2>Next of Kin</h2>
    <div class="row"><span class="label">Name</span><span>${user.next_of_kin_name}</span></div>
    ${user.next_of_kin_phone ? `<div class="row"><span class="label">Phone</span><span>${user.next_of_kin_phone}</span></div>` : ''}
    ${user.next_of_kin_relation ? `<div class="row"><span class="label">Relation</span><span>${user.next_of_kin_relation}</span></div>` : ''}
  </section>` : ''}

  ${user.bank_name || user.account_number ? `
  <section>
    <h2>Bank Details</h2>
    ${user.bank_name ? `<div class="row"><span class="label">Bank</span><span>${user.bank_name}</span></div>` : ''}
    ${user.account_number ? `<div class="row"><span class="label">Account</span><span>${user.account_number}</span></div>` : ''}
  </section>` : ''}

  ${user.member_category && user.member_category.length > 0 ? `
  <section>
    <h2>Member Categories</h2>
    <div>${user.member_category.map(c => `<span class="pill">${c}</span>`).join(' ')}</div>
    ${user.category_other_specification ? `<div class="row" style="margin-top:8px"><span class="label">Other Specification</span><span>${user.category_other_specification}</span></div>` : ''}
  </section>` : ''}

  <section>
    <h2>Identity Documents</h2>
    <div class="img-grid">
      ${user.id_front_url ? `<div><a href="${user.id_front_url}" target="_blank"><img src="${user.id_front_url}" alt="ID Front"/></a><div class="img-label">ID Front</div></div>` : ''}
      ${user.id_back_url ? `<div><a href="${user.id_back_url}" target="_blank"><img src="${user.id_back_url}" alt="ID Back"/></a><div class="img-label">ID Back</div></div>` : ''}
      ${user.selfie_url ? `<div><a href="${user.selfie_url}" target="_blank"><img src="${user.selfie_url}" alt="Selfie"/></a><div class="img-label">Selfie</div></div>` : ''}
    </div>
  </section>
</body>
</html>`
  const blob = new Blob([content], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `KYC_${name.replace(/\s+/g, '_')}_${user.id.slice(0, 8)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function DocImage({ url, label }: { url?: string | null; label: string }) {
  const [error, setError] = useState(false)

  if (!url) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
        <ImageOff className="w-6 h-6 opacity-40" />
        <span className="text-xs">{label} missing</span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="relative group flex-1 min-h-[140px] bg-slate-100 dark:bg-slate-800">
        {error ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
            <ImageOff className="w-6 h-6" />
            <span className="text-xs">Could not load image</span>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#00C853] underline">Open link</a>
          </div>
        ) : (
          <img
            src={url}
            alt={label}
            className="w-full h-40 object-cover"
            onError={() => setError(true)}
          />
        )}
        {!error && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 text-xs font-bold backdrop-blur-sm transition-all">
              View
            </a>
          </div>
        )}
      </div>
      <div className="p-2 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <button
          onClick={() => downloadImage(url, `${label.replace(/\s+/g, '_')}.jpg`)}
          className="flex items-center gap-1 text-xs font-bold text-[#00C853] hover:text-green-600 transition-colors"
        >
          <Download className="w-3 h-3" /> Download
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-white text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
      <Icon className="w-3.5 h-3.5" />
      {title}
    </h3>
  )
}

function KycModal({ user, onClose, onStatusChange }: {
  user: KycUser
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-3xl my-auto shadow-2xl border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#00C853]/10 flex items-center justify-center text-[#00C853] font-black text-2xl">
              {user.first_name?.[0] || <User className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{fullName || '—'}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" /> {user.email}
              </p>
              {user.phone && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {user.phone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadKycSummary(user)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#00C853]/10 text-[#00C853] hover:bg-[#00C853]/20 transition-all"
            >
              <Download className="w-4 h-4" /> Download KYC
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* KYC Status Controls */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Update KYC Status:</span>
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

          {/* Personal Details */}
          <div>
            <SectionTitle icon={User} title="Personal Details" />
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
              <InfoRow label="Full Name" value={fullName} />
              <InfoRow label="ID Number" value={user.id_number} />
              <InfoRow label="KRA PIN" value={user.kra_pin} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="Date of Birth" value={user.dob} />
              <InfoRow label="Gender" value={user.gender} />
              <InfoRow label="Submitted On" value={new Date(user.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })} />
            </div>
          </div>

          {/* Occupation */}
          {(user.occupation || user.income_source) && (
            <div>
              <SectionTitle icon={Briefcase} title="Employment & Income" />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                <InfoRow label="Occupation" value={user.occupation} />
                <InfoRow label="Income Source" value={user.income_source} />
              </div>
            </div>
          )}

          {/* Address */}
          {(user.county || user.sub_county || user.ward) && (
            <div>
              <SectionTitle icon={MapPin} title="Address" />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                <InfoRow label="County" value={user.county} />
                <InfoRow label="Sub-County" value={user.sub_county} />
                <InfoRow label="Ward" value={user.ward} />
              </div>
            </div>
          )}

          {/* Next of Kin */}
          {(user.next_of_kin_name || user.next_of_kin_phone) && (
            <div>
              <SectionTitle icon={ShieldCheck} title="Next of Kin" />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                <InfoRow label="Name" value={user.next_of_kin_name} />
                <InfoRow label="Phone" value={user.next_of_kin_phone} />
                <InfoRow label="Relation" value={user.next_of_kin_relation} />
              </div>
            </div>
          )}

          {/* Bank */}
          {(user.bank_name || user.account_number) && (
            <div>
              <SectionTitle icon={Building} title="Bank Details" />
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-0">
                <InfoRow label="Bank" value={user.bank_name} />
                <InfoRow label="Account Number" value={user.account_number} />
              </div>
            </div>
          )}

          {/* Member Categories */}
          {user.member_category && user.member_category.length > 0 && (
            <div>
              <SectionTitle icon={Users} title="Member Categories" />
              <div className="flex flex-wrap gap-2">
                {user.member_category.map(c => (
                  <span key={c} className="px-3 py-1 rounded-full text-xs font-bold bg-[#00C853]/10 text-[#00C853]">{c}</span>
                ))}
              </div>
              {user.category_other_specification && (
                <p className="mt-2 text-xs text-slate-500">Specification: <span className="font-bold text-slate-700 dark:text-slate-300">{user.category_other_specification}</span></p>
              )}
            </div>
          )}

          {/* Identity Documents */}
          <div>
            <SectionTitle icon={CreditCard} title="Identity Documents" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DocImage url={user.id_front_url} label="ID Front" />
              <DocImage url={user.id_back_url} label="ID Back" />
              <DocImage url={user.selfie_url} label="Selfie" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function AdminKycDocuments() {
  const [records, setRecords] = useState<KycUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<KycUser | null>(null)

  useEffect(() => {
    fetchRecords()
  }, [])

  async function fetchRecords() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, first_name, middle_name, last_name, phone, created_at,
          kyc_status, id_number, kra_pin, dob, gender,
          county, sub_county, ward,
          occupation, income_source,
          bank_name, account_number,
          next_of_kin_name, next_of_kin_phone, next_of_kin_relation,
          member_category, category_other_specification,
          id_front_url, id_back_url, selfie_url
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch {
      toast.error('Failed to load KYC documents')
    } finally {
      setLoading(false)
    }
  }

  function handleStatusChange(id: string, status: string) {
    setRecords(records.map(r => r.id === id ? { ...r, kyc_status: status } : r))
  }

  const kycBadge = (status?: string) => {
    const normalized = status === 'verified' ? 'approved' : (status ?? 'not_started')
    const map: Record<string, { icon: any; cls: string; label: string }> = {
      approved:    { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   label: 'Approved' },
      pending:     { icon: Clock,       cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
      rejected:    { icon: AlertCircle, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           label: 'Rejected' },
      not_started: { icon: User,        cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',      label: 'Not Started' },
    }
    const s = map[normalized] ?? map['not_started']
    const Icon = s.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${s.cls}`}>
        <Icon className="w-3 h-3" />{s.label}
      </span>
    )
  }

  const filtered = records.filter(r => {
    const normalized = r.kyc_status === 'verified' ? 'approved' : (r.kyc_status ?? 'not_started')
    const matchesStatus = statusFilter === 'all' || normalized === statusFilter
    const matchesSearch = `${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

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
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">KYC Documents</h1>
          <p className="text-slate-500">{filtered.length} of {records.length} members</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#00C853] transition-all"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
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
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Member</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Documents</th>
                <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted</th>
                <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                        {user.first_name?.[0] || <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {user.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">{kycBadge(user.kyc_status)}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {[
                        { url: user.id_front_url, label: 'Front' },
                        { url: user.id_back_url, label: 'Back' },
                        { url: user.selfie_url, label: 'Selfie' },
                      ].map(({ url, label }) => (
                        url ? (
                          <div key={label} className="relative group">
                            <img
                              src={url}
                              alt={label}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.parentElement!.innerHTML = `<div class="w-10 h-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] text-slate-400 text-center leading-tight p-1">${label}</div>`
                              }}
                            />
                          </div>
                        ) : (
                          <div key={label} className="w-10 h-10 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                            —
                          </div>
                        )
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => setSelected(user)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No KYC submissions found.</p>
          </div>
        )}
      </div>

      {selected && (
        <KycModal
          user={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
