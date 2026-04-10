// Local dev server — mirrors the Vercel Edge Function for local testing.
// Run via `npm run dev` (concurrently starts this + vite).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually (Vite loads it for the frontend, but not for Node scripts)
function loadEnv() {
  try {
    const envPath = resolve(__dirname, '.env.local')
    const lines = readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
  } catch {
    // .env.local not found — rely on environment variables already set
  }
}

loadEnv()

const PORT = 3004
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'

const SYSTEM_ROAST = `You are a brutally honest but warm career coach who speaks like a confident Gen Z comedian.
Analyze the LinkedIn profile provided and roast each section — be funny, sharp, and specific.
Never attack the person, only the profile content. Always end each section with one genuine improvement tip.
Keep the tone entertaining but never mean-spirited or offensive.`

const SYSTEM_SERIOUS = `You are a senior recruiter at a top-tier tech company with 15 years of hiring experience.
Analyze this LinkedIn profile section-by-section with precision and candor.
Identify specific weaknesses and provide a rewritten version of each weak section.
Be direct, professional, and actionable.`

function buildPrompt(profileText, mode, tone, targetRole) {
  const toneLabel = { gentle: 'Gentle and encouraging', medium: 'Medium intensity', savage: 'Full Savage — no mercy' }[tone] || 'Medium intensity'
  const roleNote = targetRole ? `The user is targeting the role: "${targetRole}". Factor this into your analysis.` : ''

  const outputSchema = `
Return ONLY valid JSON with this exact shape:
{
  "overall_score": <number 0-100>,
  "share_summary": "<one punchy sentence about this profile>",
  "sections": [
    {
      "name": "<Headline | About | Experience | Skills>",
      "score": <number 0-10>,
      "roast": "<comedic critique — present only in roast/both mode>",
      "tip": "<one actionable improvement>",
      "rewrite": "<a rewritten version of this section — present only in serious/both mode>"
    }
  ]
}`

  if (mode === 'roast') return `Roast intensity: ${toneLabel}. ${roleNote}\n\nProfile:\n${profileText}\n\n${outputSchema}`
  if (mode === 'serious') return `${roleNote}\n\nProfile:\n${profileText}\n\n${outputSchema}`
  return `Roast intensity: ${toneLabel}. ${roleNote}\nProvide both a roast AND a serious audit for each section.\n\nProfile:\n${profileText}\n\n${outputSchema}`
}

