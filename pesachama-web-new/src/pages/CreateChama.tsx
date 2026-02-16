import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Users, FileText, Calendar, DollarSign, Loader2, Plus, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '../components/Navbar'

export default function CreateChama() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    meetingFrequency: 'monthly',
    contributionAmount: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const user = (await supabase.auth.getUser()).data.user
    if (!user) {
      setError('You must be logged in to create a Chama')
      setLoading(false)
      return
    }

    // 1. Create Chama
    const { data: chama, error: chamaError } = await supabase
      .from('chamas')
      .insert([
        {
          name: formData.name,
          description: formData.description,
          created_by: user.id,
          contribution_amount: parseFloat(formData.contributionAmount),
          contribution_frequency: formData.meetingFrequency, // and renaming this as per schema
        },
      ])
      .select()
      .single()

    if (chamaError) {
      setError(chamaError.message)
      setLoading(false)
      return
    }

    // 2. Add Creator as Admin Member
    const { error: memberError } = await supabase
      .from('chama_members')
      .insert([
        {
          chama_id: chama.id,
          user_id: user.id,
          role: 'admin',
        },
      ])

    if (memberError) {
      setError('Chama created but failed to add you as member: ' + memberError.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-20"
        >
          <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Create New Chama</h2>
            <p className="text-slate-600 dark:text-slate-400">Set up your savings group and invite members</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Chama Name</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                    placeholder="e.g. Nairobi Savers Group"
                    required
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white resize-none"
                    placeholder="What is this group about?"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Meeting Frequency</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <select
                    name="meetingFrequency"
                    value={formData.meetingFrequency}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all text-slate-900 dark:text-slate-200 appearance-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Contribution Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
                  <input
                    name="contributionAmount"
                    type="number"
                    value={formData.contributionAmount}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white"
                    placeholder="e.g. 1000"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 bg-[#00C853] hover:bg-[#00C853]/90 text-white font-semibold rounded-lg shadow-lg shadow-[#00C853]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5" />
                    Create Chama Group
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
