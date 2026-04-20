export function normalizeMeetingLink(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  try {
    const url = new URL(trimmed)
    return url.toString()
  } catch {
    return trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`
  }
}

export function openMeetingLink(link: string) {
  const url = normalizeMeetingLink(link)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
