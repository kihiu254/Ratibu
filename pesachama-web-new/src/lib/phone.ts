export function normalizeKenyanPhone(value: string): string | null {
  const trimmed = value.trim().replace(/[\s\-()]/g, '')
  if (!trimmed) return null

  const stripped = trimmed.replace(/^(tel:|whatsapp:)/i, '')
  const digitsOnly = stripped.replace(/[^\d+]/g, '')

  if (/^\+254\d{9}$/.test(digitsOnly)) return `254${digitsOnly.slice(-9)}`
  if (/^254\d{9}$/.test(digitsOnly)) return digitsOnly
  if (/^0\d{9}$/.test(digitsOnly)) return `254${digitsOnly.slice(1)}`
  if (/^\d{9}$/.test(digitsOnly)) return `254${digitsOnly}`

  return digitsOnly || null
}

export function getKenyanPhoneVariants(value: string): string[] {
  const normalized = normalizeKenyanPhone(value)
  const raw = value.trim().replace(/[\s\-()]/g, '')
  const variants = new Set<string>([raw])

  if (normalized) {
    variants.add(normalized)
    variants.add(`+${normalized}`)
    variants.add(`0${normalized.slice(3)}`)
  }

  if (raw.startsWith('+')) {
    variants.add(raw.slice(1))
  }

  return Array.from(variants).filter(Boolean)
}
