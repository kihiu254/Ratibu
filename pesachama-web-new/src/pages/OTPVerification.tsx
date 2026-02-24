import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from '../utils/toast'
import Navbar from '../components/Navbar'

export default function OTPVerification() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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

    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setLoading(false)
      toast.success('OTP Verified!')
      navigate('/membership-kyc')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#00C853]/30">
      <Navbar />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 pt-32 pb-12">
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
              <button className="text-[#00C853] font-bold hover:underline">Resend Code</button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
