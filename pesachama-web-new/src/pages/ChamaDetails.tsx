import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  Users, 
  Wallet, 
  Calendar, 
  Bell, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  MoreVertical,
  CheckCircle2,
  Clock,
  Video,
  MapPin,
  ExternalLink
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'

type TabType = 'overview' | 'members' | 'meetings' | 'prompts'

export default function ChamaDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [prompts, setPrompts] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('member')
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchChamaDetails()
      fetchMeetings()
      fetchPrompts()
    }
  }, [id])

  async function fetchChamaDetails() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch chama details
      const { data: chama, error } = await supabase
        .from('chamas')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // Fetch members & user role
      const { data: members, error: membersError } = await supabase
        .from('chama_members')
        .select('*, users:user_id(first_name, last_name, phone)')
        .eq('chama_id', id)

      if (membersError) throw membersError

      const currentUserMember = members.find(m => m.user_id === user.id)
      setUserRole(currentUserMember?.role || 'member')

      setData({ ...chama, members })
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMeetings() {
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .eq('chama_id', id)
      .order('date', { ascending: true })
    setMeetings(data || [])
  }

  async function fetchPrompts() {
    const { data } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('chama_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setPrompts(data || [])
  }

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null)

  const handlePayClick = (prompt: any) => {
      setSelectedPrompt(prompt)
      setPaymentModalOpen(true)
  }

  const handleProcessPayment = async (phoneNumber: string) => {
    if (!selectedPrompt) return

    try {
      setPaymentLoading(selectedPrompt.id)
      setPaymentModalOpen(false)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.functions.invoke('trigger-stk-push', {
        body: {
          amount: selectedPrompt.amount,
          phoneNumber: phoneNumber,
          userId: user.id,
          chamaId: id
        }
      })

      if (error) throw error
      alert('STK Push mapping initiated! Please check your phone.')
    } catch (err: any) {
      alert('Payment failed: ' + err.message)
    } finally {
      setPaymentLoading(null)
      setSelectedPrompt(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  if (!data) return <div className="p-8 text-center text-slate-500">Chama not found.</div>

  const isAdmin = userRole === 'admin' || userRole === 'treasurer'

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/chamas')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Chamas
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{data.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase border ${
                isAdmin 
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}>
                {userRole}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">{data.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => handlePayClick({ amount: data.contribution_amount, id: 'general', title: 'Manual Deposit' })}
                className="px-6 py-2.5 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
            >
                <Wallet className="w-4 h-4" />
                Deposit
            </button>
            {isAdmin && (
              <button className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400">
                <MoreVertical className="w-5 h-5" />
              </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: Wallet },
          { id: 'members', label: 'Members', icon: Users },
          { id: 'meetings', label: 'Meetings', icon: Calendar },
          { id: 'prompts', label: 'Prompts', icon: Bell }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
              activeTab === tab.id 
                ? 'text-[#00C853]' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00C853]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Group Balance</h3>
                            <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                KES {data.balance?.toLocaleString()}
                            </div>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Members</h3>
                            <div className="text-3xl font-bold text-slate-900 dark:text-white">
                                {data.members?.length} / {data.member_limit}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Financial Guidelines</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 dark:text-slate-400">Contribution Frequency</span>
                                <span className="font-bold text-slate-900 dark:text-white capitalize">{data.contribution_frequency}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 dark:text-slate-400">Target Amount</span>
                                <span className="font-bold text-slate-900 dark:text-white font-mono text-green-500">KES {data.contribution_amount?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-[#00C853]/10 to-green-600/5 rounded-2xl border border-[#00C853]/20">
                        <h3 className="text-sm font-bold text-[#00C853] uppercase tracking-wider mb-3">Group Admin</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-[#00C853] flex items-center justify-center text-white font-bold text-xl">
                                {data.members?.find((m:any) => m.role === 'admin')?.users?.first_name?.[0] || 'A'}
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {data.members?.find((m:any) => m.role === 'admin')?.users?.first_name || 'Admin'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Founder & Chairman</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Member</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Role</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Joined</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Contribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.members?.map((member: any) => (
                            <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                                            {member.users?.first_name?.[0] || 'U'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {member.users?.first_name} {member.users?.last_name}
                                            </div>
                                            <div className="text-xs text-slate-500">{member.users?.phone}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                        member.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {member.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {format(new Date(member.joined_at), 'MMM d, yyyy')}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                    KES {member.total_contribution?.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Chama Meetings</h2>
                    {isAdmin && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
                            <Plus className="w-4 h-4" />
                            Schedule Meeting
                        </button>
                    )}
                </div>

                {meetings.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No meetings scheduled</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-6">Stay tuned for group updates and schedule a voice or physical sync.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {meetings.map((meeting) => (
                            <div key={meeting.id} className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-green-500/10 rounded-xl text-[#00C853]">
                                        <Calendar className="w-6 h-6" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">{format(new Date(meeting.date), 'MMM d')}</div>
                                        <div className="text-xs text-slate-500">{format(new Date(meeting.date), 'p')}</div>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{meeting.title}</h3>
                                <p className="text-sm text-slate-500 mb-6 line-clamp-2">{meeting.description || 'No agenda provided.'}</p>
                                
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        {meeting.video_link ? (
                                            <><Video className="w-4 h-4" /> Virtual</>
                                        ) : (
                                            <><MapPin className="w-4 h-4" /> {meeting.venue || 'Physical'}</>
                                        )}
                                    </div>
                                    {meeting.video_link && (
                                        <a href={meeting.video_link} target="_blank" className="text-xs font-bold text-[#00C853] flex items-center gap-1 hover:underline">
                                            Join Now <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          )}

            {activeTab === 'prompts' && (
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Payment Requests</h2>
                    {isAdmin && (
                        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
                            <Bell className="w-4 h-4" />
                            New Prompt
                        </button>
                    )}
                </div>

                {prompts.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <CheckCircle2 className="w-12 h-12 text-[#00C853] mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">All Clear!</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">There are no pending group-wide payment requests at this time.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prompts.map((prompt) => (
                            <PromptCard key={prompt.id} prompt={prompt} onPay={handlePayClick} loading={paymentLoading === prompt.id} />
                        ))}
                    </div>
                )}
             </div>
          )}
        </motion.div>
      </AnimatePresence>

      {paymentModalOpen && selectedPrompt && (
        <PaymentModal 
            isOpen={paymentModalOpen} 
            onClose={() => setPaymentModalOpen(false)} 
            onConfirm={handleProcessPayment} 
            amount={selectedPrompt.amount}
            title={selectedPrompt.title}
        />
      )}
    </div>
  )
}

function PromptCard({ prompt, onPay, loading }: { prompt: any, onPay: (p: any) => void, loading: boolean }) {
    const [showContributors, setShowContributors] = useState(false)
    const [contributors, setContributors] = useState<any[]>([])
    const [loadingContributors, setLoadingContributors] = useState(false)

    const fetchContributors = async () => {
        if (!showContributors && contributors.length === 0) {
            setLoadingContributors(true)
            const { data, error } = await supabase.rpc('get_payment_prompt_status', { prompt_id: prompt.id })
            if (!error && data) {
                setContributors(data)
            }
            setLoadingContributors(false)
        }
        setShowContributors(!showContributors)
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{prompt.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="text-sm font-bold text-green-500">KES {prompt.amount?.toLocaleString()}</div>
                            {prompt.due_date && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    Due {format(new Date(prompt.due_date), 'MMM d, yyyy')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchContributors}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        {showContributors ? 'Hide Status' : 'View Status'}
                    </button>
                    <button
                        onClick={() => onPay(prompt)}
                        disabled={loading}
                        className="px-8 py-2.5 bg-[#00C853] hover:bg-green-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[120px]"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            'Pay Now'
                        )}
                    </button>
                </div>
            </div>

            {showContributors && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 p-4">
                    {loadingContributors ? (
                         <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400"/></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {contributors.map((c) => (
                                <div key={c.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                    <div className={`w-2 h-2 rounded-full ${c.status === 'paid' ? 'bg-green-500' : 'bg-red-400'}`} />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex-1 truncate">
                                        {c.first_name} {c.last_name}
                                    </span>
                                    {c.status === 'paid' && (
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function PaymentModal({ isOpen, onClose, onConfirm, amount, title }: { isOpen: boolean, onClose: () => void, onConfirm: (phone: string) => void, amount: number, title: string }) {
    const [phoneNumber, setPhoneNumber] = useState('')
    const [useMyNumber, setUseMyNumber] = useState(true)
    const [myNumber, setMyNumber] = useState('')

    useEffect(() => {
        // Fetch user number
        const fetchUserNumber = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase.from('users').select('phone').eq('id', user.id).single()
                if (data?.phone) {
                    setMyNumber(data.phone.replace('+', ''))
                    setPhoneNumber(data.phone.replace('+', ''))
                }
            }
        }
        fetchUserNumber()
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onConfirm(phoneNumber)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
                <div>
                     <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Payment</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="text-sm text-slate-500 mb-1">Payment for</div>
                            <div className="font-bold text-slate-900 dark:text-white">{title}</div>
                            <div className="mt-2 text-2xl font-bold text-green-500">KES {amount?.toLocaleString()}</div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                            
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input 
                                        type="radio" 
                                        checked={useMyNumber} 
                                        onChange={() => {
                                            setUseMyNumber(true)
                                            setPhoneNumber(myNumber)
                                        }}
                                        className="w-4 h-4 text-[#00C853] focus:ring-[#00C853]"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-900 dark:text-white">My Number</div>
                                        <div className="text-xs text-slate-500">{myNumber || 'Not set'}</div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input 
                                        type="radio" 
                                        checked={!useMyNumber} 
                                        onChange={() => {
                                            setUseMyNumber(false)
                                            setPhoneNumber('')
                                        }}
                                        className="w-4 h-4 text-[#00C853] focus:ring-[#00C853]"
                                    />
                                    <div className="font-medium text-slate-900 dark:text-white">Other Number</div>
                                </label>
                            </div>

                            {!useMyNumber && (
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="2547..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-[#00C853] focus:border-transparent outline-none transition-all"
                                    required
                                    pattern="^254\d{9}$"
                                />
                            )}
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit"
                                className="w-full py-3 px-4 bg-[#00C853] hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20"
                            >
                                Pay KES {amount?.toLocaleString()}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    )
}
