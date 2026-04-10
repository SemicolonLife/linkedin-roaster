import { useState } from 'react'
import { RotateCcw, Share2 } from 'lucide-react'
import ScoreRing from './ScoreRing'
import SectionCard from './SectionCard'
import ShareCard from './ShareCard'

function getGrade(score) {
  if (score >= 80) return { letter: 'A', label: 'Recruiter bait 🎯', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-400' }
  if (score >= 65) return { letter: 'B', label: 'Pretty solid 👍', color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-300' }
  if (score >= 50) return { letter: 'C', label: 'Needs work 😬', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-400' }
  if (score >= 35) return { letter: 'D', label: 'Kinda rough 💀', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-400' }
  return { letter: 'F', label: 'Call a career counselor 🚨', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-400' }
}

const FUN_VERDICT = {
  A: "Okay bestie, you actually ate. Recruiters will be fighting over you. 🏆",
  B: "Not bad! A few tweaks and you'll be getting recruiter DMs in your sleep. 💪",
  C: "It's giving 'LinkedIn profile from 2019.' Time for a glow-up. 🌟",
  D: "Bestie… we need to talk. Your profile is trying its best but struggling. 😭",
  F: "Your profile called. It's in a coma. We need emergency surgery. 🏥",
}

export default function ResultsPanel({ result, mode, onReset }) {
  const { overall_score, share_summary, sections } = result
  const grade = getGrade(overall_score)
  const [showShare, setShowShare] = useState(false)

  return (
    <div className="space-y-5 animate-pop-in">
      {/* Score hero card */}
      <div className={`rounded-2xl border-2 ${grade.border} ${grade.bg} shadow-[4px_4px_0_#1c1917] p-6`}>
        <p className="text-xs font-black uppercase tracking-widest text-stone-500 mb-4 text-center">The Verdict Is In</p>

        <div className="flex items-center justify-center gap-8 mb-4">
          <ScoreRing score={overall_score} size={110} />
          <div className="text-center">
            <div className={`text-7xl font-black ${grade.color}`}>{grade.letter}</div>
            <div className={`text-sm font-bold mt-1 ${grade.color}`}>{grade.label}</div>
          </div>
        </div>

        {/* Fun verdict */}
        <div className="bg-white/80 rounded-xl border-2 border-stone-200 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-stone-700">{FUN_VERDICT[grade.letter]}</p>
        </div>

        {share_summary && (
          <p className="mt-3 text-xs text-stone-500 italic text-center">"{share_summary}"</p>
        )}

        {/* Progress bar */}
        <div className="mt-4 h-3 rounded-full bg-white/60 border border-stone-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              overall_score >= 65 ? 'bg-green-500' : overall_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${overall_score}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-bold text-stone-400">
          <span>💀 Embarrassing</span>
          <span>🔥 Profile goals</span>
        </div>
      </div>

      {/* Section breakdown */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-stone-400 mb-3">
          Section Breakdown — click to expand
        </p>
        <div className="space-y-2">
          {sections.map(s => (
            <SectionCard key={s.name} section={s} mode={mode} />
          ))}
        </div>
      </div>

      {/* Share card modal */}
      {showShare && (
        <ShareCard
          score={overall_score}
          grade={grade}
          summary={share_summary}
          sections={sections}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-600 hover:border-stone-500 hover:bg-stone-50 transition-all shadow-[2px_2px_0_#e7e5e4] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
        >
          <RotateCcw size={14} />
          New Roast
        </button>
        <button
          onClick={() => setShowShare(true)}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-stone-900 bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-[3px_3px_0_#1c1917] hover:shadow-[1px_1px_0_#1c1917] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          <Share2 size={14} />
          Share My Shame 😂
        </button>
      </div>
    </div>
  )
}
