import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Lock, Mail, User, Phone, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { getKenyanPhoneVariants } from '../lib/phone'
import { isDuplicatePhoneError } from '../lib/supabaseErrors'

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    referralCode: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  React.useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setFormData(prev => ({ ...prev, referralCode: ref }))
    }
  }, [searchParams])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Please accept the Terms and Privacy Policy to continue.')
      return
    }
    setLoading(true)
    setError(null)

    const phoneVariants = getKenyanPhoneVariants(formData.phone)
    if (phoneVariants.length === 0) {
      setError('Please enter a valid phone number.')
      setLoading(false)
      return
    }

    const { data: existingPhones, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .in('phone', phoneVariants)
      .limit(1)

    if (lookupError) {
      setError(lookupError.message)
      setLoading(false)
      return
    }

    if (existingPhones?.length) {
      setError('This phone number is already linked to another Ratibu account.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
          referral_code: formData.referralCode || undefined,
        },
      },
    })

    if (error) {
      setError(isDuplicatePhoneError(error)
        ? 'This phone number is already linked to another Ratibu account.'
        : error.message)
      setLoading(false)
    } else {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (user) {
        const now = new Date().toISOString()
        await supabase.from('users').update({
          terms_accepted_at: now,
          privacy_accepted_at: now,
          updated_at: now,
        }).eq('id', user.id)
      }
      navigate('/login?registered=1')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
        {/* Animated Background Video */}
        <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 dark:bg-slate-950/60 z-10 backdrop-blur-[2px] transition-colors duration-300" />
            <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-100"
            >
                <source src="/African_Digital_Finance_Animation.mp4" type="video/mp4" />
            </video>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/70 backdrop-blur-md dark:bg-slate-900/50 dark:backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-20"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00C853] to-green-600 bg-clip-text text-transparent">
              Create Account
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Join Ratibu to manage your group finances</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="register-full-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="register-full-name"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="register-phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="0700 000 000"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="register-referral" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Referral Code (Optional)</label>
              <div className="relative">
                <input
                  id="register-referral"
                  name="referralCode"
                  type="text"
                  value={formData.referralCode}
                  onChange={handleChange}
                  className="w-full pl-4 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="RATIBU-XXXXXX"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-white/5 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                One-time legal acceptance is required to create an account.
              </p>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  id="register-consent-terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1"
                />
                <span>I accept the Terms and Conditions.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                <input
                  id="register-consent-privacy"
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="mt-1"
                />
                <span>I accept the Privacy Policy.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !acceptedTerms || !acceptedPrivacy}
              className="w-full flex items-center justify-center py-3 px-4 bg-[#00C853] hover:bg-[#00C853]/90 text-white font-semibold rounded-lg shadow-lg shadow-[#00C853]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group mt-4"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-[#00C853] hover:text-green-600 font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
