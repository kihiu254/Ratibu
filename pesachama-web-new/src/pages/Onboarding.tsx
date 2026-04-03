import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ArrowRight, UserCircle, Rocket, Loader2 } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to send security code'
}

export default function Onboarding() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleProceed = async () => {
    if (!user?.email) {
      toast.error('User email not found')
      return
    }

    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('otp_verified_at, terms_accepted_at, privacy_accepted_at')
        .eq('id', user.id)
        .maybeSingle()

      if (!acceptedTerms || !acceptedPrivacy) {
        toast.error('Please accept the Terms and Conditions and Privacy Policy before continuing')
        return
      }

      const legalAccepted = Boolean(profile?.terms_accepted_at && profile?.privacy_accepted_at)

      if (profile?.otp_verified_at) {
        toast.success('Email already verified')
        if (!legalAccepted) {
          const now = new Date().toISOString()
          const { error: consentError } = await supabase
            .from('users')
            .update({ terms_accepted_at: now, privacy_accepted_at: now, updated_at: now })
            .eq('id', user.id)
          if (consentError) throw consentError
        }
        navigate('/membership-kyc')
        return
      }

      if (!legalAccepted) {
        const now = new Date().toISOString()
        const { error: consentError } = await supabase
          .from('users')
          .update({ terms_accepted_at: now, privacy_accepted_at: now, updated_at: now })
          .eq('id', user.id)
        if (consentError) throw consentError
      }

      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { 
          email: user.email,
          userId: user.id,
          fullName: user.user_metadata?.full_name || 'Member',
          purpose: 'onboarding'
        }
      })

      if (error) throw error
      if (data?.verified) {
        toast.success('Email already verified')
        navigate('/membership-kyc')
        return
      }

      const alreadySent = data?.alreadySent
      toast.success(alreadySent ? 'Security code already sent. Check your email' : 'Security code sent to your email')
      navigate('/verify-otp')
    } catch (error) {
      console.error('Error sending OTP:', error)
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30">
      <div className="flex items-center justify-center min-h-screen px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-[#00C853] to-green-600 p-8 text-white text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4"
            >
              <CheckCircle2 className="w-10 h-10" />
            </motion.div>
            <h1 className="text-3xl font-black mb-2">Account Created!</h1>
            <p className="text-white/80">Welcome to Ratibu. Your journey to better financial management starts here.</p>
          </div>

          <div className="p-8 md:p-12 text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="w-12 h-12 bg-[#00C853]/10 rounded-xl flex items-center justify-center text-[#00C853] mb-4 mx-auto">
                    <UserCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold mb-2">Complete Profile</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add your KYC details to unlock all features as a verified member.</p>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-4 mx-auto">
                    <Rocket className="w-6 h-6" />
                </div>
                <h3 className="font-bold mb-2">Create Chama</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Start a new group or join an existing one to grow your wealth.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-left p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I accept the <Link to="/legal/terms" className="text-[#00C853] font-bold">Terms and Conditions</Link>.
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 mt-3">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I accept the <Link to="/legal/privacy" className="text-[#00C853] font-bold">Privacy Policy</Link>.
                  </span>
                </label>
              </div>

              <button
                onClick={handleProceed}
                disabled={loading || !acceptedTerms || !acceptedPrivacy}
                className="w-full flex items-center justify-center py-4 px-6 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all group scale-105 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    PROCEED TO MEMBERS PROFILE
                    <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
