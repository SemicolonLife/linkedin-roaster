// Vercel Edge Function — validates a LinkedIn URL, follows short-link redirects,
// and attempts to scrape the public profile page for Claude to analyse.
export const config = { runtime: 'edge' }

const KNOWN_SHORT_DOMAINS = ['lnkd.in', 'linkedin.com', 'linked.in']

function isLinkedInUrl(url) {
  try {
    const { hostname } = new URL(url)
    return hostname === 'www.linkedin.com' || hostname === 'linkedin.com'
  } catch {
    return false
  }
}

function normaliseLinkedInUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'linkedin.com') parsed.hostname = 'www.linkedin.com'
    return parsed.toString()
  } catch {
    return url
  }
}

function isPossibleShortUrl(url) {
  try {
    const { hostname } = new URL(url)
    return KNOWN_SHORT_DOMAINS.some((d) => hostname.endsWith(d))
  } catch {
    return false
  }
}

async function resolveRedirects(url, maxHops = 10) {
  let current = url
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkedInRoaster/1.0)' },
    })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString()
    } else {
      break
    }
  }
  return current
}

async function scrapeLinkedInProfile(profileUrl) {
  const res = await fetch(profileUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const html = await res.text()

  const ogTitle = html.match(/property="og:title"[^>]+content="([^"]+)"/)?.[1] || ''
  const ogDesc = html.match(/property="og:description"[^>]+content="([^"]+)"/)?.[1] || ''

  let structuredText = ''
  const ldJsonBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of ldJsonBlocks) {
    try {
      const obj = JSON.parse(block[1])
      if (obj['@type'] === 'Person' || obj.name) {
        if (obj.name) structuredText += `Name: ${obj.name}\n`
        if (obj.jobTitle) structuredText += `Headline: ${obj.jobTitle}\n`
        if (obj.description) structuredText += `About: ${obj.description}\n`
        if (obj.worksFor) {
          const e = Array.isArray(obj.worksFor) ? obj.worksFor[0] : obj.worksFor
          structuredText += `Current employer: ${e?.name || ''}\n`
        }
        if (obj.alumniOf) {
          const s = Array.isArray(obj.alumniOf) ? obj.alumniOf : [obj.alumniOf]
          structuredText += `Education: ${s.map((x) => x.name || x).join(', ')}\n`
        }
      }
    } catch { /* skip */ }
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000)

  const combined = [
    ogTitle && `Headline: ${ogTitle}`,
    ogDesc && `Summary: ${ogDesc}`,
    structuredText,
    bodyText.length > 200 ? `Profile content:\n${bodyText}` : '',
  ].filter(Boolean).join('\n\n')

  if (combined.length < 80) throw new Error('Insufficient data')
  return combined
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  let { url } = body
  if (!url) return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  url = url.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url

  try {
    if (!isLinkedInUrl(url)) {
      if (!isPossibleShortUrl(url)) {
        return new Response(JSON.stringify({ error: 'URL does not appear to be a LinkedIn link.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      url = await resolveRedirects(url)
    }

    if (!isLinkedInUrl(url)) {
      return new Response(JSON.stringify({ error: `Resolved URL does not point to LinkedIn (got: ${url}).` }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    url = normaliseLinkedInUrl(url)

    let profileText = '', scraped = true
    try {
      profileText = await scrapeLinkedInProfile(url)
    } catch (e) {
      scraped = false
      console.warn('Scrape failed:', e.message)
    }

    return new Response(JSON.stringify({
      resolvedUrl: url,
      profileText,
      scraped,
      scrapeMessage: scraped
        ? 'Profile content fetched successfully.'
        : 'Could not automatically fetch your profile. Please paste your profile text below.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
