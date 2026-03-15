import { useState, useEffect, useRef } from 'react'
import { toast } from '../utils/toast'
import { supabase } from '../lib/supabase'
import { 
  User, 
  Mail, 
  Phone, 
  Camera, 
  Save, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Gift,
  Gavel,
  Plus,
  X,
  Coins
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [penalties, setPenalties] = useState<any[]>([])
  const [rules, setRules] = useState<any[]>([])
  const [loadingRules, setLoadingRules] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    event_type: 'late_contribution',
    points_penalty: 0,
    monetary_penalty: 0
  })
  const [selectedChamaId, setSelectedChamaId] = useState<string | null>(null)
  const [userChamas, setUserChamas] = useState<any[]>([])
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    referral_code: '',
    kyc_status: 'pending',
    member_category: [] as string[]
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      const { data: userStats } = await supabase
        .from('gamification_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setStats(userStats)

      const { data: chamas } = await supabase
        .from('chama_members')
        .select('chama:chamas(id,name), role')
        .eq('user_id', user.id)
      setUserChamas(chamas?.map((c: any) => ({ ...c.chama, role: c.role })) || [])
      if (chamas && chamas.length > 0) setSelectedChamaId((chamas[0].chama as any).id)

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          referral_code: data.referral_code || '',
          kyc_status: data.kyc_status || 'pending',
          member_category: data.member_category || []
        })
      }

      // Fetch penalties for user
      const { data: penaltyEvents } = await supabase
        .from('penalty_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setPenalties(penaltyEvents || [])
    } catch (err: any) {
      console.error('Error fetching profile:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRules(chamaId: string) {
    try {
      setLoadingRules(true)
      const { data } = await supabase
        .from('penalty_rules')
        .select('*')
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false })
      setRules(data || [])
    } finally {
      setLoadingRules(false)
    }
  }

  useEffect(() => {
    if (selectedChamaId) fetchRules(selectedChamaId)
  }, [selectedChamaId])

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedChamaId) return
    try {
      setCreatingRule(true)
      const { error } = await supabase
        .from('penalty_rules')
        .insert({
          chama_id: selectedChamaId,
          name: newRule.name,
          description: newRule.description,
          event_type: newRule.event_type,
          points_penalty: Number(newRule.points_penalty) || 0,
          monetary_penalty: Number(newRule.monetary_penalty) || 0,
          created_by: user.id
        })
      if (error) throw error
      setNewRule({ name: '', description: '', event_type: 'late_contribution', points_penalty: 0, monetary_penalty: 0 })
      setShowRuleForm(false)
      fetchRules(selectedChamaId)
      toast.success('Rule created')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rule')
    } finally {
      setCreatingRule(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          ...profile,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      setSaving(true)
      
      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // 3. Update Profile state and DB
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError
      
      setMessage({ type: 'success', text: 'Avatar updated!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar Section */}
        <div className="lg:col-span-1">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="relative inline-block group mb-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#00C853]/20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-[#00C853] text-white rounded-full shadow-lg hover:scale-110 transition-transform"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              {profile.first_name || profile.last_name ? `${profile.first_name} ${profile.last_name}` : 'Unnamed User'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{user?.email}</p>
            
            <div className="text-left space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                <Mail className="w-4 h-4" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                {profile.kyc_status === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                    <span>Verified Member</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    <span>{profile.kyc_status.charAt(0).toUpperCase() + profile.kyc_status.slice(1)} Verification</span>
                  </>
                )}
              </div>
            </div>

            {profile.kyc_status === 'not_started' || profile.kyc_status === 'rejected' ? (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => navigate('/onboarding')}
                  className="w-full flex items-center justify-between p-4 bg-[#00C853]/5 hover:bg-[#00C853]/10 text-[#00C853] rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="font-bold text-sm">
                      {profile.kyc_status === 'rejected' ? 'Re-submit KYC' : 'Verify Profile'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : profile.kyc_status === 'pending' ? (
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-amber-500 text-center font-medium">
                  Your documents are under review (24–48 hrs)
                </p>
              </div>
            ) : null}

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
               <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-[#00C853]/30">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Referral Code</p>
                  <div className="flex items-center justify-between">
                     <span className="font-black text-[#00C853] tracking-widest">{profile.referral_code}</span>
                     <button 
                        onClick={() => {
                           navigator.clipboard.writeText(profile.referral_code)
                           toast.success('Code copied!')
                        }}
                        className="p-2 hover:bg-[#00C853]/10 rounded-lg transition-colors"
                     >
                        <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                     </button>
                  </div>
               </div>
            </div>
           <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-left">Member Categories</p>
              <div className="flex flex-wrap gap-2">
                {profile.member_category.length > 0 ? profile.member_category.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                    {cat}
                  </span>
                )) : (
                  <span className="text-sm text-slate-400 italic">No categories selected</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                  message.type === 'success' 
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">First Name</label>
                  <input
                    type="text"
                    value={profile.first_name}
                    onChange={e => setProfile({...profile, first_name: e.target.value})}
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Last Name</label>
                  <input
                    type="text"
                    value={profile.last_name}
                    onChange={e => setProfile({...profile, last_name: e.target.value})}
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={e => setProfile({...profile, phone: e.target.value})}
                      placeholder="e.g. 254700000000"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Bio</label>
                  <textarea
                    rows={4}
                    value={profile.bio}
                    onChange={e => setProfile({...profile, bio: e.target.value})}
                    placeholder="Tell us a bit about yourself..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-[#00C853] transition-all resize-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Referral + Penalties */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#00C853]" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Referral & Points</h3>
              </div>
              <span className="text-xs font-bold text-[#00C853] bg-[#00C853]/10 px-3 py-1 rounded-full">
                {stats?.points?.toLocaleString() || 0} pts
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Referral Points</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.referral_points?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Penalty Points</p>
                <p className="text-xl font-black text-amber-500">{stats?.penalty_points?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Contributions</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{stats?.total_contributions || 0}</p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Penalty Rules</h3>
              </div>
              {['admin', 'treasurer', 'secretary'].includes(
                userChamas.find(c => c.id === selectedChamaId)?.role
              ) && (
                <button
                  onClick={() => setShowRuleForm(!showRuleForm)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 text-xs font-black uppercase tracking-widest"
                >
                  {showRuleForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showRuleForm ? 'Close' : 'Add Rule'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-bold text-slate-500">Chama</span>
              <select
                value={selectedChamaId || ''}
                onChange={(e) => setSelectedChamaId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm"
              >
                {userChamas.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {showRuleForm && (
              <form onSubmit={handleCreateRule} className="p-4 mb-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <input
                  value={newRule.name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Rule name (e.g. Late contribution)"
                  required
                />
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  placeholder="Description"
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={newRule.event_type}
                    onChange={(e) => setNewRule(prev => ({ ...prev, event_type: e.target.value }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="late_contribution">Late Contribution</option>
                    <option value="missed_meeting">Missed Meeting</option>
                    <option value="missed_payment">Missed Payment</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="number"
                    value={newRule.points_penalty}
                    onChange={(e) => setNewRule(prev => ({ ...prev, points_penalty: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="Points penalty"
                  />
                  <input
                    type="number"
                    value={newRule.monetary_penalty}
                    onChange={(e) => setNewRule(prev => ({ ...prev, monetary_penalty: Number(e.target.value) }))}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="KES penalty"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingRule}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-black"
                >
                  {creatingRule ? 'Creating...' : 'Create Rule'}
                </button>
              </form>
            )}

            {loadingRules ? (
              <div className="text-sm text-slate-500">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="text-sm text-slate-500">No rules yet for this chama.</div>
            ) : (
              <div className="grid gap-3">
                {rules.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600">-{r.points_penalty} pts</span>
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">KES {r.monetary_penalty}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-[#00C853]" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Recent Penalties</h3>
            </div>
            {penalties.length === 0 ? (
              <div className="text-sm text-slate-500">No penalties applied.</div>
            ) : (
              <div className="grid gap-3">
                {penalties.map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{p.event_type.replace('_',' ')}</p>
                        <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-xs font-bold text-amber-600">-{p.points_penalty} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
