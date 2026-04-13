import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import Seo from '../components/Seo'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    const handleRecoveryLink = async () => {
      const code = searchParams.get('code')
      const token = searchParams.get('token')
      const type = searchParams.get('type')

      if (type === 'recovery' && code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setError(error.message)
        }
        return
      }

      if (token) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        })
        if (error) {
          setError(error.message)
        }
      }
    }

    void handleRecoveryLink()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/login?reset=1'), 1500)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <Seo
        title="Ratibu Chama Reset Password"
        description="Reset your Ratibu Chama password securely and return to your account."
        canonicalPath="/reset-password"
        noIndex
      />
      <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 relative overflow-hidden py-12">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 dark:bg-slate-950/60 z-10 backdrop-blur-[2px] transition-colors duration-300" />
          <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-100">
            <source src="/African_Digital_Finance_Animation.mp4" type="video/mp4" />
          </video>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/70 backdrop-blur-md dark:bg-slate-900/50 dark:backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-20"
        >
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-[#00C853] dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00C853] to-green-600 bg-clip-text text-transparent">
              Reset Password
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Choose a new password for your Ratibu account.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="p-6 rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#00C853]" />
              <p className="mt-4 text-[#00C853] font-semibold">Password updated successfully.</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Redirecting you to login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                    placeholder="Repeat new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 bg-[#00C853] hover:bg-[#00C853]/90 text-white font-semibold rounded-lg shadow-lg shadow-[#00C853]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
