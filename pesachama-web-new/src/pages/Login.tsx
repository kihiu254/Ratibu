import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import Seo from '../components/Seo'

export default function Login() {
  const savedEmail = localStorage.getItem('remember_me_email') ?? ''
  const [email, setEmail] = useState(savedEmail)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail))
  const [needsConsent, setNeedsConsent] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState('/dashboard')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const justRegistered = searchParams.get('registered') === '1'

  useEffect(() => {
    const loadExistingSession = async () => {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('kyc_status, terms_accepted_at, privacy_accepted_at')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.terms_accepted_at && profile?.privacy_accepted_at) return

      setPendingRedirect(profile?.kyc_status === 'not_started' ? '/onboarding' : '/dashboard')
      setNeedsConsent(true)
    }

    void loadExistingSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (rememberMe) {
        localStorage.setItem('remember_me_email', email)
      } else {
        localStorage.removeItem('remember_me_email')
      }

      const { data: profile } = await supabase
        .from('users')
        .select('kyc_status, terms_accepted_at, privacy_accepted_at')
        .eq('id', data.user!.id)
        .maybeSingle()

      const redirectTo = searchParams.get('redirectTo')
      const kycStatus = profile?.kyc_status ?? 'not_started'
      setPendingRedirect(redirectTo || (kycStatus === 'not_started' ? '/onboarding' : '/dashboard'))

      if (profile?.terms_accepted_at && profile?.privacy_accepted_at) {
        navigate(redirectTo || '/dashboard')
        return
      }

      setNeedsConsent(true)
      setLoading(false)
      return
    }
  }

  const handleConsentContinue = async () => {
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) return
    if (!acceptedTerms || !acceptedPrivacy) return

    setLoading(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('users')
        .update({ terms_accepted_at: now, privacy_accepted_at: now, updated_at: now })
        .eq('id', authUser.user.id)
      if (error) throw error
      setNeedsConsent(false)
      navigate(pendingRedirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consent')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first to reset your password.')
      return
    }
    
    setForgotPasswordLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) {
        throw error
      }

      setError('A password reset link has been sent to your email. Check your inbox!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <Seo
        title="Ratibu Chama Login"
        description="Sign in to Ratibu Chama to manage chamas, savings, loans, statements, KCB M-PESA, KPLC bills, and USSD banking."
        canonicalPath="/login"
        noIndex
      />
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
              Welcome Back
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Sign in to access your Ratibu account</p>
          </div>

          {justRegistered && (
            <div className="mb-6 p-4 rounded-xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#00C853] text-sm">
              Account created successfully. Please sign in to continue.
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[#00C853] focus:ring-[#00C853] border-slate-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-900 dark:text-slate-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotPasswordLoading}
                  className="font-medium text-[#00C853] hover:text-green-500 disabled:opacity-60"
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Forgot your password?'}
                </button>
              </div>
            </div>

            {!needsConsent ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 bg-[#00C853] hover:bg-[#00C853]/90 text-white font-semibold rounded-lg shadow-lg shadow-[#00C853]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">
                  Review the{' '}
                  <Link to="/consent" className="text-[#00C853] hover:underline">
                    consent summary
                  </Link>{' '}
                  before continuing.
                </p>
                <label className="flex items-start gap-3 text-sm text-slate-200">
                  <input
                    id="login-consent-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <span>I have read and accept the Terms and Conditions.</span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-200">
                  <input
                    id="login-consent-privacy"
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1"
                  />
                  <span>I have read and accept the Privacy Policy.</span>
                </label>
                <button
                  type="button"
                  onClick={handleConsentContinue}
                  disabled={loading || !acceptedTerms || !acceptedPrivacy}
                  className="w-full flex items-center justify-center py-3 px-4 bg-[#00C853] hover:bg-[#00C853]/90 text-white font-semibold rounded-lg shadow-lg shadow-[#00C853]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
                </button>
              </div>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#00C853] hover:text-green-600 font-medium hover:underline">
              Create an account
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
