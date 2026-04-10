import { useEffect, useRef, useState } from 'react'
import { Calendar, MapPin, Video, Plus, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from '../utils/toast'
import { format } from 'date-fns'

interface JitsiApi {
  addEventListener: (event: string, handler: () => void) => void
  dispose: () => void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>
    ) => JitsiApi
  }
}

interface Meeting {
  id: string
  created_by: string | null
  title: string
  description: string | null
  date: string
  venue: string | null
  video_link: string | null
  chama_id: string
  chamas: { name: string } | null
}

interface Chama { id: string; name: string }
interface MemberRow { chamas: Chama | Chama[] | null }

function firstChama(value: MemberRow['chamas']): Chama | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

function isOfflineError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('internet')
    || message.includes('socket')
}

function getMeetingErrorMessage(error: unknown) {
  if (isOfflineError(error)) {
    return 'No internet connection. Reconnect and try again.'
  }

  const message = getErrorMessage(error)
  const lower = message.toLowerCase()

  if (
    lower.includes('uniq_meetings_chama_date')
    || lower.includes('duplicate key value violates unique constraint')
  ) {
    return 'A meeting for this chama is already scheduled at that date and time. Choose a different time.'
  }

  return message || 'Failed to create meeting'
}

// ── Jitsi in-page room ────────────────────────────────────────────────────────
function JitsiRoom({ roomName, displayName, email, title, onClose }: {
  roomName: string
  displayName: string
  email: string
  title: string
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<JitsiApi | null>(null)

  useEffect(() => {
    function initJitsi() {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return

      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverrides: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          subject: title,
          disableDeepLinking: true,
          disableThirdPartyRequests: true,
        },
        interfaceConfigOverrides: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop',
            'fullscreen', 'settings', 'hangup', 'chat',
            'raisehand', 'tileview', 'select-background',
          ],
        },
        userInfo: { displayName, email },
      })

      apiRef.current.addEventListener('readyToClose', onClose)
    }

    // Load Jitsi script if not already loaded
    if (window.JitsiMeetExternalAPI) {
      initJitsi()
    } else {
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = initJitsi
      document.head.appendChild(script)
    }

    return () => {
      apiRef.current?.dispose()
    }
  }, [displayName, email, onClose, roomName, title])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00C853]/20 flex items-center justify-center">
            <Video className="w-4 h-4 text-[#00C853]" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{title}</p>
            <p className="text-slate-400 text-xs">Ratibu Meet · Powered by Jitsi</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-semibold"
        >
          <X className="w-4 h-4" /> Leave
        </button>
      </div>
      {/* Jitsi container */}
      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  )
}

