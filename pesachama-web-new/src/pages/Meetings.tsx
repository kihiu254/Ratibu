import { useEffect, useState } from 'react'
import { Calendar, MapPin, Video, Plus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notifyAudience } from '../lib/notify'
import { toast } from '../utils/toast'
import { format } from 'date-fns'
import { normalizeMeetingLink, openMeetingLink } from '../lib/meetingLink'

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

// €€ Create meeting modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [meetingLink, setMeetingLink] = useState('')
  const [loading, setLoading] = useState(false)

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
      const videoLink = isVirtual ? normalizeMeetingLink(meetingLink) : null
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be signed in to create a meeting')

      const { error } = await supabase.from('meetings').insert({
        chama_id: chamaId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        date: datetime,
        venue: isVirtual ? 'Online (Google Meet)' : venue.trim(),
        video_link: videoLink,
      })
      if (error) throw error
      const chamaName = chamas.find((item) => item.id === chamaId)?.name || 'Chama'
      void notifyAudience({
        audience: 'chama_members',
        chamaId,
        title: `${chamaName} meeting scheduled`,
        message: `${title.trim()} is scheduled for ${format(new Date(datetime), 'PPP p')}.`,
        type: 'info',
        link: '/meetings',
        emailSubject: `${chamaName} meeting scheduled`,
      }).catch(() => {})
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
            aria-label={isVirtual ? 'Disable Google Meet Meeting' : 'Enable Google Meet Meeting'}
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Google Meet Meeting</p>
              <p className={`text-xs ${isVirtual ? 'text-[#00C853]' : 'text-slate-400'}`}>
                {isVirtual ? 'Paste the Google Meet link for this meeting.' : 'Enable to attach a Google Meet link'}
              </p>
            </div>
          </button>

          {isVirtual && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#00C853]/5 border border-[#00C853]/20">
              <Video className="w-4 h-4 text-[#00C853] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#00C853]">Google Meet link required</p>
                <input
                  value={meetingLink}
                  onChange={e => setMeetingLink(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-[#00C853]"
                  placeholder="https://meet.google.com/..."
                />
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

// â”€â”€ Meeting card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          {isVirtual && onJoin && (
            <button
              onClick={onJoin}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#00C853] text-white text-sm font-bold hover:bg-green-600 transition-colors shadow-sm shadow-green-500/20"
            >
              <Video className="w-3.5 h-3.5" /> {isPast ? 'Rejoin' : 'Join'}
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

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [chamas, setChamas] = useState<Chama[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
    openMeetingLink(m.video_link)
  }

  const now = new Date()
  const upcoming = meetings.filter(m => new Date(m.date) >= now)
  const past = meetings.filter(m => new Date(m.date) < now)

  return (
    <>
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
                  {past.map(m => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      onJoin={m.video_link ? () => joinMeeting(m) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}



