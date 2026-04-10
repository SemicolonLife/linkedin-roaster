import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env.local fresh on every call so key changes take effect without restart
function getApiKey() {
  try {
    const lines = readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq !== -1 && t.slice(0, eq).trim() === 'CLAUDE_API_KEY') {
        return t.slice(eq + 1).trim()
      }
    }
  } catch { /* fall through */ }
  return process.env.CLAUDE_API_KEY || ''
}

// ── Helpers shared by both API routes ────────────────────────────────────────

function isLinkedInUrl(url) {
  try {
    const h = new URL(url).hostname
    return h === 'www.linkedin.com' || h === 'linkedin.com'
  } catch { return false }
}

function normaliseLinkedInUrl(url) {
  try {
    const p = new URL(url)
    if (p.hostname === 'linkedin.com') p.hostname = 'www.linkedin.com'
    return p.toString()
  } catch { return url }
}

const SHORT_DOMAINS = ['lnkd.in', 'linkedin.com', 'linked.in']
function isPossibleShortUrl(url) {
  try { return SHORT_DOMAINS.some(d => new URL(url).hostname.endsWith(d)) }
  catch { return false }
}

async function resolveRedirects(url, maxHops = 10) {
  let cur = url
  for (let i = 0; i < maxHops; i++) {
    const r = await fetch(cur, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
    const loc = r.headers.get('location')
    if (r.status >= 300 && r.status < 400 && loc) cur = new URL(loc, cur).toString()
    else break
  }
  return cur
}

async function scrapeLinkedInProfile(profileUrl) {
  const r = await fetch(profileUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const html = await r.text()
  const ogTitle = html.match(/property="og:title"[^>]+content="([^"]+)"/)?.[1] || ''
  const ogDesc = html.match(/property="og:description"[^>]+content="([^"]+)"/)?.[1] || ''
  let structured = ''
  for (const [, blk] of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const o = JSON.parse(blk)
      if (o['@type'] === 'Person' || o.name) {
        if (o.name) structured += `Name: ${o.name}\n`
        if (o.jobTitle) structured += `Headline: ${o.jobTitle}\n`
        if (o.description) structured += `About: ${o.description}\n`
      }
    } catch { /* skip */ }
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 4000)
  const combined = [ogTitle && `Headline: ${ogTitle}`, ogDesc && `Summary: ${ogDesc}`, structured, body.length > 200 && `Content:\n${body}`].filter(Boolean).join('\n\n')
  if (combined.length < 80) throw new Error('Insufficient data')
  return combined
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const SYS_ROAST = `You are a brutally honest but warm career coach who speaks like a confident Gen Z comedian. Analyze the LinkedIn profile and roast each section — be funny, sharp, and specific. Never attack the person, only their profile. End each section with one genuine improvement tip.`
const SYS_SERIOUS = `You are a senior recruiter at a top-tier tech company with 15 years of hiring experience. Analyze this LinkedIn profile section-by-section. Identify specific weaknesses and provide a rewritten version of each weak section.`

const OUTPUT_SCHEMA = `Return ONLY valid JSON:
{"overall_score":<0-100>,"share_summary":"<one punchy sentence>","sections":[{"name":"<Headline|About|Experience|Skills>","score":<0-10>,"roast":"<comedic critique>","tip":"<one improvement>","rewrite":"<rewritten version>"}]}`

function buildPrompt(profileText, mode, tone, targetRole) {
  const toneLabel = { gentle: 'Gentle', medium: 'Medium intensity', savage: 'Full Savage — no mercy' }[tone] || 'Medium'
  const roleNote = targetRole ? `Target role: "${targetRole}".` : ''
  if (mode === 'roast') return `Roast intensity: ${toneLabel}. ${roleNote}\n\nProfile:\n${profileText}\n\n${OUTPUT_SCHEMA}`
  if (mode === 'serious') return `${roleNote}\n\nProfile:\n${profileText}\n\n${OUTPUT_SCHEMA}`
  return `Roast intensity: ${toneLabel}. ${roleNote}\nProvide BOTH roast AND serious audit.\n\nProfile:\n${profileText}\n\n${OUTPUT_SCHEMA}`
}

// ── Security: server-side rate limiter (IP-based, in-memory) ─────────────────
//
// Tracks requests per IP per minute. Limits:
//   /api/roast       → 5 per minute per IP  (expensive AI call)
//   /api/resolve-url → 20 per minute per IP  (cheap URL check)
//
// Also enforces a 50 KB max request body to prevent payload abuse.

const MAX_BODY_BYTES = 50 * 1024 // 50 KB

const rateLimits = {
  '/api/roast':       { max: 5,  window: 60_000 },
  '/api/resolve-url': { max: 20, window: 60_000 },
}

// Map<ip, Map<route, { count, resetAt }>>
const ipStore = new Map()