// ── Create meeting modal ──────────────────────────────────────────────────────
function CreateMeetingModal({ chamas, onClose, onCreated }: {
  chamas: Chama[]
  onClose: () => void
  onCreated: () => void
}) {
  const [chamaId, setChamaId] = useState(chamas[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [isVirtual, setIsVirtual] = useState(false)
  const [venue, setVenue] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-generate Jitsi room URL from chamaId + date
  function generateJitsiUrl() {
    if (!chamaId || !date) return ''
    const slug = `ratibu-${chamaId.substring(0, 8)}-${date.replace(/-/g, '')}`
    return `https://meet.jit.si/${slug}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!chamaId) return toast.error('Select a chama')
    if (!date) return toast.error('Select a date')
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return toast.error('No internet connection. Reconnect and try again.')
    }

    setLoading(true)
    try {
      const datetime = new Date(`${date}T${time}:00`).toISOString()
      const videoLink = isVirtual ? generateJitsiUrl() : null
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be signed in to create a meeting')

      const { error } = await supabase.from('meetings').insert({
        chama_id: chamaId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        date: datetime,
        venue: isVirtual ? 'Online (Ratibu Meet)' : venue.trim(),
        video_link: videoLink,
      })
      if (error) throw error
      toast.success('Meeting scheduled!')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(getMeetingErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-[#00C853] transition-colors'
  const jitsiUrl = generateJitsiUrl()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Schedule Meeting</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="sr-only">Close schedule meeting dialog</span>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="meeting-chama" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Chama</label>
            <select id="meeting-chama" value={chamaId} onChange={e => setChamaId(e.target.value)} className={inputCls} required>
              {chamas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="meeting-title" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Meeting Title</label>
            <input id="meeting-title" value={title} onChange={e => setTitle(e.target.value)} className={inputCls}
              placeholder="e.g. Monthly Contributions Review" required />
          </div>

          <div>
            <label htmlFor="meeting-description" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Agenda / Description</label>
            <textarea id="meeting-description" value={description} onChange={e => setDescription(e.target.value)}
              className={inputCls} rows={3} placeholder="What will be discussed?" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="meeting-date" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Date</label>
              <input id="meeting-date" type="date" value={date} onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} className={inputCls} required />
            </div>
            <div>
              <label htmlFor="meeting-time" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Time</label>
              <input id="meeting-time" type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} required />
            </div>
          </div>

          {/* Virtual toggle */}
          <button
            type="button"
            onClick={() => setIsVirtual(!isVirtual)}
            aria-pressed={isVirtual}
            aria-label={isVirtual ? 'Disable virtual meeting' : 'Enable virtual meeting'}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
              isVirtual
                ? 'border-[#00C853]/40 bg-[#00C853]/5'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isVirtual ? 'bg-[#00C853]' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${isVirtual ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Virtual Meeting</p>
              <p className={`text-xs ${isVirtual ? 'text-[#00C853]' : 'text-slate-400'}`}>
                {isVirtual ? 'Powered by Ratibu Meet — no external app needed' : 'Enable for in-app video call'}
              </p>
            </div>
          </button>

          {/* Jitsi room preview */}
          {isVirtual && jitsiUrl && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#00C853]/5 border border-[#00C853]/20">
              <Video className="w-4 h-4 text-[#00C853] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#00C853]">Room auto-generated</p>
                <p className="text-xs text-slate-500 truncate">{jitsiUrl}</p>
              </div>
            </div>
          )}

          {/* Physical venue */}
          {!isVirtual && (
            <div>
              <label htmlFor="meeting-venue" className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Physical Venue</label>
              <input id="meeting-venue" value={venue} onChange={e => setVenue(e.target.value)} className={inputCls}
                placeholder="e.g. Community Hall, Nairobi" required={!isVirtual} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-[#00C853] text-white font-bold text-sm shadow-lg shadow-green-500/20 disabled:opacity-50">
              {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Meeting card ──────────────────────────────────────────────────────────────
function MeetingCard({ meeting: m, onJoin }: { meeting: Meeting; onJoin?: () => void }) {
  const isVirtual = !!m.video_link
  const date = new Date(m.date)
  const isPast = date < new Date()

  return (
    <div className={`p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">{m.title}</p>
          <p className="text-sm text-[#00C853] font-medium mt-0.5">{m.chamas?.name}</p>
          {m.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{m.description}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{format(date, 'MMM d, yyyy')}</p>
          <p className="text-xs text-slate-500">{format(date, 'h:mm a')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm text-slate-500 flex-1 min-w-0">
          {isVirtual
            ? <Video className="w-4 h-4 flex-shrink-0 text-[#00C853]" />
            : <MapPin className="w-4 h-4 flex-shrink-0" />}
          <span className="truncate">
            {isVirtual ? 'Ratibu Meet (in-app video)' : (m.venue || 'TBD')}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isVirtual && !isPast && onJoin && (
            <button
              onClick={onJoin}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00C853] text-white text-sm font-bold hover:bg-green-600 transition-colors shadow-sm shadow-green-500/20"
            >
              <Video className="w-3.5 h-3.5" /> Join
            </button>
          )}
          <Link to={`/chama/${m.chama_id}`}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Chama
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [chamas, setChamas] = useState<Chama[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeRoom, setActiveRoom] = useState<{ roomName: string; title: string } | null>(null)
  const [userInfo, setUserInfo] = useState({ displayName: 'Member', email: '' })
  const [searchParams] = useSearchParams()

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const roomName = searchParams.get('room')
    if (!roomName) return

    setActiveRoom({
      roomName,
      title: searchParams.get('title') ?? 'Meeting',
    })
  }, [searchParams])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get display name
      const { data: profile } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle()

      const displayName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : user.email ?? 'Member'
      setUserInfo({ displayName, email: user.email ?? '' })

      const { data: memberRows } = await supabase
        .from('chama_members')
        .select('chama_id, chamas(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const userChamas = ((memberRows || []) as MemberRow[])
        .map((row) => firstChama(row.chamas))
        .filter((chama): chama is Chama => Boolean(chama))
      setChamas(userChamas)

      const chamaIds = userChamas.map(c => c.id)
      if (chamaIds.length === 0) { setMeetings([]); return }

      const { data } = await supabase
        .from('meetings')
        .select('id, created_by, title, description, date, venue, video_link, chama_id, chamas(name)')
        .in('chama_id', chamaIds)
        .order('date', { ascending: true })

      setMeetings((data || []) as unknown as Meeting[])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  function joinMeeting(m: Meeting) {
    if (!m.video_link) return
    const roomName = m.video_link.split('/').pop() ?? m.id
    setActiveRoom({ roomName, title: m.title })
  }

  const now = new Date()
  const upcoming = meetings.filter(m => new Date(m.date) >= now)
  const past = meetings.filter(m => new Date(m.date) < now)

  return (
    <>
      {/* Jitsi full-screen room */}
      {activeRoom && (
        <JitsiRoom
          roomName={activeRoom.roomName}
          title={activeRoom.title}
          displayName={userInfo.displayName}
          email={userInfo.email}
          onClose={() => setActiveRoom(null)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        {showCreate && chamas.length > 0 && (
          <CreateMeetingModal
            chamas={chamas}
            onClose={() => setShowCreate(false)}
            onCreated={load}
          />
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Meetings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">All scheduled meetings across your chamas.</p>
          </div>
          <button
            onClick={() => chamas.length === 0 ? toast.info('Join a chama first.') : setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00C853] text-white font-bold text-sm shadow-lg shadow-green-500/20 hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Meeting
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00C853]" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-semibold">No meetings scheduled</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Schedule a meeting for any of your chamas.</p>
            {chamas.length > 0 && (
              <button onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-2xl bg-[#00C853] text-white font-bold text-sm">
                Schedule First Meeting
              </button>
            )}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Upcoming</h2>
                <div className="space-y-4">
                  {upcoming.map(m => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      onJoin={m.video_link ? () => joinMeeting(m) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Past</h2>
                <div className="space-y-4">
                  {past.map(m => <MeetingCard key={m.id} meeting={m} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
