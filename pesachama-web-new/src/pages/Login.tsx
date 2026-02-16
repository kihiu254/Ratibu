import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const savedEmail = localStorage.getItem('remember_me_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (rememberMe) {
        localStorage.setItem('remember_me_email', email)
      } else {
        localStorage.removeItem('remember_me_email')
      }
      
      const redirectTo = searchParams.get('redirectTo') || '/dashboard'
      navigate(redirectTo)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30 transition-colors duration-300">
      <Navbar />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8 relative overflow-hidden pt-32 pb-12">
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
          className="w-full max-w-md bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-20"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00C853] to-green-600 bg-clip-text text-transparent">
              Welcome Back
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Sign in to access your Ratibu account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                <input
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
                <a href="#" className="font-medium text-[#00C853] hover:text-green-500">
                  Forgot your password?
                </a>
              </div>
            </div>

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
