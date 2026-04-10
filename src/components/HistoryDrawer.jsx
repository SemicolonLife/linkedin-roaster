import { Clock, Trash2, X } from 'lucide-react'
import { clearHistory } from '../lib/roastEngine'

export default function HistoryDrawer({ history, onSelect, onClose, onClear }) {
  function handleClear() { clearHistory(); onClear() }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-sm bg-amber-50 border-l-2 border-stone-900 flex flex-col shadow-[-4px_0_0_#1c1917]">
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-stone-200">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-orange-500" />
            <span className="text-sm font-black text-stone-800">Past Roastings</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center mt-12">
              <p className="text-4xl mb-3">🏜️</p>
              <p className="text-sm text-stone-400 font-semibold">No analyses yet.</p>
              <p className="text-xs text-stone-400 mt-1">Your roasting history will appear here.</p>
            </div>
          ) : (
            history.map(entry => {
              const score = entry.overall_score
              const color = score >= 65 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
              const bg = score >= 65 ? 'bg-green-50 border-green-300' : score >= 50 ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'
              return (
                <button
                  key={entry.id}
                  onClick={() => { onSelect(entry.result, entry.mode); onClose() }}
                  className={`w-full text-left rounded-xl border-2 ${bg} p-4 hover:shadow-[2px_2px_0_#1c1917] transition-all`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-2xl font-black tabular-nums ${color}`}>{score}/100</span>
                    <span className="text-xs text-stone-400 font-semibold">{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-stone-500 truncate">{entry.profileSnippet}</p>
                  <span className="inline-block mt-2 text-xs rounded-full px-2 py-0.5 bg-white border border-stone-200 text-stone-500 font-semibold capitalize">
                    {entry.mode} mode
                  </span>
                </button>
              )
            })
          )}
        </div>

        {history.length > 0 && (
          <div className="p-4 border-t-2 border-stone-200">
            <button onClick={handleClear} className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 font-bold transition-colors">
              <Trash2 size={13} /> Clear history
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
