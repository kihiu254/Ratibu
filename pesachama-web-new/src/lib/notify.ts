import { supabase } from './supabase'

type NotifyPayload = {
  targetUserId: string
  title: string
  message: string
  type?: string
  link?: string | null
  emailSubject?: string
  emailHtml?: string
}

export async function notifyUser(payload: NotifyPayload) {
  const { error } = await supabase.functions.invoke('notify-user', {
    body: {
      type: payload.type ?? 'info',
      ...payload,
    },
  })

  if (error) throw error
}

type NotifyAudiencePayload = {
  audience: 'admins' | 'chama_admins' | 'chama_members'
  title: string
  message: string
  type?: string
  link?: string | null
  chamaId?: string
  emailSubject?: string
  emailHtml?: string
}

export async function notifyAudience(payload: NotifyAudiencePayload) {
  const { error } = await supabase.functions.invoke('notify-audience', {
    body: {
      type: payload.type ?? 'info',
      ...payload,
    },
  })

  if (error) throw error
}
