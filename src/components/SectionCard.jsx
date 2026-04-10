import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ScoreBar } from './ScoreRing'

const ICONS = { Headline: '🏷️', About: '👤', Experience: '💼', Skills: '🛠️' }

const SCORE_STAMP = (score) => {
  if (score >= 8) return { emoji: '✅', label: 'Strong', bg: 'bg-green-50 border-green-400', text: 'text-green-700' }
  if (score >= 6) return { emoji: '🟡', label: 'Decent', bg: 'bg-amber-50 border-amber-400', text: 'text-amber-700' }
  if (score >= 4) return { emoji: '🟠', label: 'Weak', bg: 'bg-orange-50 border-orange-400', text: 'text-orange-700' }
  return { emoji: '🔴', label: 'Terrible', bg: 'bg-red-50 border-red-400', text: 'text-red-700' }
}

export default function SectionCard({ section, mode }) {
  const [expanded, setExpanded] = useState(false)
  const { name, score, roast, tip, rewrite } = section
  const stamp = SCORE_STAMP(score)
  const showRoast = (mode === 'roast' || mode === 'both') && roast
  const showRewrite = (mode === 'serious' || mode === 'both') && rewrite

  return (
    <div className={`rounded-xl border-2 bg-white overflow-hidden transition-all ${expanded ? 'border-stone-900 shadow-[3px_3px_0_#1c1917]' : 'border-stone-200 hover:border-stone-400'}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
      >
        <span className="text-2xl flex-shrink-0">{ICONS[name] || '📌'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-black text-stone-800">{name}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${stamp.bg} ${stamp.text}`}>
              {stamp.emoji} {stamp.label}
            </span>
          </div>
          <ScoreBar score={score} />
        </div>
        <div className="flex-shrink-0 ml-2">
          {expanded
            ? <ChevronUp size={16} className="text-stone-400" />
            : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-4 border-t-2 border-stone-100">
          {showRoast && (
            <div className="mt-4 rounded-xl bg-orange-50 border-2 border-orange-300 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-2 flex items-center gap-1">
                🔥 The Roast
              </p>
              <p className="text-sm text-stone-700 leading-relaxed italic">"{roast}"</p>
            </div>
          )}

          {tip && (
            <div className="rounded-xl bg-yellow-50 border-2 border-yellow-300 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-yellow-600 mb-2 flex items-center gap-1">
                💡 Quick Win
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">{tip}</p>
            </div>
          )}

          {showRewrite && (
            <div className="rounded-xl bg-green-50 border-2 border-green-400 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-green-600 mb-2 flex items-center gap-1">
                ✍️ Suggested Rewrite
              </p>
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">{rewrite}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
