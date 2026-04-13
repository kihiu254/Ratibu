import { useEffect } from 'react'
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from '../lib/site'

type SeoProps = {
  title?: string
  description?: string
  canonicalPath?: string
  keywords?: string[]
  noIndex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function setMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setProperty(property: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('property', property)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

export default function Seo({
  title = SITE_TITLE,
  description = SITE_DESCRIPTION,
  canonicalPath = '/',
  keywords = [],
  noIndex = false,
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
    document.title = fullTitle
    setMeta('description', description)
    setMeta('keywords', [...SITE_KEYWORDS, ...keywords].join(', '))
    setMeta('robots', noIndex ? 'noindex,nofollow' : 'index,follow')
    setMeta('theme-color', '#00C853')
    setProperty('og:type', 'website')
    setProperty('og:site_name', SITE_NAME)
    setProperty('og:title', fullTitle)
    setProperty('og:description', description)
    setProperty('og:url', `${SITE_URL}${canonicalPath}`)
    setProperty('og:image', `${SITE_URL}/logo.png`)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', description)
    setMeta('twitter:image', `${SITE_URL}/logo.png`)
    setCanonical(`${SITE_URL}${canonicalPath}`)

    const scriptId = 'ratibu-jsonld'
    const existing = document.getElementById(scriptId)
    if (existing) existing.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }
  }, [canonicalPath, description, jsonLd, keywords, noIndex, title])

  return null
}
