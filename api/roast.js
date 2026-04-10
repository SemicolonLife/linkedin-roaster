// Vercel Edge Function — proxies requests to Claude API.
// API key is server-side only (never sent to the browser).
// Includes: rate limiting, body size limit, security headers.
export const config = { runtime: 'edge' }

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'
const MAX_BODY_BYTES = 50 * 1024 // 50 KB

// In-memory rate limiter (resets on cold start — acceptable for edge)
const ipStore = new Map()
function checkRateLimit(ip) {
  const now = Date.now()
  const window = 60_000
  const max = 5
  const state = ipStore.get(ip) || { count: 0, resetAt: now + window }
  if (now > state.resetAt) { state.count = 0; state.resetAt = now + window }
  state.count++
  ipStore.set(ip, state)
  if (state.count > max) return { allowed: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) }
  return { allowed: true }
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const ALLOWED_ORIGINS = ['https://linkedinroaster.com', 'https://www.linkedinroaster.com']

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

  if (mode === 'roast') {
    return `Roast intensity: ${toneLabel}. ${roleNote}\n\nProfile:\n${profileText}\n\n${outputSchema}`
  }
  if (mode === 'serious') {
    return `${roleNote}\n\nProfile:\n${profileText}\n\n${outputSchema}`
  }
  // both
  return `Roast intensity: ${toneLabel}. ${roleNote}\nProvide both a roast AND a serious audit for each section.\n\nProfile:\n${profileText}\n\n${outputSchema}`
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: SECURITY_HEADERS })
  }

  // CORS — only allow requests from known origins in production
  const origin = req.headers.get('origin') || ''
  const isDev = origin.startsWith('http://localhost')
  if (!isDev && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: SECURITY_HEADERS })
  }

  // Rate limiting per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const { allowed, retryAfter } = checkRateLimit(ip)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: `Too many requests. Wait ${retryAfter}s.` }),
      { status: 429, headers: { ...SECURITY_HEADERS, 'Retry-After': String(retryAfter) } }
    )
  }

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: SECURITY_HEADERS,
    })
  }

  // Body size check
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Request too large' }), { status: 413, headers: SECURITY_HEADERS })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: SECURITY_HEADERS })
  }

  const { profileText, mode = 'both', tone = 'medium', targetRole = '' } = body

  if (!profileText || profileText.trim().length < 50) {
    return new Response(
      JSON.stringify({ error: 'Profile text is too short.' }),
      { status: 400, headers: SECURITY_HEADERS }
    )
  }

  const systemPrompt = mode === 'serious' ? SYSTEM_SERIOUS : SYSTEM_ROAST

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

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    console.error('API error:', errText)
    return new Response(JSON.stringify({ error: 'AI service error. Please try again.' }), {
      status: 502, headers: SECURITY_HEADERS,
    })
  }

  const claudeData = await claudeRes.json()
  const rawContent = claudeData?.content?.[0]?.text ?? ''
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return new Response(JSON.stringify({ error: 'Unexpected AI response format. Please try again.' }), {
      status: 502, headers: SECURITY_HEADERS,
    })
  }

  let parsed
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return new Response(JSON.stringify({ error: 'Could not parse AI response. Please try again.' }), {
      status: 502, headers: SECURITY_HEADERS,
    })
  }

  return new Response(JSON.stringify(parsed), { status: 200, headers: SECURITY_HEADERS })
}
