import { useRef, useState } from 'react'
import { X, Download, Copy } from 'lucide-react'
import html2canvas from 'html2canvas'

export default function ShareCard({ score, grade, summary, sections, onClose }) {
  const cardRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleDownload() {
    if (!cardRef.current || exporting) return
    setExporting(true)
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#fffbf5', scale: 2, useCORS: true })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `linkedin-score-${score}.png`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  async function handleCopy() {
    const lines = sections.map(s => `${s.name}: ${s.score}/10`).join(' | ')
    const text = `My LinkedIn Score: ${score}/100 (${grade.letter} — ${grade.label.replace(/[🎯👍😬💀🚨]/g, '').trim()})\n${lines}\n\n"${summary}"\n\nRoast yours at linkedinroaster.com 🔥`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm space-y-3">
        {/* Card to export */}
        <div ref={cardRef} className="rounded-2xl bg-amber-50 border-2 border-stone-900 p-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-stone-400">LinkedIn Roaster</p>
              <p className="text-[10px] text-stone-400">linkedinroaster.com</p>
            </div>
            <span className="text-2xl">🔥</span>
          </div>

          <div className="text-center mb-4">
            <div className={`text-7xl font-black ${grade.color}`}>{score}</div>
            <div className="text-stone-400 text-sm font-bold">out of 100</div>
            <div className={`text-2xl font-black mt-1 ${grade.color}`}>{grade.letter} — {grade.label}</div>
          </div>

          <div className="space-y-1.5 mb-4">
            {sections.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-xs text-stone-500 w-20 font-semibold">{s.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-stone-200">
                  <div className={`h-1.5 rounded-full ${s.score >= 7 ? 'bg-green-500' : s.score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(s.score / 10) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-stone-500 w-8 text-right">{s.score}/10</span>
              </div>
            ))}
          </div>

          {summary && (
            <p className="text-xs text-stone-500 italic text-center border-t-2 border-stone-200 pt-3">"{summary}"</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-stone-300 bg-white text-stone-400 hover:border-stone-500 transition-all flex-shrink-0">
            <X size={16} />
          </button>
          <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-stone-300 bg-white py-2.5 text-sm font-bold text-stone-600 hover:border-stone-500 transition-all">
            <Copy size={13} />
            {copied ? '✓ Copied!' : 'Copy Text'}
          </button>
          <button onClick={handleDownload} disabled={exporting} className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-stone-900 bg-orange-500 py-2.5 text-sm font-black text-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-60">
            <Download size={13} />
            {exporting ? 'Saving…' : 'Save Image'}
          </button>
        </div>
      </div>
    </div>
  )
}
