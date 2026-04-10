export default function ScoreRing({ score, size = 100 }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const { color, bg, grade, label } =
    score >= 80 ? { color: '#16a34a', bg: '#dcfce7', grade: 'A', label: 'Recruiter bait' }
    : score >= 65 ? { color: '#22c55e', bg: '#f0fdf4', grade: 'B', label: 'Pretty solid' }
    : score >= 50 ? { color: '#d97706', bg: '#fef3c7', grade: 'C', label: 'Needs work' }
    : score >= 35 ? { color: '#ea580c', bg: '#fff7ed', grade: 'D', label: 'Kinda rough' }
    : { color: '#dc2626', bg: '#fef2f2', grade: 'F', label: 'Call a career counselor' }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e7e5e4" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black text-2xl tabular-nums" style={{ color }}>{score}</span>
          <span className="text-xs text-stone-400 font-semibold">/100</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <span className="text-3xl font-black" style={{ color }}>{grade}</span>
        <p className="text-xs font-semibold text-stone-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export function ScoreBar({ score, max = 10 }) {
  const pct = (score / max) * 100
  const color = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const textColor = pct >= 75 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-stone-200">
        <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-bold w-8 text-right ${textColor}`}>{score}/10</span>
    </div>
  )
}
