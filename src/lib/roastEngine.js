// Client-side wrapper for /api/roast and /api/resolve-url serverless functions.
// Handles fetch, timeout, and basic response validation.

const TIMEOUT_MS = 90_000

export async function resolveLinkedInUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch('/api/resolve-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'URL validation failed')
    return data // { resolvedUrl, profileText, scraped, scrapeMessage }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('URL resolution timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function analyzeProfile({ profileText, mode, tone, targetRole }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('/api/roast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ profileText, mode, tone, targetRole }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.error || `Request failed with status ${res.status}`)
    }

    // Basic schema validation
    if (
      typeof data.overall_score !== 'number' ||
      !Array.isArray(data.sections) ||
      data.sections.length === 0
    ) {
      throw new Error('Received an unexpected response from the AI. Please try again.')
    }

    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The request timed out. Please try again — AI services can be slow under load.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// localStorage-based history (max 3 entries)
const HISTORY_KEY = 'lr_history'

export function saveToHistory(result, profileSnippet, mode) {
  const history = getHistory()
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    profileSnippet: profileSnippet.slice(0, 120) + '…',
    mode,
    overall_score: result.overall_score,
    result,
  }
  const updated = [entry, ...history].slice(0, 3)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

// Daily analysis cap for free tier (3/day, browser-side only)
const USAGE_KEY = 'lr_usage'

export function getRemainingAnalyses() {
  try {
    const stored = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}')
    const today = new Date().toDateString()
    if (stored.date !== today) return 3
    return Math.max(0, 3 - (stored.count || 0))
  } catch {
    return 3
  }
}

export function recordAnalysis() {
  try {
    const stored = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}')
    const today = new Date().toDateString()
    const count = stored.date === today ? (stored.count || 0) + 1 : 1
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count }))
  } catch {
    // silently fail
  }
}