async function handleRoast(req, res) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'CLAUDE_API_KEY not set in .env.local' }))
    return
  }

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    return
  }

  const { profileText, mode = 'both', tone = 'medium', targetRole = '' } = body

  if (!profileText || profileText.trim().length < 100) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Profile text is too short.' }))
    return
  }

  const systemPrompt = mode === 'serious' ? SYSTEM_SERIOUS : SYSTEM_ROAST

  try {
    const claudeRes = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: buildPrompt(profileText, mode, tone, targetRole) }],
      }),
    })

    const claudeData = await claudeRes.json()

    if (!claudeRes.ok) {
      console.error('Claude error:', claudeData)
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Claude API error. Check your API key.' }))
      return
    }

    const rawContent = claudeData?.content?.[0]?.text ?? ''
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unexpected AI response format.' }))
      return
    }

    const parsed = JSON.parse(jsonMatch[0])
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(parsed))
  } catch (err) {
    console.error('Server error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
}

// ── URL resolution + LinkedIn profile scraping ──────────────────────────────

const LINKEDIN_ORIGIN = 'https://www.linkedin.com'

// Common short-URL domains that may redirect to LinkedIn
const KNOWN_SHORT_DOMAINS = ['lnkd.in', 'linkedin.com', 'linked.in']

function isLinkedInUrl(url) {
  try {
    const parsed = new URL(url)
    // Accept www.linkedin.com and linkedin.com
    return parsed.hostname === 'www.linkedin.com' || parsed.hostname === 'linkedin.com'
  } catch {
    return false
  }
}

function normaliseLinkedInUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'linkedin.com') {
      parsed.hostname = 'www.linkedin.com'
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function isPossibleShortUrl(url) {
  try {
    const parsed = new URL(url)
    return KNOWN_SHORT_DOMAINS.some((d) => parsed.hostname.endsWith(d))
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
    if ((res.status >= 300 && res.status < 400) && location) {
      // Handle relative redirects
      current = new URL(location, current).toString()
    } else {
      break
    }
  }
  return current
}

// Scrape public LinkedIn profile page and extract readable text
async function scrapeLinkedInProfile(profileUrl) {
  const res = await fetch(profileUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
  })

  if (!res.ok) {
    throw new Error(`Could not fetch profile page (HTTP ${res.status}). LinkedIn may be blocking the request.`)
  }

  const html = await res.text()

  // Extract meta and structured data for signal
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] || ''
  const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] || ''
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || ''

  // Try to pull ld+json structured data
  let structuredText = ''
  const ldJsonBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of ldJsonBlocks) {
    try {
      const obj = JSON.parse(block[1])
      if (obj['@type'] === 'Person' || obj.name) {
        structuredText += `Name: ${obj.name || ''}\n`
        if (obj.jobTitle) structuredText += `Title: ${obj.jobTitle}\n`
        if (obj.description) structuredText += `About: ${obj.description}\n`
        if (obj.worksFor) {
          const employer = Array.isArray(obj.worksFor) ? obj.worksFor[0] : obj.worksFor
          structuredText += `Current employer: ${employer?.name || ''}\n`
        }
        if (obj.alumniOf) {
          const schools = Array.isArray(obj.alumniOf) ? obj.alumniOf : [obj.alumniOf]
          structuredText += `Education: ${schools.map((s) => s.name || s).join(', ')}\n`
        }
      }
    } catch {
      // skip malformed JSON
    }
  }

  // Strip HTML tags from the body for fallback text extraction
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000)

  // Combine all signals
  const combined = [
    ogTitle && `Headline: ${ogTitle}`,
    ogDesc && `Summary: ${ogDesc}`,
    structuredText,
    bodyText.length > 200 ? `Profile content:\n${bodyText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  if (combined.length < 80) {
    throw new Error(
      'LinkedIn returned insufficient profile data (the profile may be private or LinkedIn blocked the request). Please paste your profile text manually instead.'
    )
  }

  return combined
}

async function handleResolveUrl(req, res) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString())
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid request body' }))
    return
  }

  let { url } = body
  if (!url || typeof url !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'No URL provided' }))
    return
  }

  url = url.trim()

  // Prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }

  try {
    // If not already a LinkedIn URL, try following redirects
    if (!isLinkedInUrl(url)) {
      if (!isPossibleShortUrl(url)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'URL does not appear to be a LinkedIn link. Please paste your LinkedIn profile URL.' }))
        return
      }
      // Follow redirects
      url = await resolveRedirects(url)
    }

    if (!isLinkedInUrl(url)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          error: `Resolved URL does not point to LinkedIn (got: ${url}). Please paste your profile URL directly from LinkedIn.`,
        })
      )
      return
    }

    url = normaliseLinkedInUrl(url)

    // Attempt to scrape
    let profileText
    let scraped = true
    try {
      profileText = await scrapeLinkedInProfile(url)
    } catch (scrapeErr) {
      scraped = false
      profileText = ''
      console.warn('Scrape failed:', scrapeErr.message)
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        resolvedUrl: url,
        profileText,
        scraped,
        scrapeMessage: scraped
          ? 'Profile content fetched successfully.'
          : 'Could not automatically fetch your profile (LinkedIn may be blocking). Please paste your profile text below.',
      })
    )
  } catch (err) {
    console.error('resolve-url error:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message || 'Failed to resolve URL' }))
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  // CORS for local Vite dev server
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/api/roast') {
    handleRoast(req, res)
    return
  }

  if (req.method === 'POST' && req.url === '/api/resolve-url') {
    handleResolveUrl(req, res)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`\n🔥 LinkedIn Roaster dev API running at http://localhost:${PORT}`)
  console.log(`   /api/roast        — AI analysis`)
  console.log(`   /api/resolve-url  — URL validation + scraping`)
})
