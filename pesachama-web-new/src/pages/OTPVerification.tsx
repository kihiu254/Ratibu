import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'

export default function OTPVerification() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('users')
        .select('otp_verified_at')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.otp_verified_at) {
        navigate('/membership-kyc')
      }
    }
    getUser()
  }, [])

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))])

    // Focus next input
    if (element.nextSibling && element.value !== '') {
      (element.nextSibling as HTMLInputElement).focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        const prevInput = (e.currentTarget.previousSibling as HTMLInputElement)
        prevInput.focus()
      }
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpString = otp.join('')
    if (otpString.length < 6) {
      toast.error('Please enter the full 6-digit code')
      return
    }

    if (!user?.email) {
      toast.error('User email not found')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          email: user.email,
          code: otpString,
          purpose: 'onboarding'
        }
      })

      if (error) throw error

      if (!user?.id) {
        throw new Error('User not found')
      }
      const verifiedAt = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('users')
        .update({ otp_verified_at: verifiedAt, updated_at: verifiedAt })
        .eq('id', user.id)
      if (updateError) throw updateError

      toast.success('OTP Verified!')
      
      // Update local storage or session if needed, then navigate
      navigate('/membership-kyc')
    } catch (error: any) {
      console.error('Error verifying OTP:', error)
      toast.error(error.message || 'Verification failed. Please check the code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!user?.email) return

    setResending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { 
          email: user.email,
          userId: user.id,
          fullName: user.user_metadata?.full_name || 'Member',
          purpose: 'onboarding',
          force: true
        }
      })

      if (error) throw error
      if (data?.verified) {
        toast.success('Email already verified')
        navigate('/membership-kyc')
        return
      }
      toast.success('New security code sent!')
      setOtp(['', '', '', '', '', ''])
    } catch (error: any) {
      console.error('Error resending OTP:', error)
      toast.error('Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30">
      <div className="flex items-center justify-center min-h-screen px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl"
        >
          <button 
            onClick={() => navigate(-1)}
            className="p-2 mb-6 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#00C853]/10 rounded-2xl flex items-center justify-center text-[#00C853] mb-4 mx-auto">
                <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black">Security Verification</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              We've sent a 6-digit access code to your registered email address
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-8">
            <div className="flex justify-between gap-2">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={1}
                  value={data}
                  onChange={e => handleChange(e.target, index)}
                  onKeyDown={e => handleKeyDown(e, index)}
                  className="w-12 h-14 text-center text-xl font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-[#00C853] focus:ring-4 focus:ring-[#00C853]/10 outline-none transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#00C853] hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'VERIFY & PROCEED'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Didn't receive the code?{' '}
              <button 
                onClick={handleResend}
                disabled={resending}
                className="text-[#00C853] font-bold hover:underline disabled:opacity-50"
              >
                {resending ? 'Resending...' : 'Resend Code'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
