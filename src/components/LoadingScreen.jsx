import { useEffect, useState } from 'react'

const LINES = [
  '📖 Reading your "passionate" about section…',
  '🔢 Counting how many times you said "motivated"…',
  '🧹 Dusting off your skills section…',
  '🚨 Detecting buzzword overload…',
  '💀 Calculating the cringe coefficient…',
  '🔍 Cross-referencing with 10,000 recruiter nightmares…',
  '🤦 Found "team player" — this is bad…',
  '🎭 Preparing your comedy roast…',
  '⏳ Almost done — bracing for impact…',
  '🫡 Stay strong, this might sting a little…',
]

export default function LoadingScreen() {
  const [idx, setIdx] = useState(0)
  const [dots, setDots] = useState(0)

  useEffect(() => {
    const lineTimer = setInterval(() => setIdx(i => (i + 1) % LINES.length), 2800)
    const dotTimer = setInterval(() => setDots(d => (d + 1) % 4), 500)
    return () => { clearInterval(lineTimer); clearInterval(dotTimer) }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-8">
      {/* Animated fire */}
      <div className="text-7xl animate-bounce select-none">🔥</div>

      {/* Spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
        <div className="absolute inset-0 rounded-full border-4 border-t-orange-500 animate-spin" />
      </div>

      {/* Rotating witty lines */}
      <div className="min-h-[48px] flex flex-col items-center gap-1">
        <p className="text-sm font-semibold text-stone-600 max-w-xs transition-all duration-300">
          {LINES[idx]}
        </p>
        <p className="text-xs text-stone-400">
          {'Thinking' + '.'.repeat(dots)}
        </p>
      </div>

      <div className="bg-amber-100 border-2 border-amber-300 rounded-xl px-5 py-3 max-w-xs">
        <p className="text-xs font-bold text-amber-700">⏱️ This takes 30–60 seconds</p>
        <p className="text-xs text-amber-600 mt-0.5">AI is reading every painful word of your profile. Please don't close the tab.</p>
      </div>
    </div>
  )
}
