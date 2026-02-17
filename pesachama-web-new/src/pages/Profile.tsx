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
  AlertCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    referral_code: ''
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
          referral_code: data.referral_code || ''
        })
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message)
    } finally {
      setLoading(false)
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
                <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
                <span>Verified Account</span>
              </div>
            </div>

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
      </div>
    </div>
  )
}