function checkRateLimit(ip, route) {
  const limit = rateLimits[route]
  if (!limit) return { allowed: true }

  if (!ipStore.has(ip)) ipStore.set(ip, new Map())
  const routes = ipStore.get(ip)

  const now = Date.now()
  const state = routes.get(route) || { count: 0, resetAt: now + limit.window }

  if (now > state.resetAt) {
    // Window expired — reset
    state.count = 0
    state.resetAt = now + limit.window
  }

  state.count++
  routes.set(route, state)

  if (state.count > limit.max) {
    const retryAfter = Math.ceil((state.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }
  return { allowed: true }
}

// Purge stale IP entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now()
  for (const [ip, routes] of ipStore) {
    for (const [route, state] of routes) {
      if (now > state.resetAt) routes.delete(route)
    }
    if (routes.size === 0) ipStore.delete(ip)
  }
}, 5 * 60_000)

// ── Vite plugin: inline API middleware ────────────────────────────────────────

function apiPlugin() {
  return {
    name: 'linkedin-roaster-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        // Prevent clickjacking and sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('X-Frame-Options', 'DENY')

        // ── Rate limiting ────────────────────────────────────────────────────
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
               || req.socket?.remoteAddress
               || 'unknown'
        const { allowed, retryAfter } = checkRateLimit(ip, req.url)
        if (!allowed) {
          res.statusCode = 429
          res.setHeader('Retry-After', String(retryAfter))
          return res.end(JSON.stringify({
            error: `Too many requests. Please wait ${retryAfter}s before trying again.`,
          }))
        }

        // ── Body size limit ──────────────────────────────────────────────────
        const body = await new Promise((ok, fail) => {
          const chunks = []
          let totalBytes = 0
          req.on('data', c => {
            totalBytes += c.length
            if (totalBytes > MAX_BODY_BYTES) {
              req.destroy()
              fail(new Error('Request body too large (max 50 KB)'))
              return
            }
            chunks.push(c)
          })
          req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString())) } catch { ok({}) } })
          req.on('error', fail)
        }).catch(err => { throw err })

        // ── POST /api/resolve-url ────────────────────────────────────────────
        if (req.url === '/api/resolve-url') {
          let { url } = body
          if (!url) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'No URL provided' })) }
          url = url.trim()
          if (!/^https?:\/\//i.test(url)) url = 'https://' + url
          try {
            if (!isLinkedInUrl(url)) {
              if (!isPossibleShortUrl(url)) {
                res.statusCode = 400
                return res.end(JSON.stringify({ error: 'This does not look like a LinkedIn URL. Please paste your profile URL directly from LinkedIn.' }))
              }
              url = await resolveRedirects(url)
            }
            if (!isLinkedInUrl(url)) {
              res.statusCode = 400
              return res.end(JSON.stringify({ error: `Resolved URL does not point to LinkedIn (got: ${url}). Please paste your profile URL from https://www.linkedin.com` }))
            }
            url = normaliseLinkedInUrl(url)
            let profileText = '', scraped = true
            try { profileText = await scrapeLinkedInProfile(url) }
            catch (e) { scraped = false; console.warn('[api] scrape failed:', e.message) }
            return res.end(JSON.stringify({
              resolvedUrl: url, profileText, scraped,
              scrapeMessage: scraped
                ? 'Profile content fetched. Review below and submit when ready.'
                : 'LinkedIn blocked automatic fetching — please paste your profile text manually below.',
            }))
          } catch (err) {
            res.statusCode = 500
            return res.end(JSON.stringify({ error: err.message }))
          }
        }

        // ── POST /api/roast ──────────────────────────────────────────────────
        if (req.url === '/api/roast') {
          const apiKey = getApiKey()
          if (!apiKey) {
            res.statusCode = 500
            return res.end(JSON.stringify({ error: 'CLAUDE_API_KEY is not set in .env.local. Add it and try again.' }))
          }
          const { profileText, mode = 'both', tone = 'medium', targetRole = '' } = body
          if (!profileText || profileText.trim().length < 50) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Profile text is too short.' }))
          }
          try {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({
                model: 'claude-sonnet-4-5',
                max_tokens: 2048,
                system: mode === 'serious' ? SYS_SERIOUS : SYS_ROAST,
                messages: [{ role: 'user', content: buildPrompt(profileText, mode, tone, targetRole) }],
              }),
            })
            const claudeData = await claudeRes.json()
            if (!claudeRes.ok) {
              console.error('[api] Claude error:', claudeData)
              res.statusCode = 502
              return res.end(JSON.stringify({ error: claudeData?.error?.message || 'Claude API error. Check your API key.' }))
            }
            const raw = claudeData?.content?.[0]?.text ?? ''
            const match = raw.match(/\{[\s\S]*\}/)
            if (!match) { res.statusCode = 502; return res.end(JSON.stringify({ error: 'Unexpected AI response format.' })) }
            const parsed = JSON.parse(match[0])
            return res.end(JSON.stringify(parsed))
          } catch (err) {
            res.statusCode = 500
            return res.end(JSON.stringify({ error: err.message }))
          }
        }

        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Not found' }))
      })
    },
  }
}

// ── Vite config ───────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: { port: 5200 },
})
