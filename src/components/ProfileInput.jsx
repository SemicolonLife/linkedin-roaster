import { useState, useRef } from 'react'
import { Flame, BarChart2, Zap, ChevronDown, ChevronUp, Link2, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react'
import { resolveLinkedInUrl } from '../lib/roastEngine'

const MODES = [
  { id: 'roast', label: 'Roast Me 🔥', desc: 'Comedy first, truth second' },
  { id: 'serious', label: 'Be Honest 📊', desc: 'Recruiter-level audit' },
  { id: 'both', label: 'Both ⚡', desc: 'Full roast + full audit' },
]

const TONES = [
  { id: 'gentle', emoji: '😇', label: 'Gentle' },
  { id: 'medium', emoji: '😬', label: 'Medium' },
  { id: 'savage', emoji: '💀', label: 'Full Savage' },
]

export default function ProfileInput({ onSubmit, remaining }) {
  const [mode, setMode] = useState('both')
  const [tone, setTone] = useState('medium')
  const [targetRole, setTargetRole] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [url, setUrl] = useState('')
  const [urlStatus, setUrlStatus] = useState('idle') // idle | checking | valid | invalid
  const [urlError, setUrlError] = useState('')
  const [resolvedUrl, setResolvedUrl] = useState('')

  const [profileText, setProfileText] = useState('')
  const [scrapeOk, setScrapeOk] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState('')

  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const validationRef = useRef(null)

  const canSubmit = urlStatus === 'valid' && profileText.trim().length >= 30 && !loading

  async function validateUrl(rawUrl) {
    const trimmed = rawUrl.trim()
    if (!trimmed) return

    // Cancel any in-flight validation
    if (validationRef.current) clearTimeout(validationRef.current)

    setUrlStatus('checking')
    setUrlError('')
    setScrapeMsg('')
    setProfileText('')
    setScrapeOk(false)
    setResolvedUrl('')
    setSubmitError('')

    try {
      const result = await resolveLinkedInUrl(trimmed)
      setResolvedUrl(result.resolvedUrl)
      setUrlStatus('valid')
      setScrapeOk(result.scraped)
      setScrapeMsg(result.scrapeMessage)
      if (result.profileText) setProfileText(result.profileText)
    } catch (err) {
      setUrlStatus('invalid')
      setUrlError(err.message)
    }
  }

  // Trigger validation immediately on paste
  function handlePaste(e) {
    const pasted = e.clipboardData?.getData('text')?.trim()
    if (pasted) {
      setUrl(pasted)
      // small delay so the input value updates first
      setTimeout(() => validateUrl(pasted), 50)
    }
  }

  function handleUrlChange(e) {
    const val = e.target.value
    setUrl(val)
    // Reset status when user manually edits
    if (urlStatus !== 'idle') {
      setUrlStatus('idle')
      setUrlError('')
      setResolvedUrl('')
      setProfileText('')
      setScrapeOk(false)
      setScrapeMsg('')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (url.trim()) validateUrl(url)
    }
  }

  function handleBlur() {
    if (url.trim() && urlStatus === 'idle') validateUrl(url)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) {
      if (urlStatus !== 'valid') setSubmitError('Please paste your LinkedIn URL first and wait for validation ✅')
      else setSubmitError('Profile text is missing — paste it manually below 👇')
      return
    }
    if (remaining <= 0) {
      setSubmitError('You\'ve used your 3 free analyses today. Come back tomorrow!')
      return
    }
    setSubmitError('')
    setLoading(true)
    try {
      await onSubmit({ profileText, mode, tone, targetRole })
    } finally {
      setLoading(false)
    }
  }

  const urlBorderClass =
    urlStatus === 'valid' ? 'border-green-500 ring-1 ring-green-400'
    : urlStatus === 'invalid' ? 'border-red-400 ring-1 ring-red-300'
    : urlStatus === 'checking' ? 'border-orange-400 ring-1 ring-orange-300'
    : 'border-stone-300 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-300'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Mode selector */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Pick your poison</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all duration-150 ${
                mode === id
                  ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-[2px_2px_0_#f97316]'
                  : 'border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-400 hover:bg-white'
              }`}
            >
              <span className="text-xs font-bold">{label}</span>
              <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* LinkedIn URL */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-stone-400 block mb-2">
          LinkedIn Profile URL
        </label>

        <div className={`flex items-center rounded-xl border-2 bg-white transition-all ${urlBorderClass}`}>
          <div className="pl-3 pr-2 flex-shrink-0">
            {urlStatus === 'checking' && <Loader2 size={16} className="animate-spin text-orange-400" />}
            {urlStatus === 'valid' && <CheckCircle2 size={16} className="text-green-500" />}
            {urlStatus === 'invalid' && <XCircle size={16} className="text-red-400" />}
            {(urlStatus === 'idle') && <Link2 size={16} className="text-stone-400" />}
          </div>
          <input
            type="url"
            value={url}
            onChange={handleUrlChange}
            onPaste={handlePaste}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="https://www.linkedin.com/in/your-name/"
            className="flex-1 py-3 pr-3 text-sm bg-transparent outline-none placeholder-stone-400 text-stone-800"
          />
        </div>

        {/* Status messages */}
        {urlStatus === 'idle' && !url && (
          <p className="mt-1.5 text-xs text-stone-400 font-medium">
            Paste your URL — validation starts automatically 🚀
          </p>
        )}
        {urlStatus === 'checking' && (
          <p className="mt-1.5 text-xs text-orange-500 font-medium animate-pulse">
            Checking LinkedIn URL & fetching your profile…
          </p>
        )}
        {urlStatus === 'invalid' && (
          <p className="mt-1.5 text-xs text-red-500 font-semibold flex items-center gap-1">
            ✕ {urlError}
          </p>
        )}
        {urlStatus === 'valid' && (
          <p className="mt-1.5 text-xs text-green-600 font-semibold flex items-center gap-1 truncate">
            ✓ {resolvedUrl}
          </p>
        )}
      </div>

      {/* Scraped / manual text area */}
      {urlStatus === 'valid' && (
        <div className="animate-pop-in">
          {/* Scrape banner */}
          <div className={`rounded-xl border-2 px-3 py-2 mb-3 text-xs font-semibold flex items-start gap-2 ${
            scrapeOk
              ? 'bg-green-50 border-green-400 text-green-700'
              : 'bg-amber-50 border-amber-400 text-amber-700'
          }`}>
            <span className="text-base">{scrapeOk ? '🎯' : '⚠️'}</span>
            <span>{scrapeMsg}</span>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400 block mb-2 flex items-center gap-1.5">
              <FileText size={11} />
              {scrapeOk ? 'Auto-fetched content (edit if needed)' : 'Paste your profile text here'}
            </label>
            <textarea
              value={profileText}
              onChange={e => setProfileText(e.target.value)}
              rows={7}
              placeholder="Copy your headline, about section, experience, and skills from LinkedIn and paste here…"
              className="w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-orange-400 transition-all resize-none"
            />
            {!profileText && (
              <p className="mt-1 text-xs text-red-500 font-semibold">
                ⚠️ Paste your profile text above to enable the roast button
              </p>
            )}
            {profileText && (
              <p className="mt-1 text-xs text-green-600 font-semibold">
                ✓ {profileText.trim().length} characters ready — let's go!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Advanced options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-stone-600 transition-colors"
        >
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 rounded-xl border-2 border-stone-200 bg-stone-50 p-4">
            {(mode === 'roast' || mode === 'both') && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Roast intensity</p>
                <div className="flex gap-2">
                  {TONES.map(({ id, emoji, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTone(id)}
                      className={`flex-1 rounded-lg border-2 py-2 text-xs font-bold transition-all ${
                        tone === id
                          ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-[2px_2px_0_#f97316]'
                          : 'border-stone-200 text-stone-500 hover:border-stone-400 bg-white'
                      }`}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400 block mb-2">
                Target role <span className="text-stone-400 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                placeholder="e.g. Staff iOS Engineer at a fintech startup"
                className="w-full rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-orange-400 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="text-sm text-red-600 font-semibold bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <span className="text-xs text-stone-400 font-medium">
          {remaining} free {remaining === 1 ? 'analysis' : 'analyses'} left today
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex-1 max-w-xs rounded-xl border-2 px-6 py-3 text-sm font-black transition-all duration-150 ${
            canSubmit
              ? 'border-stone-900 bg-orange-500 text-white shadow-[3px_3px_0_#1c1917] hover:shadow-[1px_1px_0_#1c1917] hover:translate-x-0.5 hover:translate-y-0.5 active:shadow-none active:translate-x-1 active:translate-y-1'
              : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
          }`}
        >
          {loading
            ? '🔄 Analyzing…'
            : !canSubmit
            ? urlStatus === 'checking' ? '⏳ Validating URL…' : urlStatus !== 'valid' ? '🔗 Enter LinkedIn URL first' : '📋 Add profile text above'
            : mode === 'roast' ? '🔥 Roast My Profile'
            : mode === 'serious' ? '📊 Audit My Profile'
            : '⚡ Roast + Audit Me'}
        </button>
      </div>
    </form>
  )
}
